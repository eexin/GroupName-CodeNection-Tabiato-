import { z } from "zod";

/**
 * Figma 29, the destination field. The planner works around one centre point (places within
 * 15 km), so a whole country or a large island can't be planned as typed: its centre is
 * somewhere in the middle (Bali's is in the mountains, Japan's in Gunma). Ato asks for a city
 * instead and offers real ones. Pure — the map lookups live in osm.ts — so it is unit-tested.
 */

/** Area types that can be too big to plan around one point. A city is never too big. */
const AREA_TYPES = new Set(["country", "state", "region", "province", "archipelago", "continent", "island", "state_district"]);
/** Wider than this (in km) and the centre is too far from most of the area to plan from. */
export const MAX_AREA_KM = 120;

export type Box = { south: number; north: number; west: number; east: number };

/** Nominatim's bounding box, as [south, north, west, east] strings → a box and its size in km. */
export function boxFromNominatim(bb: string[] | undefined, lat: number): { box: Box; km: number } | null {
  if (!bb || bb.length !== 4) return null;
  const [south, north, west, east] = bb.map(Number);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  const km = Math.max((north - south) * 111, (east - west) * 111 * Math.cos((lat * Math.PI) / 180));
  return { box: { south, north, west, east }, km: Math.round(km) };
}

/**
 * Japan, Bali, Hokkaido → too big; Tokyo (a city, even though its box reaches islands 1,000 km
 * away), Singapore, Hong Kong, Penang, Phuket → fine.
 */
export function isTooBig(kind: string | null | undefined, km: number | null | undefined): boolean {
  return Boolean(kind && AREA_TYPES.has(kind) && (km ?? 0) > MAX_AREA_KM);
}

export const citiesSchema = z.object({
  cities: z.array(z.object({ name: z.string().min(2).max(60) })).max(8),
});

export const CITIES_SYSTEM = `You are Ato, a goldfish travel planner. The traveller typed a whole country or region. Suggest the 4 cities in it that visitors most often base a trip in.
- Real cities or towns only, each inside the given area, with their common English name as on maps.
- Order them by how popular they are with visitors.
Return JSON only: {"cities":[{"name":string}]}`;

export function citiesPrompt(area: string) {
  return JSON.stringify({ area });
}

const inside = (lat: number, lng: number, b: Box) => lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;

/** A suggested city is kept only if the map found it, it is a city-sized place, and it lies inside the area. */
export function keepCity(
  hit: { lat: number; lng: number; kind: string | null; km: number | null; countryCode: string | null } | null,
  area: { box: Box; countryCode: string | null },
): boolean {
  if (!hit) return false;
  if (isTooBig(hit.kind, hit.km)) return false;
  if (area.countryCode && hit.countryCode && area.countryCode !== hit.countryCode) return false;
  return inside(hit.lat, hit.lng, area.box);
}
