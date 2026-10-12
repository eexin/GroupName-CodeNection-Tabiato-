"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { requireUser } from "@/features/auth/guards";
import { categorise } from "@/lib/categories";
import { geocodeDestination, nearbyPois, POI_BUDGET } from "@/features/planner/osm";
import { buildItinerary, type Pace, type UserStop } from "@/features/planner/itinerary";
import { learnForUser } from "@/features/planner/learn";
import type { ActionResult } from "@/lib/types";

export type PlanState = { error?: string };

const planSchema = z
  .object({
    destination: z.string().trim().min(2, "Where are you going?").max(80),
    start_date: z.string().min(1, "Pick a start date."),
    end_date: z.string().min(1, "Pick an end date."),
    budget: z.coerce.number().min(0).max(1_000_000).optional(),
    pace: z.enum(["slow", "balanced", "packed"]),
    interests: z.array(z.string()).max(8),
  })
  .refine((p) => p.end_date >= p.start_date, { message: "The end date is before the start date." })
  .refine((p) => (new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86400000 < 14, { message: "Plans are limited to 14 days." });

/** 29 Plan a trip → creates a trip in 'planned' status. */
export async function createPlan(_: PlanState, form: FormData): Promise<PlanState> {
  const parsed = planSchema.safeParse({
    destination: form.get("destination"),
    start_date: form.get("start_date"),
    end_date: form.get("end_date"),
    budget: form.get("budget") || undefined,
    pace: form.get("pace"),
    interests: form.getAll("interests"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const where = await geocodeDestination(parsed.data.destination);
  if (!where) return { error: `I couldn't find "${parsed.data.destination}" on the map. Try a city name.` };

  const { supabase, user } = await requireUser();
  const { destination, start_date, end_date, budget, pace, interests } = parsed.data;
  const { data, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id, name: destination.split(",")[0], destination, start_date, end_date, status: "planned",
      dest_lat: where.lat, dest_lng: where.lng, country_code: where.countryCode, budget: budget ?? null, plan_style: { pace, interests },
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the plan. Try again." };
  redirect(`/plan/${data.id}/places`);
}

const updateSchema = z
  .object({
    start_date: z.string().min(1, "Pick a start date."),
    end_date: z.string().min(1, "Pick an end date."),
    budget: z.coerce.number().min(0).max(1_000_000).optional(),
    pace: z.enum(["slow", "balanced", "packed"]),
    interests: z.array(z.string()).max(8),
  })
  .refine((p) => p.end_date >= p.start_date, { message: "The end date is before the start date." });

/** Figma 29 for an existing plan — change dates, budget and preferences, then regenerate. */
export async function updatePlan(tripId: string, _: PlanState, form: FormData): Promise<PlanState> {
  const parsed = updateSchema.safeParse({
    start_date: form.get("start_date"), end_date: form.get("end_date"),
    budget: form.get("budget") || undefined, pace: form.get("pace"), interests: form.getAll("interests"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("plan_style, owner_id").eq("id", tripId).single();
  if (trip?.owner_id !== user.id) return { error: "Only the trip leader can change the plan." };
  const { start_date, end_date, budget, pace, interests } = parsed.data;
  await supabase.from("trips").update({ start_date, end_date, budget: budget ?? null, plan_style: { ...(trip.plan_style ?? {}), pace, interests } }).eq("id", tripId);
  revalidatePath(`/plan/${tripId}`);
  redirect(`/plan/${tripId}/build`);
}

export async function addStop(tripId: string, stop: { name: string; lat: number; lng: number; category?: string | null; ref?: string }): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: last } = await supabase.from("plan_stops").select("priority").eq("trip_id", tripId).eq("source", "user")
    .order("priority", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("plan_stops").insert({
    priority: (last?.priority ?? -1) + 1,
    trip_id: tripId, added_by: user.id, name: stop.name.slice(0, 120), lat: stop.lat, lng: stop.lng,
    category: stop.category ?? categorise(null, null), source: "user", osm_ref: stop.ref ?? null,
  });
  revalidatePath(`/plan/${tripId}/places`);
  return error ? { error: "Couldn't add that place." } : { ok: true };
}

/** Figma 35 "drag to reorder" — up/down buttons (easier to hit on a phone and usable with a keyboard). */
export async function moveStop(tripId: string, stopId: string, dir: -1 | 1) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("plan_stops").select("id").eq("trip_id", tripId).eq("source", "user")
    .order("priority", { nullsFirst: false }).order("created_at");
  const ids = (data ?? []).map((r) => r.id);
  const i = ids.indexOf(stopId), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  // all at once: one update per stop in sequence meant the arrow took a round trip per place in the list
  await Promise.all(ids.map((id, k) => supabase.from("plan_stops").update({ priority: k }).eq("id", id)));
  revalidatePath(`/plan/${tripId}/places`);
}

export async function removeStop(tripId: string, stopId: string) {
  const { supabase } = await requireUser();
  await supabase.from("plan_stops").delete().eq("id", stopId);
  revalidatePath(`/plan/${tripId}/places`);
  revalidatePath(`/plan/${tripId}`);
}

export async function pinStop(tripId: string, stopId: string, form: FormData) {
  const day = Number(form.get("day")) || null;
  const time = String(form.get("time") || "") || null;
  const { supabase } = await requireUser();
  await supabase.from("plan_stops").update({ fixed_day: day, fixed_time: time }).eq("id", stopId);
  revalidatePath(`/plan/${tripId}/places`);
}

const dayTitles = z.object({ days: z.array(z.object({ day: z.number(), title: z.string().max(60) })).max(14) });

/** 31b → 31. Builds the itinerary: code decides places and times; the model may only title the days. */
export async function buildPlan(tripId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: trip }, { data: stops }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("plan_stops").select("*").eq("trip_id", tripId).order("priority", { nullsFirst: false }).order("created_at"),
  ]);
  if (!trip) return { error: "Trip not found." };
  if (trip.dest_lat === null) return { error: "This plan has no destination." };

  const days = Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1);
  const style = (trip.plan_style ?? {}) as { pace?: Pace; interests?: string[] };
  const userStops = ((stops ?? []) as (UserStop & { source: string })[]).filter((s) => s.source === "user");
  const [candidates, learned] = await Promise.all([
    // the build screen shows progress, so this is the one place worth waiting for OpenStreetMap
    nearbyPois(supabase, trip.dest_lat, trip.dest_lng, POI_BUDGET.build),
    learnForUser(supabase, user.id), // the memory → planning loop
  ]);

  const plan = buildItinerary({
    userStops, candidates, days,
    pace: style.pace ?? "balanced",
    interests: style.interests ?? [],
    center: { lat: trip.dest_lat, lng: trip.dest_lng },
    learned,
  });

  // replace the previous fill, keep every user stop
  await supabase.from("plan_stops").delete().eq("trip_id", tripId).eq("source", "ato");
  await Promise.all(
    plan.filter((p) => p.source === "user").map((s) =>
      supabase.from("plan_stops")
        .update({ day: s.day, position: s.position, start_time: s.start, duration_min: s.duration, category: s.category })
        .eq("id", s.id!)),
  );
  const picks = plan.filter((p) => p.source === "ato");
  if (picks.length) {
    await supabase.from("plan_stops").insert(picks.map((s) => ({
      trip_id: tripId, name: s.name, lat: s.lat, lng: s.lng, category: s.category, source: "ato",
      reason: s.reason, day: s.day, position: s.position, start_time: s.start, duration_min: s.duration, osm_ref: s.ref,
    })));
  }

  // optional day titles from the model, grounded in the stops it was given
  const titles = await aiJSON(
    "plan_titles",
    `You are Ato, a warm goldfish trip planner. Give each day a short title (max 6 words) based ONLY on its stops. Return JSON {"days":[{"day":number,"title":string}]}.`,
    JSON.stringify(Array.from({ length: days }, (_, i) => ({ day: i + 1, stops: plan.filter((p) => p.day === i + 1).map((p) => p.name) }))),
    dayTitles,
  );
  await supabase.from("trips")
    .update({ plan_style: { ...style, day_titles: titles?.days ?? [], learned: learned.notes, built_at: new Date().toISOString() } })
    .eq("id", tripId);

  revalidatePath(`/plan/${tripId}`);
  return { ok: true };
}

/** A plan becomes a memory trip. */
export async function startTrip(tripId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("trips").update({ status: "ongoing" }).eq("id", tripId).eq("owner_id", user.id);
  revalidatePath("/");
  redirect(`/trips/${tripId}`);
}
