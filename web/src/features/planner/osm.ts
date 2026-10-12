import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorise, type Category } from "@/lib/categories";
import type { Candidate } from "@/features/planner/itinerary";

/**
 * OpenStreetMap lookups for the planner. Both services are free and keyless, and both have
 * usage rules we follow: Nominatim search runs only when the user presses Search (no
 * autocomplete, which its policy forbids), and Overpass results are cached per destination.
 *
 * Every call is on a stopwatch. These are shared community servers with no uptime promise —
 * when Overpass is busy it answers "too busy" after 40 seconds, and without a deadline that
 * delay lands on whoever is waiting for the page. A missed lookup costs us some suggestions;
 * it must never cost us the screen.
 */

const UA = process.env.OSM_USER_AGENT || "Tabiato/0.1 (CodeNection 2026 hackathon)";
const OVERPASS_URL = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

/** How long a page render may wait for suggestions, vs "Build my itinerary", which shows progress. */
export const POI_BUDGET = { render: 7_000, build: 25_000 } as const;

/**
 * Destinations whose Overpass lookup just failed. Without this every re-render of the planner
 * (including after each "Save") queues another doomed request and waits for it again.
 */
const coolOff = new Map<string, number>();
const COOL_OFF_MS = 5 * 60_000;

export type SearchHit = { name: string; lat: number; lng: number; category: Category; ref: string; detail: string };

export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<SearchHit[]> {
  const params = new URLSearchParams({ format: "jsonv2", q, limit: "6", addressdetails: "0" });
  if (near) {
    const d = 0.5; // ~50 km box, a preference not a filter
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string; category?: string; class?: string; type?: string; osm_type?: string; osm_id?: number }[];
    return rows.map((r) => ({
      name: r.name || r.display_name.split(",")[0],
      lat: Number(r.lat), lng: Number(r.lon),
      category: categorise(r.category ?? r.class, r.type),
      ref: `${r.osm_type ?? "x"}/${r.osm_id ?? r.display_name}`,
      detail: r.display_name.split(",").slice(1, 3).join(",").trim(),
    }));
  } catch {
    return [];
  }
}

/** Geocode a destination string to its centre and country. */
export async function geocodeDestination(q: string) {
  try {
    const params = new URLSearchParams({ format: "jsonv2", q, limit: "1", addressdetails: "1" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const [r] = await res.json();
    if (!r) return null;
    return {
      lat: Number(r.lat), lng: Number(r.lon),
      countryCode: (r.address?.country_code as string | undefined)?.toUpperCase() ?? null,
      country: (r.address?.country as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Named, real points of interest near a destination. Cached per destination in `poi_cache`, so
 * a destination is only ever fetched once; everyone planning the same city reads the cached rows.
 *
 * `budgetMs` is the whole time we are prepared to wait, and it is also what we ask Overpass to
 * spend, so a request we have given up on doesn't keep working on a server we share with everyone.
 */
export async function nearbyPois(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  budgetMs: number = POI_BUDGET.render,
): Promise<Candidate[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const { data: hit } = await supabase.from("poi_cache").select("pois").eq("key", key).maybeSingle();
  if (hit) return hit.pois as Candidate[];

  const until = coolOff.get(key);
  if (until && until > Date.now()) return [];

  // Anchored patterns match whole tag values, and nodes and ways only: both cut the work Overpass
  // has to do. Eating places are everywhere, so they are gathered from a tighter circle.
  const near = (m: number) => `(around:${m},${lat},${lng})`;
  const query = `[out:json][timeout:${Math.max(5, Math.round(budgetMs / 1000))}];(
    nw${near(6000)}["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium)$"]["name"];
    nw${near(6000)}["historic"~"^(castle|monument|memorial|ruins|temple|shrine)$"]["name"];
    nw${near(6000)}["leisure"~"^(park|garden)$"]["name"];
    nw${near(6000)}["shop"="mall"]["name"];
    nw${near(1500)}["amenity"~"^(restaurant|cafe|marketplace|food_court)$"]["name"];
  );out center 300;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: AbortSignal.timeout(budgetMs),
    });
    if (!res.ok) {
      coolOff.set(key, Date.now() + COOL_OFF_MS);
      return [];
    }
    const j = (await res.json()) as { remark?: string; elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
    // a busy Overpass answers 200 with the elements missing and the reason in `remark`
    if (j.remark) coolOff.set(key, Date.now() + COOL_OFF_MS);
    const seen = new Set<string>();
    const pois: Candidate[] = [];
    for (const e of j.elements ?? []) {
      const t = e.tags ?? {};
      const la = e.lat ?? e.center?.lat;
      const lo = e.lon ?? e.center?.lon;
      if (!t.name || la === undefined || lo === undefined || seen.has(t.name)) continue;
      seen.add(t.name);
      const [cls, typ] = t.tourism ? ["tourism", t.tourism] : t.historic ? ["historic", t.historic] : t.leisure ? ["leisure", t.leisure] : t.shop ? ["shop", t.shop] : ["amenity", t.amenity];
      pois.push({
        ref: `${e.type}/${e.id}`, name: t["name:en"] || t.name, lat: la, lng: lo,
        category: categorise(cls, typ),
        notable: Boolean(t.wikidata || t.wikipedia),
      });
    }
    // notable places first, and not more restaurants than everything else combined
    pois.sort((a, b) => Number(b.notable) - Number(a.notable));
    const food = pois.filter((p) => p.category === "food").slice(0, 40);
    const rest = pois.filter((p) => p.category !== "food").slice(0, 120);
    const out = [...rest, ...food];
    if (out.length) {
      coolOff.delete(key);
      await supabase.from("poi_cache").insert({ key, pois: out });
    }
    return out;
  } catch {
    // timed out, or the service is unreachable
    coolOff.set(key, Date.now() + COOL_OFF_MS);
    return [];
  }
}

import { MAPS_LINK, SHORT_HOSTS, parseMapsLink } from "@/features/planner/maps-link";

/** A pasted Google Maps link → one place. Short links are followed only on Google's own hosts. */
export async function placeFromLink(link: string): Promise<SearchHit | null> {
  if (!MAPS_LINK.test(link)) return null;
  let url = link;
  for (let hop = 0; hop < 3 && SHORT_HOSTS.has(new URL(url).hostname); hop++) {
    try {
      const res = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(6000) });
      const next = res.headers.get("location");
      if (!next) break;
      url = new URL(next, url).toString();
    } catch { return null; }
  }
  const p = parseMapsLink(url);
  return p ? { ...p, category: "other", ref: `link/${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, detail: "From your link" } : null;
}
