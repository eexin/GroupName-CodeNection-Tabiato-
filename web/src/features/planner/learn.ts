import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { learnFromHistory } from "@/features/planner/itinerary";

/** Reads YOUR ratings from YOUR finished trips — the input to the memory → planning loop. */
export async function learnForUser(supabase: SupabaseClient, userId: string) {
  const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  if (!ids.length) return learnFromHistory({ ratings: [], days: [] });
  const { data: trips } = await supabase.from("trips").select("id").in("id", ids).eq("status", "finished");
  const done = (trips ?? []).map((t) => t.id);
  if (!done.length) return learnFromHistory({ ratings: [], days: [] });

  const [{ data: places }, { data: ratings }] = await Promise.all([
    supabase.from("places").select("id, trip_id, category, first_seen_at").in("trip_id", done),
    supabase.from("ratings").select("place_id, stars").in("trip_id", done).eq("user_id", userId),
  ]);
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));
  const stars = new Map((ratings ?? []).map((r) => [r.place_id, r.stars as number]));

  const dayMap = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const p of places ?? []) {
    if (!p.first_seen_at) continue;
    const key = `${p.trip_id}:${String(p.first_seen_at).slice(0, 10)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const s = stars.get(p.id);
    if (s !== undefined) dayMap.set(key, [...(dayMap.get(key) ?? []), s]);
  }
  return learnFromHistory({
    ratings: (ratings ?? []).map((r) => ({ category: placeById.get(r.place_id)?.category ?? null, stars: r.stars })),
    days: [...counts.entries()].map(([k, n]) => {
      const xs = dayMap.get(k);
      return { stops: n, rating: xs?.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
    }),
  });
}
