import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceM } from "@/lib/geo";
import { person, type Person } from "@/lib/people";
import { signedUrls } from "@/lib/storage";
import type { Trip } from "@/lib/types";

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
export async function getCommunity(supabase: SupabaseClient, userId: string, filter: Filter, near?: { lat: number; lng: number } | null): Promise<Card[]> {
  let trips: Trip[] = [];
  if (filter === "saved") {
    const { data: s } = await supabase.from("saves").select("trip_id").eq("user_id", userId);
    const ids = (s ?? []).map((x) => x.trip_id);
    if (ids.length) trips = ((await supabase.from("trips").select("*").in("id", ids).eq("is_public", true)).data ?? []) as Trip[];
  } else {
    trips = ((await supabase.from("trips").select("*").eq("is_public", true).neq("owner_id", userId).order("created_at", { ascending: false }).limit(40)).data ?? []) as Trip[];
  }
  if (!trips.length) return [];
  const ids = trips.map((t) => t.id);

  const [{ data: likes }, { data: saves }, { data: follows }, { data: authors }, { data: places }, { data: photos }] = await Promise.all([
    supabase.from("likes").select("trip_id, user_id").in("trip_id", ids),
    supabase.from("saves").select("trip_id").eq("user_id", userId),
    supabase.from("follows").select("followee").eq("follower", userId),
    supabase.from("profiles").select("id, display_name").in("id", [...new Set(trips.map((t) => t.owner_id))]),
    supabase.from("places").select("trip_id, name, first_seen_at").in("trip_id", ids).order("first_seen_at"),
    supabase.from("photos").select("trip_id, storage_path").in("trip_id", ids).order("created_at"),
  ]);
  const cover = new Map<string, string>();
  for (const t of trips) if (t.cover_path) cover.set(t.id, t.cover_path);
  for (const p of photos ?? []) if (!cover.has(p.trip_id)) cover.set(p.trip_id, p.storage_path);
  const urls = await signedUrls(supabase, [...cover.values()]);
  const who = new Map((authors ?? []).map((a) => [a.id, person(a.id, a.display_name)]));
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
