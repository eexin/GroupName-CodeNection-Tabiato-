"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/guards";
import { clusterPhotos } from "@/features/places/cluster";
import { nameUnnamedPlaces } from "@/features/places/geocode";

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null);
const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

/**
 * Groups a trip's located photos into places and names new places.
 * Call after every upload and after manual placement. Safe to call repeatedly.
 */
export async function clusterTrip(tripId: string) {
  const { supabase } = await requireUser();

  const [{ data: photos }, { data: places }] = await Promise.all([
    supabase.from("photos").select("id, lat, lng, taken_at, place_id").eq("trip_id", tripId),
    supabase.from("places").select("id, lat, lng, first_seen_at, last_seen_at").eq("trip_id", tripId),
  ]);

  const result = clusterPhotos(
    (photos ?? []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, takenAt: ms(p.taken_at), placeId: p.place_id })),
    (places ?? []).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, first: ms(p.first_seen_at), last: ms(p.last_seen_at) })),
    () => randomUUID(),
  );

  if (result.newPlaces.length) {
    await supabase.from("places").insert(
      result.newPlaces.map((p) => ({
        id: p.id, trip_id: tripId, lat: p.lat, lng: p.lng,
        first_seen_at: iso(p.first), last_seen_at: iso(p.last),
      })),
    );
  }
  for (const p of result.updatedPlaces) {
    await supabase.from("places")
      .update({ lat: p.lat, lng: p.lng, first_seen_at: iso(p.first), last_seen_at: iso(p.last) })
      .eq("id", p.id);
  }

  // one update per place rather than one per photo
  const byPlace = new Map<string, string[]>();
  for (const a of result.assignments) byPlace.set(a.placeId, [...(byPlace.get(a.placeId) ?? []), a.photoId]);
  for (const [placeId, ids] of byPlace) {
    await supabase.from("photos").update({ place_id: placeId }).in("id", ids);
  }

  await nameUnnamedPlaces(supabase, tripId);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
  const counts = new Map<string, number>();
  for (const a of result.assignments) counts.set(a.placeId, (counts.get(a.placeId) ?? 0) + 1);
  const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const { data: top } = topId ? await supabase.from("places").select("id, name, first_seen_at").eq("id", topId).single() : { data: null };
  return { places: result.newPlaces.length, photos: result.assignments.length, top: top as { id: string; name: string; first_seen_at: string | null } | null };
}

/** The user placed photos by hand — record that honestly, then regroup. */
export async function placePhotos(tripId: string, photoIds: string[], lat: number, lng: number) {
  const { supabase } = await requireUser();
  if (!photoIds.length) return { places: 0, photos: 0, top: null };
  await supabase
    .from("photos")
    .update({ lat, lng, location_source: "manual" })
    .in("id", photoIds)
    .eq("trip_id", tripId);
  return clusterTrip(tripId);
}
