/** Distance in metres between two lat/lng points (haversine). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function centroid(points: { lat: number; lng: number }[]) {
  const n = points.length || 1;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

/** Bounding box [[west, south], [east, north]] for fitting a map, or null when empty. */
export function bounds(points: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/** Opens the place in Google Maps (app on phones), where directions are one tap away. */
export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

type OsmAddress = Partial<Record<"suburb" | "city_district" | "district" | "neighbourhood" | "quarter" | "town" | "village" | "city" | "municipality" | "county" | "state" | "province" | "region" | "country", string>>;

/**
 * "Pudong, Shanghai, China" for a search result, instead of a house number and a street: the
 * district, the city and the country are what tell you the result is the right place.
 */
export function areaLine(address: OsmAddress | undefined, displayName = ""): string {
  if (!address) return displayName.split(",").slice(1, 3).join(",").trim();
  const district = address.suburb ?? address.city_district ?? address.district ?? address.quarter ?? address.neighbourhood;
  const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  const region = city ? undefined : address.state ?? address.province ?? address.region;
  const parts = [district, city ?? region, address.country].filter((p): p is string => Boolean(p && p.trim()));
  return [...new Set(parts)].join(", ");
}

/** Nominatim's boundingbox ["south", "north", "west", "east"] → [west, south, east, north], or undefined. */
export function bboxOf(b: string[] | undefined): [number, number, number, number] | undefined {
  if (!b || b.length !== 4) return undefined;
  const [s, n, w, e] = b.map(Number);
  return [s, n, w, e].every(Number.isFinite) && n > s && e > w ? [w, s, e, n] : undefined;
}

/** "theme_park" → "Theme park"; nothing for map tags that say nothing. */
export function kindLabel(type: string | undefined): string {
  if (!type || ["yes", "house", "residential", "unclassified", "administrative", "building"].includes(type)) return "";
  const t = type.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
