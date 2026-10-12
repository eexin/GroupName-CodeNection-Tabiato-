import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { HAZARD_LABEL, hazardsNear, type Hazard } from "@/features/live/hazards";
import { tripDay } from "@/features/live/live-logic";
import { forecast, rainWindow, summary } from "@/features/live/weather";

/**
 * What is happening on a trip right now: weather, a rain replan, and nearby hazards.
 * Data is fetched and decided in code; Ato (via n8n) only words the suggestion.
 */

export type TripRow = {
  id: string; name: string; status: string; start_date: string | null; end_date: string | null;
  dest_lat: number | null; dest_lng: number | null; country_code: string | null; demo_alert: Hazard | null;
};

type Stop = { id: string; name: string; category: string | null; day: number | null; start_time: string | null; duration_min: number | null };

const OUTDOOR = new Set(["nature"]);
const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

export async function tripLive(supabase: SupabaseClient, trip: TripRow) {
  if (trip.dest_lat === null || trip.dest_lng === null) return null;
  const [fc, real] = await Promise.all([forecast(trip.dest_lat, trip.dest_lng), hazardsNear(trip.dest_lat, trip.dest_lng)]);
  const hazards: Hazard[] = [...(trip.demo_alert ? [{ ...trip.demo_alert, demo: true }] : []), ...real];
  if (!fc) return { weather: null, replan: null, hazards };

  const today = Object.keys(fc.days)[0];
  const hours = fc.days[today] ?? [];
  const day = tripDay(trip, today);
  const w = rainWindow(hours);
  const weather = { today, summary: summary(hours), rain: w };

  let replan: { headline: string; suggestion: string; day: number; stopIds: string[] } | null = null;
  if (w && day && day.n < day.len) {
    const { data } = await supabase.from("plan_stops").select("id, name, category, day, start_time, duration_min").eq("trip_id", trip.id).eq("day", day.n);
    const stops = (data ?? []) as Stop[];
    const affected = stops.filter((s) => {
      if (!OUTDOOR.has(s.category ?? "") || !s.start_time) return false;
      const start = Number(s.start_time.slice(0, 2));
      const end = start + Math.ceil((s.duration_min ?? 60) / 60);
      return start < w.to && end > w.from;
    });
    if (affected.length) {
      const indoor = stops.filter((s) => !affected.includes(s)).map((s) => s.name);
      const facts = { rain_from: pad(w.from), rain_to: pad(w.to), chance: w.peak, affected: affected.map((s) => `${s.name} at ${s.start_time!.slice(0, 5)}`), indoor_today: indoor };
      const ai = await aiJSON(
        "rain_replan",
        `You are Ato, a calm goldfish travel companion. Rain is forecast. Using ONLY these facts, write a short headline (max 6 words, e.g. "Rain expected at 3pm.") and ONE suggestion sentence under 25 words that proposes moving the affected outdoor stops to tomorrow morning. Return JSON {"headline": string, "suggestion": string}.`,
        JSON.stringify(facts),
        z.object({ headline: z.string().max(60), suggestion: z.string().max(220) }),
      );
      replan = {
        headline: ai?.headline ?? `Rain expected from ${pad(w.from)}.`,
        suggestion: ai?.suggestion ?? `${w.peak}% chance of rain ${pad(w.from)}–${pad(w.to)}. Move ${affected.map((s) => s.name).join(" and ")} to tomorrow morning?`,
        day: day.n,
        stopIds: affected.map((s) => s.id),
      };
    }
  }
  return { weather, replan, hazards };
}

/** Figma 33 — what a hazard changes for this trip, and Ato's suggestion. */
export async function hazardImpact(supabase: SupabaseClient, trip: TripRow, h: Hazard) {
  const localToday = new Date().toISOString().slice(0, 10);
  const day = tripDay(trip, localToday);
  const { data } = await supabase.from("plan_stops").select("id, name, category, day, start_time").eq("trip_id", trip.id)
    .gte("day", day?.n ?? 1).order("day").order("position");
  const upcoming = ((data ?? []) as Stop[]).slice(0, 12);
  const outdoor = upcoming.filter((s) => OUTDOOR.has(s.category ?? ""));
  const indoorDays = [...new Set(upcoming.filter((s) => !OUTDOOR.has(s.category ?? "")).map((s) => s.day))];
  const ai = await aiJSON(
    "hazard_advice",
    `You are Ato, a calm goldfish travel companion. A natural hazard is reported near the trip. Using ONLY these facts, write ONE practical suggestion under 30 words. Never claim to be an official warning; if the hazard is severe, tell them to follow local authorities. Return JSON {"suggestion": string}.`,
    JSON.stringify({ hazard: `${HAZARD_LABEL[h.type] ?? h.type} "${h.name}", ${h.level} alert, ${h.km} km away`, outdoor_stops: outdoor.map((s) => `Day ${s.day}: ${s.name}`), days_with_indoor_plans: indoorDays }),
    z.object({ suggestion: z.string().max(260) }),
  );
  const outdoorDays = new Set(outdoor.map((s) => s.day));
  const indoorSameDay = upcoming.filter((s) => !OUTDOOR.has(s.category ?? "") && outdoorDays.has(s.day));
  return {
    indoorSameDay,
    outdoor,
    suggestion: ai?.suggestion ??
      (outdoor.length ? `Keep ${outdoor.map((s) => s.name).join(", ")} flexible and check local warnings before heading outdoors.` : "Check local warnings before you head out, and keep plans flexible."),
  };
}
