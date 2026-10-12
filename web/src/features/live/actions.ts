"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/features/auth/guards";
import { planHazardSwap, tripDay } from "@/features/live/live-logic";

/** Figma 32 "Reroute": move the rained-out outdoor stops to the start of tomorrow. */
export async function rerouteForRain(tripId: string, day: number, stopIds: string[]) {
  const { supabase } = await requireUser();
  if (!stopIds.length) return;
  await supabase.from("plan_stops").update({ day: day + 1, position: -1, start_time: "09:00" }).in("id", stopIds).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}

/** Figma 33 "Reschedule": swap the affected day with the next all-indoor day. */
export async function rescheduleAroundHazard(tripId: string) {
  const { supabase } = await requireUser();
  const { data: trip } = await supabase.from("trips").select("start_date, end_date").eq("id", tripId).single();
  if (!trip?.start_date || !trip.end_date) return { error: "This trip has no dates." };
  const len = Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86400000) + 1;
  const today = tripDay(trip, new Date().toISOString().slice(0, 10))?.n ?? 1;
  const { data: stops } = await supabase.from("plan_stops").select("id, day, category").eq("trip_id", tripId);
  const plan = planHazardSwap(stops ?? [], today, len);
  if (!plan) return { error: "Nothing outdoors left to move — your plan already works." };
  const on = (d: number) => (stops ?? []).filter((s) => s.day === d);
  if (plan.kind === "swap") {
    const a = on(plan.from).map((s) => s.id), b = on(plan.to).map((s) => s.id);
    if (a.length) await supabase.from("plan_stops").update({ day: plan.to }).in("id", a);
    if (b.length) await supabase.from("plan_stops").update({ day: plan.from }).in("id", b);
  } else {
    const ids = on(plan.from).filter((s) => s.category === "nature").map((s) => s.id);
    await supabase.from("plan_stops").update({ day: plan.to }).in("id", ids);
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, ...plan };
}

/** Mute / "I'm safe · dismiss" — remembered on this device for 30 days. */
export async function muteAlert(tripId: string, hazardId: string) {
  const jar = await cookies();
  const muted: string[] = JSON.parse(jar.get("tabiato_muted")?.value ?? "[]");
  const key = `${tripId}:${hazardId}`;
  if (!muted.includes(key)) muted.push(key);
  jar.set("tabiato_muted", JSON.stringify(muted.slice(-50)), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  revalidatePath(`/trips/${tripId}`);
}
