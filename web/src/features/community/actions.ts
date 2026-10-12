"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/guards";
import type { ActionResult } from "@/lib/types";

export async function toggleLike(tripId: string, on: boolean) {
  const { supabase, user } = await requireUser();
  if (on) await supabase.from("likes").insert({ user_id: user.id, trip_id: tripId });
  else await supabase.from("likes").delete().eq("user_id", user.id).eq("trip_id", tripId);
  revalidatePath("/community");
  revalidatePath(`/community/${tripId}`);
}

export async function toggleSave(tripId: string, on: boolean) {
  const { supabase, user } = await requireUser();
  if (on) await supabase.from("saves").insert({ user_id: user.id, trip_id: tripId });
  else await supabase.from("saves").delete().eq("user_id", user.id).eq("trip_id", tripId);
  revalidatePath("/community");
  revalidatePath(`/community/${tripId}`);
}

export async function toggleFollow(authorId: string, on: boolean, tripId: string) {
  const { supabase, user } = await requireUser();
  if (on) await supabase.from("follows").insert({ follower: user.id, followee: authorId });
  else await supabase.from("follows").delete().eq("follower", user.id).eq("followee", authorId);
  revalidatePath(`/community/${tripId}`);
}

/** Figma 23b "Use this as a starting point" — their places become your must-visits in a new plan. */
export async function startFromTrip(sourceId: string) {
  const { supabase, user } = await requireUser();
  const [{ data: src }, { data: places }, { data: me }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", sourceId).eq("is_public", true).maybeSingle(),
    supabase.from("places").select("name, lat, lng, category").eq("trip_id", sourceId).order("first_seen_at"),
    supabase.from("profiles").select("travel_style").eq("id", user.id).single(),
  ]);
  if (!src) redirect("/community");
  const len = src.start_date && src.end_date ? Math.round((Date.parse(src.end_date) - Date.parse(src.start_date)) / 86400000) + 1 : 3;
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const { data: plan } = await supabase.from("trips").insert({
    owner_id: user.id, name: src.destination?.split(",")[0] || src.name, destination: src.destination,
    start_date: day(30), end_date: day(30 + len - 1), status: "planned",
    dest_lat: src.dest_lat, dest_lng: src.dest_lng, country_code: src.country_code,
    plan_style: { pace: me?.travel_style?.pace ?? "balanced", interests: me?.travel_style?.interests ?? [], from_trip: src.name },
  }).select("id").single();
  if (!plan) redirect(`/community/${sourceId}`);
  if (places?.length) {
    await supabase.from("plan_stops").insert(places.slice(0, 20).map((p) => ({
      trip_id: plan.id, added_by: user.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, source: "user",
    })));
  }
  redirect(`/plan/${plan.id}/setup`);
}

export async function sendMessage(to: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return { error: "Write something first." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("messages").insert({ sender: user.id, recipient: to, body });
  revalidatePath(`/messages/${to}`);
  return error ? { error: "You can message friends, or people who share trips." } : { ok: true };
}

export async function markRead(from: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("sender", from).eq("recipient", user.id).is("read_at", null);
}
