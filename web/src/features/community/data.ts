import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceM } from "@/lib/geo";
import { person, type Person, shortName } from "@/lib/people";
import { signedUrls } from "@/lib/storage";
import type { Trip } from "@/lib/types";
import { placeName } from "@/features/community/trending";

export type Filter = "foryou" | "nearby" | "budget" | "saved";

export type Card = {
  trip: Trip; author: Person; coverUrl: string | null; route: string; days: number;
  spend: number | null; likes: number; liked: boolean; saved: boolean;
};

const daysOf = (t: Trip) => (t.start_date && t.end_date ? Math.round((Date.parse(t.end_date) - Date.parse(t.start_date)) / 86400000) + 1 : 1);

/** Spend totals a public trip has chosen to share (RLS-enforced via public_trip_spend). */
export async function sharedSpend(supabase: SupabaseClient, tripId: string) {
  const { data } = await supabase.rpc("public_trip_spend", { t: tripId });
  const rows = ((data ?? []) as { category: string; amount: number | null }[]).filter((r) => r.amount != null);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return { total, rows: rows.map((r) => ({ category: r.category, amount: Number(r.amount), share: total ? Number(r.amount) / total : 0 })).sort((a, b) => b.amount - a.amount) };
}

/** Figma 23 — public trips, with For you / Nearby / Budget / Saved. */
export async function getCommunity(supabase: SupabaseClient, userId: string, filter: Filter, near?: { lat: number; lng: number } | null, dest?: string | null): Promise<Card[]> {
  let trips: Trip[] = [];
  if (filter === "saved") {
    const { data: s } = await supabase.from("saves").select("trip_id").eq("user_id", userId);
    const ids = (s ?? []).map((x) => x.trip_id);
    if (ids.length) trips = ((await supabase.from("trips").select("*").in("id", ids).eq("is_public", true)).data ?? []) as Trip[];
  } else {
    trips = ((await supabase.from("trips").select("*").eq("is_public", true).neq("owner_id", userId).order("created_at", { ascending: false }).limit(40)).data ?? []) as Trip[];
  }
  if (dest) trips = trips.filter((t) => placeName(t).toLowerCase() === dest.toLowerCase());
  if (!trips.length) return [];
  const ids = trips.map((t) => t.id);

  const [{ data: likes }, { data: saves }, { data: follows }, { data: authors }, { data: places }, { data: photos }] = await Promise.all([
    supabase.from("likes").select("trip_id, user_id").in("trip_id", ids),
    supabase.from("saves").select("trip_id").eq("user_id", userId),
    supabase.from("follows").select("followee").eq("follower", userId),
    supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...new Set(trips.map((t) => t.owner_id))]),
    supabase.from("places").select("trip_id, name, first_seen_at").in("trip_id", ids).order("first_seen_at"),
    supabase.from("photos").select("trip_id, storage_path").in("trip_id", ids).order("created_at"),
  ]);
  const cover = new Map<string, string>();
  for (const t of trips) if (t.cover_path) cover.set(t.id, t.cover_path);
  for (const p of photos ?? []) if (!cover.has(p.trip_id)) cover.set(p.trip_id, p.storage_path);
  const urls = await signedUrls(supabase, [...cover.values()]);
  const who = new Map((authors ?? []).map((a) => [a.id, person(a.id, a.display_name, a.avatar_url)]));
  const followed = new Set((follows ?? []).map((f) => f.followee));
  const savedSet = new Set((saves ?? []).map((s) => s.trip_id));
  const spends = await Promise.all(trips.map((t) => sharedSpend(supabase, t.id)));

  let cards: Card[] = trips.map((t, i) => {
    const ps = (places ?? []).filter((p) => p.trip_id === t.id);
    return {
      trip: t, author: who.get(t.owner_id) ?? person(t.owner_id, null),
      coverUrl: cover.has(t.id) ? urls[cover.get(t.id)!] ?? null : null,
      route: ps.length > 1 ? `${ps[0].name} → ${ps[ps.length - 1].name}` : t.destination ?? "",
      days: daysOf(t), spend: spends[i]?.total ?? null,
      likes: (likes ?? []).filter((l) => l.trip_id === t.id).length,
      liked: (likes ?? []).some((l) => l.trip_id === t.id && l.user_id === userId),
      saved: savedSet.has(t.id),
    };
  });

  if (filter === "foryou") cards.sort((a, b) => Number(followed.has(b.trip.owner_id)) - Number(followed.has(a.trip.owner_id)) || b.likes - a.likes);
  if (filter === "budget") cards = cards.filter((c) => c.spend).sort((a, b) => a.spend! / a.days - b.spend! / b.days);
  if (filter === "nearby" && near) {
    cards = cards.filter((c) => c.trip.dest_lat != null)
      .sort((a, b) => distanceM(near.lat, near.lng, a.trip.dest_lat!, a.trip.dest_lng!) - distanceM(near.lat, near.lng, b.trip.dest_lat!, b.trip.dest_lng!));
  }
  return cards;
}

export type Activity = { who: Person; text: string; href: string; at: string };

/**
 * "Happening now": the latest likes, follows and newly shared trips across Community — what
 * other travellers are doing, newest first. Only public trips and public follows are read, so
 * RLS already limits it to what anyone may see.
 */
export async function getActivity(supabase: SupabaseClient, userId: string, max = 4): Promise<Activity[]> {
  const [{ data: likes }, { data: follows }, { data: fresh }] = await Promise.all([
    supabase.from("likes").select("user_id, trip_id, created_at").neq("user_id", userId).order("created_at", { ascending: false }).limit(12),
    supabase.from("follows").select("follower, followee, created_at").neq("follower", userId).order("created_at", { ascending: false }).limit(8),
    supabase.from("trips").select("id, owner_id, name, created_at").eq("is_public", true).neq("owner_id", userId).order("created_at", { ascending: false }).limit(6),
  ]);
  const tripIds = [...new Set((likes ?? []).map((l) => l.trip_id))];
  const { data: liked } = tripIds.length
    ? await supabase.from("trips").select("id, name, owner_id").in("id", tripIds).eq("is_public", true)
    : { data: [] as { id: string; name: string; owner_id: string }[] };
  const tripName = new Map((liked ?? []).map((t) => [t.id, t] as const));
  const people = [...new Set([...(likes ?? []).map((l) => l.user_id), ...(follows ?? []).flatMap((f) => [f.follower, f.followee]), ...(fresh ?? []).map((t) => t.owner_id)])];
  const { data: profiles } = people.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url, username").in("id", people)
    : { data: [] as { id: string; display_name: string; avatar_url: string | null; username: string | null }[] };
  const who = new Map((profiles ?? []).map((p) => [p.id, person(p.id, p.display_name, p.avatar_url)]));
  const handle = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const first = (id: string) => shortName(who.get(id)?.name);

  const items: Activity[] = [
    ...(fresh ?? []).map((t) => ({ who: who.get(t.owner_id) ?? person(t.owner_id, null), text: `shared ${t.name}`, href: `/community/${t.id}`, at: t.created_at })),
    ...(likes ?? []).filter((l) => tripName.has(l.trip_id)).map((l) => {
      const t = tripName.get(l.trip_id)!;
      return { who: who.get(l.user_id) ?? person(l.user_id, null), text: `liked ${t.owner_id === userId ? "your trip" : `${first(t.owner_id)}'s ${t.name}`}`, href: `/community/${t.id}`, at: l.created_at };
    }),
    ...(follows ?? []).map((f) => ({ who: who.get(f.follower) ?? person(f.follower, null), text: `started following ${f.followee === userId ? "you" : first(f.followee)}`, href: handle.get(f.follower) ? `/u/${handle.get(f.follower)}` : "/community", at: f.created_at })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
}
