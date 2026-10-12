import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { person, type Person } from "@/lib/people";

/** Figma 22c "You travelled with them": people on your trips who aren't friends yet. */
export async function travelledWith(supabase: SupabaseClient, userId: string) {
  const { data: mine } = await supabase.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const tripIds = (mine ?? []).map((m) => m.trip_id);
  if (!tripIds.length) return [] as (Person & { trip: string })[];
  const [{ data: others }, { data: trips }, { data: rel }] = await Promise.all([
    supabase.from("trip_members").select("trip_id, user_id").in("trip_id", tripIds).eq("status", "joined").neq("user_id", userId),
    supabase.from("trips").select("id, name").in("id", tripIds),
    supabase.from("friendships").select("requester, addressee"),
  ]);
  const known = new Set((rel ?? []).map((f) => (f.requester === userId ? f.addressee : f.requester)));
  const firstTrip = new Map<string, string>();
  for (const o of others ?? []) if (!known.has(o.user_id) && !firstTrip.has(o.user_id)) firstTrip.set(o.user_id, o.trip_id);
  if (!firstTrip.size) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [...firstTrip.keys()]);
  const tripName = new Map((trips ?? []).map((t) => [t.id, t.name]));
  return (profiles ?? []).slice(0, 5).map((p) => ({ ...person(p.id, p.display_name), trip: tripName.get(firstTrip.get(p.id)!) ?? "a trip" }));
}
