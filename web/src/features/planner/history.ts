import type { SupabaseClient } from "@supabase/supabase-js";
import type { History } from "@/features/planner/style";

/**
 * Reads one traveller's finished trips into the shape learnStyle needs: every place (with their
 * own rating) and every photo time. Takes the caller's client, so RLS decides what it can see;
 * the demo seed runs it with the service key to give every sample account a style.
 */
export async function gatherHistory(supabase: SupabaseClient, userId: string): Promise<History> {
  const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  if (!ids.length) return { places: [], photos: [] };
  const { data: trips } = await supabase.from("trips").select("id").in("id", ids).eq("status", "finished");
  const done = (trips ?? []).map((t) => t.id);
  if (!done.length) return { places: [], photos: [] };

  const [{ data: places }, { data: ratings }, { data: photos }] = await Promise.all([
    supabase.from("places").select("id, trip_id, category, lat, lng, first_seen_at, last_seen_at").in("trip_id", done),
    supabase.from("ratings").select("place_id, stars").in("trip_id", done).eq("user_id", userId),
    supabase.from("photos").select("trip_id, taken_at").in("trip_id", done).not("taken_at", "is", null).limit(5000),
  ]);
  const stars = new Map((ratings ?? []).map((r) => [r.place_id as string, r.stars as number]));
  return {
    places: (places ?? []).map((p) => ({ ...p, stars: stars.get(p.id) ?? null })),
    photos: (photos ?? []) as History["photos"],
  };
}
