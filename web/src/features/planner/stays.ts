import { z } from "zod";
import { centroid, distanceM } from "@/lib/geo";

/**
 * Where to stay and where to eat near each stop (Figma 31, below the itinerary). Pure — the map
 * lookups live in osm.ts — so it is unit-tested.
 *
 * Every hotel and restaurant comes from OpenStreetMap. Code measures how far each one is from the
 * plan; Ato only chooses among the hotels the code ranked and says why. OpenStreetMap rarely
 * records star ratings and never prices, so Ato judges the class from the hotel itself (a hostel,
 * a business chain, a luxury brand) and the app never shows a price it does not know.
 */

export type Tier = "budget" | "mid" | "luxury";
export const TIER_LABEL: Record<Tier, string> = { budget: "budget", mid: "mid-range", luxury: "luxury" };

/** A hotel or restaurant from the map. */
export type MapPlace = { ref: string; name: string; lat: number; lng: number; kind: string; stars: number | null; cuisine: string | null };
export type Stay = { ref: string; name: string; lat: number; lng: number; kind: string; stars: number | null; km: number; nearDay: number; reason: string };
export type Eat = { name: string; lat: number; lng: number; cuisine: string | null; walkMin: number };
type PlanStop = { id: string; name: string; lat: number; lng: number; day: number | null };

/**
 * The trip's own budget wins: RM per day decides the class. Without one, the traveller's profile
 * band (onboarding: budget / mid-range / luxury) does; mid-range if neither is set.
 */
export function budgetTier(tripBudget: number | null, days: number, band?: string | null): Tier {
  if (tripBudget && tripBudget > 0) {
    const perDay = tripBudget / Math.max(1, days);
    return perDay < 300 ? "budget" : perDay <= 800 ? "mid" : "luxury";
  }
  return band === "budget" || band === "luxury" ? band : "mid";
}

/** A box around some points, padded by `pad` degrees (0.01° is about 1 km). */
export function boxAround(points: { lat: number; lng: number }[], pad: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return { west: Math.min(...lngs) - pad, south: Math.min(...lats) - pad, east: Math.max(...lngs) + pad, north: Math.max(...lats) + pad };
}

export const walkMinutes = (m: number) => Math.max(1, Math.round(m / 80)); // about 4.8 km/h

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Hotels ranked by how close they are to the whole plan, with the facts Ato needs: the average
 * distance to every stop and the day whose stops are closest. Unnamed and duplicate entries go.
 */
export function rankStays(hotels: MapPlace[], stops: PlanStop[], limit = 12) {
  const placed = stops.filter((s) => s.day !== null);
  if (!placed.length) return [];
  const days = [...new Set(placed.map((s) => s.day!))];
  const dayCentres = days.map((d) => ({ day: d, ...centroid(placed.filter((s) => s.day === d)) }));
  const seen = new Set<string>();
  return hotels
    .filter((h) => h.name.trim() && !seen.has(h.name.toLowerCase()) && (seen.add(h.name.toLowerCase()), true))
    .map((h) => {
      const km = placed.reduce((sum, s) => sum + distanceM(h.lat, h.lng, s.lat, s.lng), 0) / placed.length / 1000;
      const nearDay = dayCentres.reduce((best, c) => (distanceM(h.lat, h.lng, c.lat, c.lng) < distanceM(h.lat, h.lng, best.lat, best.lng) ? c : best)).day;
      return { ...h, km: round1(km), nearDay };
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
export type RankedStay = ReturnType<typeof rankStays>[number];

export const staysSchema = z.object({
  stays: z.array(z.object({ ref: z.coerce.string(), reason: z.string().max(200) })).max(6),
});

export const STAYS_SYSTEM = (tier: Tier) => `You are Ato, a cheerful goldfish travel planner. Pick the 3 best places to stay for this trip from "hotels" only.
- The traveller wants a ${TIER_LABEL[tier]} stay. Judge each hotel's class from its name, type and stars (hostels, guest houses and simple business chains are budget; well-known chains are mid-range; famous luxury brands are luxury). Prefer ones that match; if none match, pick the closest fit.
- Prefer hotels with a small "km" (average distance to the trip's stops).
- For each pick give "reason": one sentence, at most 18 words, in Ato's voice, using its real facts (km, near_day, type). Never mention prices.
Return JSON only: {"stays":[{"ref":string,"reason":string}]}. "ref" must be a hotel ref from the list.`;

export function staysPrompt(input: { destination: string; tier: Tier; hotels: RankedStay[] }) {
  return JSON.stringify({
    destination: input.destination, wanted: TIER_LABEL[input.tier],
    hotels: input.hotels.map((h) => ({ ref: h.ref, name: h.name, type: h.kind, stars: h.stars, km: h.km, near_day: h.nearDay })),
  });
}

const BUDGET_KINDS = new Set(["hostel", "guest_house", "motel", "apartment"]);

/** Template reason when Ato is unavailable — the same facts, plainly. */
function templateReason(h: RankedStay) {
  const type = h.kind === "guest_house" ? "guest house" : h.kind;
  return `${h.stars ? `${h.stars}★ ` : ""}${type}, about ${h.km} km from your stops on average and closest to day ${h.nearDay}.`;
}

/**
 * Ato's picks, checked: only hotels from the ranked list, no repeats, at most 3. If Ato gave
 * nothing usable, code picks: the closest that fit the class by type or stars, then the closest.
 */
export function applyStays(ai: z.infer<typeof staysSchema> | null, ranked: RankedStay[], tier: Tier): Stay[] {
  const byRef = new Map(ranked.map((h) => [h.ref, h]));
  const out: Stay[] = [];
  for (const s of ai?.stays ?? []) {
    const h = byRef.get(s.ref);
    if (!h || out.some((o) => o.ref === h.ref)) continue;
    out.push({ ...h, reason: s.reason.trim() || templateReason(h) });
    if (out.length === 3) return out;
  }
  if (out.length) return out;
  const fits = (h: RankedStay) =>
    tier === "budget" ? BUDGET_KINDS.has(h.kind) || (h.stars !== null && h.stars <= 2)
    : tier === "luxury" ? h.stars !== null && h.stars >= 4
    : h.kind === "hotel" && (h.stars === null || (h.stars >= 3 && h.stars <= 4));
  const ordered = [...ranked.filter(fits), ...ranked.filter((h) => !fits(h))];
  return ordered.slice(0, 3).map((h) => ({ ...h, reason: templateReason(h) }));
}

/**
 * Up to `max` restaurants within a short walk of each stop, closest first. A restaurant is listed
 * under one stop only, and a stop that is itself a restaurant does not list itself.
 */
export function eatsNearStops(stops: PlanStop[], foods: MapPlace[], max = 3, maxM = 800): Record<string, Eat[]> {
  const used = new Set<string>();
  const out: Record<string, Eat[]> = {};
  for (const s of stops) {
    const near = foods
      .filter((f) => f.name.trim() && f.name.toLowerCase() !== s.name.toLowerCase() && !used.has(f.ref))
      .map((f) => ({ f, m: distanceM(s.lat, s.lng, f.lat, f.lng) }))
      .filter((x) => x.m <= maxM)
      // a listed cuisine tells the traveller what they would eat, so those come first at similar distance
      .sort((a, b) => (a.m - (a.f.cuisine ? 150 : 0)) - (b.m - (b.f.cuisine ? 150 : 0)))
      .slice(0, max);
    near.forEach((x) => used.add(x.f.ref));
    if (near.length) out[s.id] = near.map((x) => ({ name: x.f.name, lat: x.f.lat, lng: x.f.lng, cuisine: x.f.cuisine, walkMin: walkMinutes(x.m) }));
  }
  return out;
}
