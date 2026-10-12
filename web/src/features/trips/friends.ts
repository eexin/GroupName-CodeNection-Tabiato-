import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { person, type Person } from "@/lib/people";

/** Accepted friends of the signed-in user. */
export async function getFriends(supabase: SupabaseClient, userId: string): Promise<Person[]> {
  const { data } = await supabase.from("friendships").select("requester, addressee").eq("status", "accepted");
  const ids = (data ?? []).map((f) => (f.requester === userId ? f.addressee : f.requester));
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return (profiles ?? []).map((p) => person(p.id, p.display_name));
}
