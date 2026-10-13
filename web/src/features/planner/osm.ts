import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorise, type Category } from "@/lib/categories";
import type { Candidate } from "@/features/planner/itinerary";
import { aiJSON } from "@/lib/ai";
import { NAMED_SYSTEM, namedPrompt, namedSchema, namesToCheck, toCandidate } from "@/features/planner/named-places";
import type { MapPlace } from "@/features/planner/stays";
import { CITIES_SYSTEM, boxFromNominatim, citiesPrompt, citiesSchema, keepCity, type Box } from "@/features/planner/destination";

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

// Overpass refuses clients that don't say who they are, so the default names the project
const UA = process.env.OSM_USER_AGENT || "Tabiato/1.0 (+https://github.com/eexin/GroupName-CodeNection-Tabiato-)";

/**
 * Overpass servers, tried in turn. The main one is often too busy (504) and then answers nothing,
 * so the public mirrors back it up. OVERPASS_URL (comma-separated) goes first when set.
 */
const OVERPASS_URLS = [...new Set([
  ...(process.env.OVERPASS_URL ?? "").split(","),
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
].map((u) => u.trim()).filter(Boolean))];

/** How long a page render may wait for suggestions, vs "Build my itinerary", which shows progress. */
export const POI_BUDGET = { render: 7_000, build: 16_000 } as const;

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

/**
 * Geocode a destination string to its centre and country, plus what kind of place the map thinks
 * it is and how big it is — a country or a big island can't be planned around one point.
 */
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
    const lat = Number(r.lat);
    const area = boxFromNominatim(r.boundingbox, lat);
    return {
      lat, lng: Number(r.lon),
      countryCode: (r.address?.country_code as string | undefined)?.toUpperCase() ?? null,
      country: (r.address?.country as string | undefined) ?? null,
      name: (r.name as string | undefined) || q,
      kind: (r.addresstype as string | undefined) ?? null,
      km: area?.km ?? null,
      box: area?.box ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * For a destination that is a whole country or region: Ato suggests the cities visitors base a
 * trip in, and each one is kept only if the map finds a city-sized place inside that area. One
 * map lookup a second (Nominatim's rule). Returns "City, Area" strings ready to plan with.
 */
export async function suggestCities(area: { name: string; countryCode: string | null; box: Box }): Promise<string[]> {
  const ai = await aiJSON("plan_places", CITIES_SYSTEM, citiesPrompt(area.name), citiesSchema, { timeoutMs: 8_000 }).catch(() => null);
  const out: string[] = [];
  let last = 0;
  for (const c of ai?.cities ?? []) {
    if (out.length === 4) break;
    const wait = last + 1_100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const label = `${c.name.trim()}, ${area.name}`;
    const hit = await geocodeDestination(label);
    if (keepCity(hit, area) && !out.includes(label)) out.push(label);
  }
  return out;
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
  const query = (seconds: number) => `[out:json][timeout:${seconds}];(
    nw${near(6000)}["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium)$"]["name"];
    nw${near(6000)}["historic"~"^(castle|monument|memorial|ruins|temple|shrine)$"]["name"];
    nw${near(6000)}["leisure"~"^(park|garden)$"]["name"];
    nw${near(6000)}["shop"="mall"]["name"];
    nw${near(1500)}["amenity"~"^(restaurant|cafe|marketplace|food_court)$"]["name"];
  );out center 300;`;

  // Each server gets half the budget at most, so one that hangs can't use up the others' turn.
  const deadline = Date.now() + budgetMs;
  for (const [i, url] of OVERPASS_URLS.entries()) {
    const left = deadline - Date.now();
    if (left < 2_500) break;
    const slice = i === OVERPASS_URLS.length - 1 ? left : Math.min(left, Math.max(2_500, Math.round(budgetMs / 2)));
    const out = await askOverpass(url, query(Math.max(3, Math.floor(slice / 1000))), slice);
    if (out.length) {
      coolOff.delete(key);
      await supabase.from("poi_cache").insert({ key, pois: out });
      return out;
    }
  }
  coolOff.set(key, Date.now() + COOL_OFF_MS);
  return [];
}

type OverpassReply = { remark?: string; elements?: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };

/** One Overpass server. Anything but a usable answer — busy, refused, timed out — is []. */
async function askOverpass(url: string, query: string, ms: number): Promise<Candidate[]> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return [];
    // a busy Overpass answers 200 with the elements missing and the reason in `remark`
    const j = (await res.json()) as OverpassReply;
    return toPois(j);
  } catch {
    return [];
  }
}

function toPois(j: OverpassReply): Candidate[] {
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
  return [...rest, ...food];
}

/** Ato's list of well-known places for a destination (names only — nothing is trusted yet). */
export function askAtoForPlaces(input: { destination: string; interests: string[]; skip: string[] }) {
  return aiJSON("plan_places", NAMED_SYSTEM, namedPrompt(input), namedSchema, { timeoutMs: 10_000 }).catch(() => null);
}

/**
 * The backup when Overpass found nothing: keep each name Ato gave only if Nominatim finds it near
 * the destination, using the map's name and coordinates. One lookup per second (Nominatim's rule),
 * stopping at `deadline`. Saved to poi_cache like an Overpass answer, so this runs once per city.
 */
export async function checkNamedPlaces(
  supabase: SupabaseClient,
  center: { lat: number; lng: number },
  input: { destination: string; places: { name: string; kind?: string }[]; skip: string[]; deadline: number },
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const refs = new Set<string>();
  let last = 0;
  for (const named of namesToCheck(input.places, input.skip)) {
    if (Date.now() > input.deadline - 1_500) break;
    const wait = last + 1_100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const hits = await searchPlaces(`${named.name}, ${input.destination}`, center);
    const c = toCandidate(named, hits, center);
    if (c && !refs.has(c.ref)) { refs.add(c.ref); out.push(c); }
  }
  // a handful of places is enough to plan with and worth keeping; fewer, try Overpass next time
  if (out.length >= 4) {
    const key = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
    await supabase.from("poi_cache").insert({ key, pois: out });
  }
  return out;
}

/**
 * Hotels or restaurants inside a box, from Nominatim ("hotel" and "restaurant" are search words
 * it understands). One request; callers keep to Nominatim's one-per-second rule.
 */
export async function mapPlacesIn(
  what: "hotel" | "hostel" | "restaurant",
  box: { west: number; south: number; east: number; north: number },
): Promise<MapPlace[]> {
  const params = new URLSearchParams({
    format: "jsonv2", q: what, bounded: "1", limit: "40", extratags: "1", namedetails: "1",
    viewbox: `${box.west},${box.north},${box.east},${box.south}`,
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { name?: string; lat: string; lon: string; type?: string; osm_type?: string; osm_id?: number; extratags?: Record<string, string> | null; namedetails?: Record<string, string> | null }[];
    return rows
      .map((r) => {
        const stars = Number.parseFloat(r.extratags?.stars ?? "");
        return {
          ref: `${r.osm_type ?? "x"}/${r.osm_id ?? r.lat + r.lon}`,
          name: (r.namedetails?.["name:en"] || r.name || "").trim(),
          lat: Number(r.lat), lng: Number(r.lon),
          kind: r.type ?? what,
          stars: Number.isFinite(stars) ? Math.round(stars) : null,
          cuisine: r.extratags?.cuisine?.replace(/_/g, " ").split(";").slice(0, 2).join(", ") ?? null,
        };
      })
      .filter((p) => p.name);
  } catch {
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
