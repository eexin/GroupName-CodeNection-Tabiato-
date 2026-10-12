import { centroid, distanceM } from "@/lib/geo";

/**
 * Groups photos into places. Pure function — no database — so it is unit-testable.
 *
 * A photo joins an existing place when it is within `radiusM` metres of the place AND within
 * `gapHours` of the place's time window. Otherwise it starts a new place. Photos without
 * coordinates are left alone: the user places them by hand. We never guess.
 */

export type ClusterPhoto = { id: string; lat: number | null; lng: number | null; takenAt: number | null; placeId: string | null };
export type ClusterPlace = { id: string; lat: number; lng: number; first: number | null; last: number | null };

export type ClusterResult = {
  assignments: { photoId: string; placeId: string }[];
  newPlaces: ClusterPlace[];
  updatedPlaces: ClusterPlace[];   // every place whose centroid or time window changed
};

export function clusterPhotos(
  photos: ClusterPhoto[],
  existing: ClusterPlace[],
  newId: () => string,
  opts = { radiusM: 150, gapHours: 3 },
): ClusterResult {
  const gapMs = opts.gapHours * 3600 * 1000;
  const places = existing.map((p) => ({ ...p, isNew: false }));
  const members = new Map<string, { lat: number; lng: number; t: number | null }[]>();

  // seed each existing place with the photos already assigned to it
  for (const p of photos) {
    if (p.placeId && p.lat !== null && p.lng !== null) {
      const list = members.get(p.placeId) ?? [];
      list.push({ lat: p.lat, lng: p.lng, t: p.takenAt });
      members.set(p.placeId, list);
    }
  }

  const pending = photos
    .filter((p) => !p.placeId && p.lat !== null && p.lng !== null)
    .sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0));

  const assignments: ClusterResult["assignments"] = [];
  const touched = new Set<string>();

  for (const photo of pending) {
    const lat = photo.lat as number;
    const lng = photo.lng as number;

    let best: (typeof places)[number] | null = null;
    let bestD = Infinity;
    for (const place of places) {
      const d = distanceM(lat, lng, place.lat, place.lng);
      if (d > opts.radiusM) continue;
      if (photo.takenAt !== null && place.first !== null && place.last !== null) {
        const outside = photo.takenAt < place.first - gapMs || photo.takenAt > place.last + gapMs;
        if (outside) continue;
      }
      if (d < bestD) { best = place; bestD = d; }
    }

    if (!best) {
      best = { id: newId(), lat, lng, first: photo.takenAt, last: photo.takenAt, isNew: true };
      places.push(best);
    }

    const list = members.get(best.id) ?? [];
    list.push({ lat, lng, t: photo.takenAt });
    members.set(best.id, list);

    // keep the place's centre and time window current so the next photo compares correctly
    const c = centroid(list);
    best.lat = c.lat;
    best.lng = c.lng;
    const times = list.map((m) => m.t).filter((t): t is number => t !== null);
    best.first = times.length ? Math.min(...times) : null;
    best.last = times.length ? Math.max(...times) : null;

    assignments.push({ photoId: photo.id, placeId: best.id });
    touched.add(best.id);
  }

  const strip = ({ id, lat, lng, first, last }: ClusterPlace) => ({ id, lat, lng, first, last });
  return {
    assignments,
    newPlaces: places.filter((p) => p.isNew).map(strip),
    updatedPlaces: places.filter((p) => !p.isNew && touched.has(p.id)).map(strip),
  };
}
