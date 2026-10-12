import "server-only";
import { myr } from "@/lib/currency";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { computeFacts } from "@/features/memory-book/facts";

/** Travel insights across every trip the user has joined. Numbers in code; one sentence from Ato. */
export async function getInsights(supabase: SupabaseClient, userId: string) {
  const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  if (!ids.length) return null;

  const [{ data: places }, { data: photos }, { data: ratings }, { data: expenses }] = await Promise.all([
    supabase.from("places").select("id, name, category, first_seen_at").in("trip_id", ids),
    supabase.from("photos").select("place_id, taken_at, uploaded_by").in("trip_id", ids),
    supabase.from("ratings").select("place_id, stars").in("trip_id", ids).eq("user_id", userId),
    supabase.from("expenses").select("amount, label, place_id, currency, amount_myr").in("trip_id", ids),
  ]);

  const facts = computeFacts({ places: places ?? [], photos: photos ?? [], ratings: ratings ?? [], expenses: (expenses ?? []).map((e) => ({ ...e, amount: myr(e) })), people: {} });

  // what you rate highest, by category
  const byCat = new Map<Category, number[]>();
  for (const p of facts.days.flatMap((d) => d.places)) if (p.rating !== null) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p.rating]);
  const ratedCategories = [...byCat.entries()]
    .map(([c, rs]) => ({ label: CATEGORY_LABEL[c], rating: Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 }))
    .sort((a, b) => b.rating - a.rating);

  // places you keep going back to (same name across trips)
  const counts = new Map<string, number>();
  for (const p of places ?? []) if (p.name !== "Unnamed place") counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  const favourites = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const summary = await aiJSON(
    "insight",
    `You are Ato, a warm goldfish. In ONE sentence under 25 words, give the traveller one practical suggestion for their next trip, based only on these facts. Return JSON {"line": string}.`,
    JSON.stringify({ travelType: facts.travelType, observations: facts.observations, ratedCategories, spend: facts.spendByCategory }),
    z.object({ line: z.string().max(200) }),
  );

  return {
    trips: ids.length,
    memories: (photos ?? []).length,
    facts,
    ratedCategories,
    favourites,
    line: summary?.line ?? facts.observations[0] ?? null,
  };
}
