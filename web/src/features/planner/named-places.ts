import { z } from "zod";
import { distanceM } from "@/lib/geo";
import type { Category } from "@/lib/categories";
import type { Candidate } from "@/features/planner/itinerary";

/**
 * The backup source of real places for the planner, used only when Overpass (OpenStreetMap's
 * place search) returns nothing — its free servers are often too busy to answer.
 *
 * Ato names well-known places for the destination, and code keeps a name only if OpenStreetMap's
 * address search (Nominatim) finds it within reach of the destination. So the planner still only
 * ever uses places that exist on the map, with the map's own name and coordinates. Pure — the
 * network calls live in osm.ts — so it is unit-tested.
 */

/** How far from the destination centre a named place may be; matches the shortlist's radius. */
export const NAMED_MAX_KM = 15;
/** How many names to ask for. Each costs one Nominatim lookup, which allows one per second. */
export const NAMED_COUNT = 16;

export const namedSchema = z.object({
  places: z.array(z.object({
    name: z.string().min(2).max(80),
    kind: z.string().optional(),
  })).max(30),
});
export type Named = z.infer<typeof namedSchema>["places"][number];

export const NAMED_SYSTEM = `You are Ato, a goldfish travel planner who knows cities well.
List ${NAMED_COUNT} well-known, real places a visitor to the destination would enjoy, all inside the city or within ${NAMED_MAX_KM} km of its centre.
- Use each place's common English name exactly as it appears on maps, without the city name.
- About half: sights (temples, shrines, museums, parks, gardens, viewpoints, markets, shopping streets).
- About half: specific, famous places to eat (named restaurants, food halls, food markets) — never a dish name.
- No hotels, no airports, no train stations, no chain restaurants, nothing that has closed.
- Skip the places listed in "skip"; the traveller already has them.
Return JSON only: {"places":[{"name":string,"kind":"culture"|"nature"|"food"|"shopping"|"other"}]}`;

export function namedPrompt(input: { destination: string; interests: string[]; skip: string[] }) {
  return JSON.stringify({ destination: input.destination, interests: input.interests, skip: input.skip });
}

const KINDS: Category[] = ["culture", "nature", "food", "shopping", "other"];

/** Unique names in the order Ato gave them, minus the traveller's own places. */
export function namesToCheck(places: Named[], skip: string[]): Named[] {
  const seen = new Set(skip.map((s) => s.trim().toLowerCase()));
  const out: Named[] = [];
  for (const p of places) {
    const key = p.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: p.name.trim(), kind: p.kind });
  }
  return out.slice(0, NAMED_COUNT);
}

export type MapHit = { name: string; lat: number; lng: number; category: Category; type?: string; ref: string };

/** Map tags that only say "something to see"; for these, Ato's kind (shopping street, market…) is more useful. */
const VAGUE_TYPES = new Set(["attraction", "yes", "landmark", "information"]);

/**
 * The map's answer for one name → a planner candidate, or null if the map found nothing near the
 * destination. Name and coordinates come from the map, never from the model.
 */
export function toCandidate(named: Named, hits: MapHit[], center: { lat: number; lng: number }): Candidate | null {
  const hit = hits.find((h) => distanceM(center.lat, center.lng, h.lat, h.lng) / 1000 <= NAMED_MAX_KM);
  if (!hit) return null;
  const kind = KINDS.find((k) => k === named.kind?.toLowerCase());
  // the map's category wins when it is specific (a temple, a park, a restaurant); Ato's kind fills
  // in when the map has none or only says "attraction" — that is how a shopping street ends up "culture"
  const vague = hit.category === "other" || VAGUE_TYPES.has(hit.type ?? "");
  const category: Category = vague && kind ? kind : hit.category;
  return { ref: hit.ref, name: hit.name || named.name, lat: hit.lat, lng: hit.lng, category, notable: true };
}
