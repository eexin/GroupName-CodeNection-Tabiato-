import type { Hit } from "@/features/search/data";

/**
 * Map view of search results. Across several trips, one pin per trip (numbered with its matches),
 * because places in the same city would sit on top of each other at that zoom. Within one trip,
 * one pin per place. Pure, so it is unit-tested.
 */
export function searchPins(hits: Pick<Hit, "id" | "name" | "trip" | "lat" | "lng">[]) {
  const trips = new Map<string, typeof hits>();
  for (const h of hits) trips.set(h.trip, [...(trips.get(h.trip) ?? []), h]);
  if (trips.size <= 1) return hits.map((h) => ({ id: h.id, lat: h.lat, lng: h.lng, count: 1, label: h.name }));
  return [...trips.entries()].map(([trip, hs]) => ({
    id: hs[0].id,
    lat: hs.reduce((a, h) => a + h.lat, 0) / hs.length,
    lng: hs.reduce((a, h) => a + h.lng, 0) / hs.length,
    count: hs.length,
    label: trip,
  }));
}
