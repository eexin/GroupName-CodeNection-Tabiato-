"use server";

import { myr } from "@/lib/currency";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { requireUser } from "@/features/auth/guards";
import type { BookContent, BookPage } from "@/features/memory-book/types";
import { computeFacts } from "@/features/memory-book/facts";
import { formatDay, formatTime } from "@/lib/time";

const aiSchema = z.object({
  title: z.string().min(1).max(60),
  subtitle: z.string().max(140),
  closing: z.string().max(400),
  pages: z.array(z.object({ place_id: z.string(), heading: z.string().max(80), body: z.string().max(600) })).max(20),
});

const SYSTEM = `You are Ato, a warm and observant goldfish who writes travel memory books.
Write to the traveller in second person ("you").
Use ONLY the facts given. Never invent a place, person, number, time or event that is not in the facts.
For each place, write a heading (at most 7 words) and a body of 2 to 3 sentences, under 60 words.
Return JSON: {"title": string, "subtitle": string, "closing": string,
"pages": [{"place_id": string, "heading": string, "body": string}]}.
Use every place_id given, exactly once, and no others.`;

/** Builds the memory book from the trip record. Numbers come from code; the model only writes prose. */
export async function generateMemoryBook(tripId: string) {
  const { supabase } = await requireUser();

  const [{ data: trip }, { data: places }, { data: photos }, { data: ratings }, { data: expenses }, { data: members }] =
    await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase.from("places").select("id, name, category, first_seen_at").eq("trip_id", tripId),
      supabase.from("photos").select("place_id, taken_at, uploaded_by, storage_path").eq("trip_id", tripId).order("taken_at"),
      supabase.from("ratings").select("place_id, stars").eq("trip_id", tripId),
      supabase.from("expenses").select("amount, label, place_id, currency, amount_myr").eq("trip_id", tripId),
      supabase.from("trip_members").select("user_id").eq("trip_id", tripId).eq("status", "joined"),
    ]);
  if (!trip) return { error: "Trip not found." };

  const { data: profiles } = await supabase
    .from("profiles").select("id, display_name").in("id", (members ?? []).map((m) => m.user_id));
  const people = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name || "Traveller"]));

  const facts = computeFacts({
    places: places ?? [],
    photos: photos ?? [],
    ratings: ratings ?? [],
    expenses: (expenses ?? []).map((e) => ({ ...e, amount: myr(e) })),
    people,
  });

  const firstPhoto = new Map<string, string>();
  for (const p of photos ?? []) if (p.place_id && !firstPhoto.has(p.place_id)) firstPhoto.set(p.place_id, p.storage_path);

  // pages: places with photos, in the order you visited them, at most 12
  const chosen = facts.days.flatMap((d) => d.places).filter((p) => p.photos > 0).slice(0, 12);

  const ai = await aiJSON(
    "memory_book",
    SYSTEM,
    JSON.stringify({
      trip: { name: trip.name, destination: trip.destination, days: facts.totals.days },
      travellers: Object.values(people),
      places: chosen.map((p) => ({
        place_id: p.id, name: p.name, category: p.category,
        day: p.arrival ? formatDay(p.arrival) : null, arrived: p.arrival ? formatTime(p.arrival) : null,
        photos: p.photos, your_rating: p.rating, spent_rm: p.spend || null,
      })),
      observations: facts.observations,
      totals: facts.totals,
    }),
    aiSchema,
  );

  const aiPages = new Map((ai?.pages ?? []).map((p) => [p.place_id, p]));
  const pages: BookPage[] = chosen.map((p) => {
    const written = aiPages.get(p.id); // anything the model returned for an unknown id is ignored
    const bits = [`${p.photos} photo${p.photos === 1 ? "" : "s"}`];
    if (p.rating !== null) bits.push(`rated ${p.rating}★`);
    if (p.spend) bits.push(`RM ${p.spend.toFixed(0)} spent`);
    return {
      place_id: p.id,
      day: p.arrival ? formatDay(p.arrival) : "",
      heading: written?.heading || p.name,
      body: written?.body || `You arrived at ${p.name}${p.arrival ? ` at ${formatTime(p.arrival)}` : ""}. ${bits.join(", ")}.`,
      photo_path: firstPhoto.get(p.id) ?? null,
      rating: p.rating,
      category: p.category,
    };
  });

  const content: BookContent = {
    title: ai?.title || trip.name,
    subtitle: ai?.subtitle || `${facts.totals.days} days, ${facts.totals.places} places, ${facts.totals.photos} photos`,
    pages,
    observations: facts.observations,
    closing: ai?.closing || facts.observations[0] || "Every trip teaches me a little more about you.",
    totals: facts.totals,
    spendByCategory: facts.spendByCategory.map(({ label, amount, share }) => ({ label, amount, share })),
    travelType: facts.travelType,
    source: ai ? "ai" : "template",
  };

  const { error } = await supabase
    .from("memory_books")
    .upsert({ trip_id: tripId, content, model: ai ? "ai" : "template", generated_at: new Date().toISOString() });
  if (error) return { error: "Only people on this trip can write its book." };

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/book`);
  return { ok: true };
}
