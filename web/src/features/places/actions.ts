"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/guards";
import type { ActionResult } from "@/lib/types";
import { aiJSON } from "@/lib/ai";
import { CURRENCIES } from "@/lib/currency";
import { toMYR } from "@/lib/fx";
import { formatTime } from "@/lib/time";

const done = (placeId: string): ActionResult => {
  revalidatePath(`/places/${placeId}`);
  return { ok: true };
};

export async function setRating(placeId: string, tripId: string, stars: number): Promise<ActionResult> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: "Pick between 1 and 5 stars." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("ratings")
    .upsert({ place_id: placeId, trip_id: tripId, user_id: user.id, stars, updated_at: new Date().toISOString() });
  return error ? { error: "Couldn't save your rating." } : done(placeId);
}

export async function saveNote(placeId: string, tripId: string, body: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("notes").upsert({
    place_id: placeId, trip_id: tripId, user_id: user.id, body: body.slice(0, 2000),
    ai_drafted: false, updated_at: new Date().toISOString(),
  });
  return error ? { error: "Couldn't save your note." } : done(placeId);
}

export async function addComment(placeId: string, tripId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("comments").insert({ place_id: placeId, trip_id: tripId, user_id: user.id, body: body.slice(0, 2000) });
  return error ? { error: "Only people on this trip can comment." } : done(placeId);
}

export async function renamePlace(placeId: string, name: string): Promise<ActionResult> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "The name can't be empty." };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("places").update({ name: clean }).eq("id", placeId);
  return error ? { error: "Couldn't rename this place." } : done(placeId);
}

/** Figma 10 "Ato drafted this · tap to edit" — a first draft from the place record, never invented. */
export async function draftNote(placeId: string, tripId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const [{ data: place }, { data: photos }, { data: rating }, { data: expenses }, { data: comments }] = await Promise.all([
    supabase.from("places").select("name, category, first_seen_at, last_seen_at").eq("id", placeId).single(),
    supabase.from("photos").select("id").eq("place_id", placeId),
    supabase.from("ratings").select("stars").eq("place_id", placeId).eq("user_id", user.id).maybeSingle(),
    supabase.from("expenses").select("label, amount, currency").eq("place_id", placeId),
    supabase.from("comments").select("body").eq("place_id", placeId).limit(5),
  ]);
  if (!place) return { error: "Place not found." };
  const facts = {
    place: place.name, category: place.category,
    arrived: place.first_seen_at ? formatTime(place.first_seen_at) : null,
    left: place.last_seen_at ? formatTime(place.last_seen_at) : null,
    photos: photos?.length ?? 0, your_rating: rating?.stars ?? null,
    spent_on: (expenses ?? []).map((e) => e.label).filter(Boolean),
    what_friends_said: (comments ?? []).map((c) => c.body),
  };
  const ai = await aiJSON(
    "note_draft",
    `You are Ato, writing a short first-person travel note FOR the traveller to edit. One or two sentences, under 35 words, in their voice ("I", "we"). Use ONLY these facts; if they are thin, keep it plain. Never invent food, weather, people or events. Return JSON {"note": string}.`,
    JSON.stringify(facts),
    z.object({ note: z.string().min(3).max(300) }),
  );
  const note = ai?.note ?? `${facts.photos} photos at ${place.name}${facts.arrived ? `, from ${facts.arrived}` : ""}${facts.your_rating ? ` — I gave it ${facts.your_rating}★` : ""}.`;
  const { error } = await supabase.from("notes").upsert({
    place_id: placeId, trip_id: tripId, user_id: user.id, body: note, ai_drafted: true, updated_at: new Date().toISOString(),
  });
  return error ? { error: "Couldn't save the draft." } : done(placeId);
}

/** Figma 18 "Memory details" → "Save memory". Every field is optional except the place itself. */
export async function saveMemoryDetails(placeId: string, tripId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (name) await supabase.from("places").update({ name }).eq("id", placeId);
  const stars = Number(form.get("stars"));
  if (stars >= 1 && stars <= 5) await supabase.from("ratings").upsert({ place_id: placeId, trip_id: tripId, user_id: user.id, stars, updated_at: new Date().toISOString() });
  const note = String(form.get("note") ?? "").trim();
  if (note) await supabase.from("notes").upsert({ place_id: placeId, trip_id: tripId, user_id: user.id, body: note.slice(0, 2000), ai_drafted: false, updated_at: new Date().toISOString() });
  const who = form.getAll("who").map(String);
  const amount = Number(String(form.get("amount") ?? "").replace(/,/g, ""));
  if (amount > 0 && amount <= 1_000_000) {
    const currency = CURRENCIES.includes(String(form.get("currency")) as never) ? String(form.get("currency")) : "MYR";
    // "Split equally with everyone who was there" — otherwise it's yours alone
    const sharers = form.get("split_who") === "on" && who.length ? [...new Set(who)] : [user.id];
    const { data: row } = await supabase.from("expenses").insert({ trip_id: tripId, place_id: placeId, paid_by: user.id, amount, currency,
      amount_myr: await toMYR(amount, currency), label: String(form.get("label") ?? "").trim().slice(0, 60) || null, split_count: sharers.length }).select("id").single();
    if (row) await supabase.from("expense_shares").insert(sharers.map((u) => ({ expense_id: row.id, trip_id: tripId, user_id: u })));
  }
  await supabase.from("place_people").delete().eq("place_id", placeId);
  if (who.length) await supabase.from("place_people").insert(who.map((u) => ({ place_id: placeId, trip_id: tripId, user_id: u })));
  revalidatePath(`/places/${placeId}`);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
