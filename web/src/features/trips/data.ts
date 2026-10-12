import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { centroid } from "@/lib/geo";
import { person, type Person } from "@/lib/people";
import { signedUrls } from "@/lib/storage";
import { myr } from "@/lib/currency";
import { computeFacts } from "@/features/memory-book/facts";
import type { Comment, Expense, Member, Note, Photo, Place, Rating, Trip } from "@/lib/types";

export type TripSummary = {
  trip: Trip;
  memories: number;
  places: number;
  center: { lat: number; lng: number } | null;
  coverUrl: string | null;
  members: Person[];
};

async function peopleById(supabase: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, Person>();
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, person(p.id, p.display_name, p.avatar_url)]));
}

async function summarise(supabase: SupabaseClient, trips: Trip[]): Promise<TripSummary[]> {
  const ids = trips.map((t) => t.id);
  if (!ids.length) return [];
  const [{ data: places }, { data: photos }, { data: members }] = await Promise.all([
    supabase.from("places").select("trip_id, lat, lng").in("trip_id", ids),
    supabase.from("photos").select("trip_id, storage_path, created_at").in("trip_id", ids).order("created_at"),
    supabase.from("trip_members").select("trip_id, user_id, status").in("trip_id", ids).eq("status", "joined"),
  ]);
  const people = await peopleById(supabase, (members ?? []).map((m) => m.user_id));
  const firstPhoto = new Map<string, string>();
  for (const t of trips) if (t.cover_path) firstPhoto.set(t.id, t.cover_path); // a chosen cover wins
  for (const p of photos ?? []) if (!firstPhoto.has(p.trip_id)) firstPhoto.set(p.trip_id, p.storage_path);
  const urls = await signedUrls(supabase, [...firstPhoto.values()]);

  return trips.map((trip) => {
    const ps = (places ?? []).filter((p) => p.trip_id === trip.id);
    const cover = firstPhoto.get(trip.id);
    return {
      trip,
      memories: (photos ?? []).filter((p) => p.trip_id === trip.id).length,
      places: ps.length,
      center: ps.length ? centroid(ps) : null,
      coverUrl: cover ? urls[cover] ?? null : null,
      members: (members ?? [])
        .filter((m) => m.trip_id === trip.id)
        .map((m) => people.get(m.user_id))
        .filter((p): p is Person => Boolean(p)),
    };
  });
}

/** Trips the user has joined. Public trips of other people are excluded on purpose. */
export async function getMyTrips(supabase: SupabaseClient, userId: string) {
  const { data: rows } = await supabase
    .from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("trips").select("*").in("id", ids).order("created_at", { ascending: false });
  const trips = (data ?? []) as Trip[];
  // ongoing first, then finished, then planned
  const rank = { ongoing: 0, finished: 1, planned: 2 } as const;
  trips.sort((a, b) => rank[a.status] - rank[b.status]);
  return summarise(supabase, trips);
}

export async function getPublicTrips(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("trips").select("*").eq("is_public", true).neq("owner_id", userId)
    .order("created_at", { ascending: false }).limit(20);
  return summarise(supabase, (data ?? []) as Trip[]);
}

export type Invite = { trip: Trip; invitedBy: string };

export async function getInvites(supabase: SupabaseClient, userId: string): Promise<Invite[]> {
  const { data: rows } = await supabase
    .from("trip_members").select("trip_id, invited_by").eq("user_id", userId).eq("status", "invited");
  if (!rows?.length) return [];
  const { data: trips } = await supabase.from("trips").select("*").in("id", rows.map((r) => r.trip_id));
  const people = await peopleById(supabase, rows.map((r) => r.invited_by).filter(Boolean) as string[]);
  return (trips ?? []).map((t) => ({
    trip: t as Trip,
    invitedBy: people.get(rows.find((r) => r.trip_id === t.id)?.invited_by ?? "")?.name ?? "A friend",
  }));
}

export type PlaceSummary = Place & { photos: number; rating: number | null; spend: number };

export async function getTrip(supabase: SupabaseClient, tripId: string, userId: string) {
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return null;

  const [{ data: members }, { data: places }, { data: photos }, { data: ratings }, { data: expenses }, { data: book }] =
    await Promise.all([
      supabase.from("trip_members").select("*").eq("trip_id", tripId),
      supabase.from("places").select("*").eq("trip_id", tripId).order("first_seen_at", { nullsFirst: false }),
      supabase.from("photos").select("*").eq("trip_id", tripId).order("taken_at", { nullsFirst: false }),
      supabase.from("ratings").select("*").eq("trip_id", tripId),
      supabase.from("expenses").select("*").eq("trip_id", tripId),
      supabase.from("memory_books").select("trip_id").eq("trip_id", tripId).maybeSingle(),
    ]);

  const m = (members ?? []) as Member[];
  const people = await peopleById(supabase, m.map((x) => x.user_id));
  const me = m.find((x) => x.user_id === userId) ?? null;
  const ph = (photos ?? []) as Photo[];

  const placeSummaries: PlaceSummary[] = ((places ?? []) as Place[]).map((p) => {
    const rs = ((ratings ?? []) as Rating[]).filter((r) => r.place_id === p.id).map((r) => r.stars);
    return {
      ...p,
      photos: ph.filter((x) => x.place_id === p.id).length,
      rating: rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null,
      spend: ((expenses ?? []) as Expense[]).filter((e) => e.place_id === p.id).reduce((s, e) => s + myr(e), 0),
    };
  });

  const thumbs = new Map<string, string>();
  for (const p of ph) if (p.place_id && !thumbs.has(p.place_id)) thumbs.set(p.place_id, p.storage_path);
  const unplaced = ph.filter((p) => p.location_source === "none");
  const urls = await signedUrls(supabase, [...thumbs.values(), ...unplaced.map((p) => p.storage_path)]);

  return {
    trip: trip as Trip,
    me,
    isOwner: (trip as Trip).owner_id === userId,
    isMember: me?.status === "joined",
    members: m.map((x) => ({ ...x, person: people.get(x.user_id) ?? person(x.user_id, null) })),
    places: placeSummaries,
    thumbs: Object.fromEntries([...thumbs.entries()].map(([pid, path]) => [pid, urls[path] ?? null])),
    photoCount: ph.length,
    unplaced: unplaced.map((p) => ({ id: p.id, url: urls[p.storage_path] ?? null })),
    hasBook: Boolean(book),
    coverUrl: (trip as Trip).cover_path ? (await signedUrls(supabase, [(trip as Trip).cover_path!]))[(trip as Trip).cover_path!] ?? null : null,
    // one pattern from the trip's own records for the timeline (Figma 09); none if the data is thin
    observation: computeFacts({
      places: placeSummaries.map((p) => ({ id: p.id, name: p.name, category: p.category, first_seen_at: p.first_seen_at })),
      photos: ph.map((x) => ({ place_id: x.place_id, taken_at: x.taken_at, uploaded_by: x.uploaded_by })),
      ratings: ((ratings ?? []) as Rating[]).map((r) => ({ place_id: r.place_id, stars: r.stars })),
      expenses: ((expenses ?? []) as Expense[]).map((e) => ({ amount: myr(e), label: e.label, place_id: e.place_id })),
      people: Object.fromEntries(m.map((x) => [x.user_id, people.get(x.user_id)?.name ?? "Someone"])),
    }).observations[0] ?? null,
  };
}

export async function getPlace(supabase: SupabaseClient, placeId: string, userId: string) {
  const { data: place } = await supabase.from("places").select("*").eq("id", placeId).maybeSingle();
  if (!place) return null;
  const p = place as Place;
  const [{ data: trip }, { data: photos }, { data: expenses }, { data: ratings }, { data: notes }, { data: comments }] =
    await Promise.all([
      supabase.from("trips").select("*").eq("id", p.trip_id).single(),
      supabase.from("photos").select("*").eq("place_id", placeId).order("taken_at"),
      supabase.from("expenses").select("*").eq("place_id", placeId).order("created_at"),
      supabase.from("ratings").select("*").eq("place_id", placeId),
      supabase.from("notes").select("*").eq("place_id", placeId),
      supabase.from("comments").select("*").eq("place_id", placeId).order("created_at"),
    ]);
  const { data: there } = await supabase.from("place_people").select("user_id").eq("place_id", placeId);
  const ph = (photos ?? []) as Photo[];
  const cs = (comments ?? []) as Comment[];
  const ns = (notes ?? []) as Note[];
  const people = await peopleById(supabase, [...ph.map((x) => x.uploaded_by), ...cs.map((c) => c.user_id), ...ns.map((n) => n.user_id), ...(there ?? []).map((t) => t.user_id)]);
  const urls = await signedUrls(supabase, ph.map((x) => x.storage_path));
  const rs = (ratings ?? []) as Rating[];
  const { data: membership } = await supabase
    .from("trip_members").select("status").eq("trip_id", p.trip_id).eq("user_id", userId).maybeSingle();

  return {
    place: p,
    trip: trip as Trip,
    isMember: membership?.status === "joined",
    photos: ph.map((x) => ({ ...x, url: urls[x.storage_path] ?? null, by: people.get(x.uploaded_by)?.name ?? "Someone" })),
    expenses: (expenses ?? []) as Expense[],
    myRating: rs.find((r) => r.user_id === userId)?.stars ?? null,
    avgRating: rs.length ? Math.round((rs.reduce((s, r) => s + r.stars, 0) / rs.length) * 10) / 10 : null,
    myNote: ns.find((n) => n.user_id === userId) ?? null,
    otherNotes: ns.filter((n) => n.user_id !== userId && n.body.trim()).map((n) => ({ ...n, by: people.get(n.user_id)?.name ?? "Someone" })),
    comments: cs.map((c) => ({ ...c, person: people.get(c.user_id) ?? person(c.user_id, null) })),
    with: (there ?? []).map((t) => people.get(t.user_id)).filter((p): p is Person => Boolean(p)),
  };
}
