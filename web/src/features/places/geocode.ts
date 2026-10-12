import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categorise } from "@/lib/categories";

/**
 * Reverse geocoding via Nominatim (OpenStreetMap). Usage policy: at most 1 request per second
 * and an identifying User-Agent. Results are cached in geocode_cache so a spot is looked up once.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const UA = process.env.OSM_USER_AGENT || "Tabiato/0.1 (CodeNection 2026 hackathon)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function reverseGeocode(supabase: SupabaseClient, lat: number, lng: number) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const { data: hit } = await supabase.from("geocode_cache").select("name, category").eq("key", key).maybeSingle();
  if (hit) return hit as { name: string; category: string | null };

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const name: string =
      j.name ||
      a.tourism || a.attraction || a.amenity || a.leisure || a.shop || a.historic ||
      a.road || a.neighbourhood || a.suburb || a.city_district || a.city ||
      String(j.display_name ?? "").split(",")[0] ||
      "Unnamed place";
    const category = categorise(j.category ?? j.class, j.type);
    await supabase.from("geocode_cache").insert({ key, name, category });
    return { name, category };
  } catch {
    return null;
  }
}

/** Names up to `limit` unnamed places, respecting the 1 request/second rule. */
export async function nameUnnamedPlaces(supabase: SupabaseClient, tripId: string, limit = 8) {
  const { data } = await supabase
    .from("places")
    .select("id, lat, lng")
    .eq("trip_id", tripId)
    .eq("name", "Unnamed place")
    .limit(limit);
  let first = true;
  for (const p of data ?? []) {
    if (!first) await sleep(1100);
    first = false;
    const g = await reverseGeocode(supabase, p.lat, p.lng);
    if (g) await supabase.from("places").update({ name: g.name, category: g.category }).eq("id", p.id);
  }
}
