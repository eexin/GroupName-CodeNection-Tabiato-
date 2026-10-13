import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Learned } from "@/features/planner/itinerary";
import { gatherHistory } from "@/features/planner/history";
import { asLearned, blendStyles, learnStyle } from "@/features/planner/style";

/**
 * The memory → planning loop. Reads YOUR finished trips and learns your style (style.ts), and
 * keeps a copy on your profile (travel_style.learned) so a group plan can blend you in: other
 * people's past trips are private to them, but the style learned from them is not.
 */
export async function learnForUser(supabase: SupabaseClient, userId: string): Promise<Learned> {
  const learned = learnStyle(await gatherHistory(supabase, userId));
  await saveLearned(supabase, userId, learned);
  return learned;
}

/** Writes the style to the profile, keeping what the traveller told us at onboarding. Skips an unchanged style. */
async function saveLearned(supabase: SupabaseClient, userId: string, learned: Learned) {
  const { data: me } = await supabase.from("profiles").select("travel_style").eq("id", userId).maybeSingle();
  const style = (me?.travel_style ?? {}) as Record<string, unknown>;
  const before = asLearned(style.learned);
  // jsonb reorders keys, so compare with sorted keys
  if (before && stable({ ...before, updated_at: undefined }) === stable(learned)) return;
  await supabase.from("profiles").update({ travel_style: { ...style, learned: { ...learned, updated_at: new Date().toISOString() } } }).eq("id", userId);
}

const stable = (x: unknown): string => JSON.stringify(x, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);

/** The saved style, without recomputing — another member's, for blending into a group plan. */
export function savedStyle(travelStyle: unknown): Learned | null {
  return asLearned((travelStyle as { learned?: unknown } | null)?.learned);
}

/**
 * The style a plan is built with: yours, fresh, blended with every other joined member's saved
 * style. A solo plan is just yours.
 */
export async function learnForTrip(supabase: SupabaseClient, tripId: string, userId: string): Promise<Learned> {
  const [mine, { data: members }] = await Promise.all([
    learnForUser(supabase, userId),
    supabase.from("trip_members").select("user_id").eq("trip_id", tripId).eq("status", "joined"),
  ]);
  const others = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId);
  if (!others.length) return mine;
  const { data: profiles } = await supabase.from("profiles").select("id, display_name, travel_style").in("id", [userId, ...others]);
  // the whole display name: "Ee Xin" is a given name, not "Ee" plus a surname
  const first = (id: string) => (profiles ?? []).find((p) => p.id === id)?.display_name?.trim() || "Someone";
  return blendStyles([
    { name: first(userId), style: mine.evidence?.places ? mine : null },
    ...others.map((id) => ({ name: first(id), style: savedStyle((profiles ?? []).find((p) => p.id === id)?.travel_style) })),
  ]);
}
