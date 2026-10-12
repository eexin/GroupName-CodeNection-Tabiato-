import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiJSON } from "@/lib/ai";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { myr } from "@/lib/currency";
import { hourOf } from "@/lib/time";
import { parseQuery, type SearchQuery } from "@/features/search/parse";

export type Hit = { id: string; name: string; trip: string; when: string | null; rating: number | null; spend: number; why: string | null; category: Category; lat: number; lng: number };

/** Figma 12/13 — search your own memories in plain language. Filters in code; one line from Ato. */
export async function searchMemories(supabase: SupabaseClient, userId: string, q: string) {
  const { data: rows } = await supabase.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "joined");
  const ids = (rows ?? []).map((r) => r.trip_id);
  if (!ids.length) return { query: null as SearchQuery | null, hits: [] as Hit[], trips: 0, line: null as string | null, suggestions: [] as string[] };

  const [{ data: trips }, { data: members }, { data: places }, { data: ratings }, { data: notes }, { data: comments }, { data: expenses }] = await Promise.all([
    supabase.from("trips").select("id, name, destination").in("id", ids),
    supabase.from("trip_members").select("trip_id, user_id").in("trip_id", ids).eq("status", "joined"),
    supabase.from("places").select("id, name, category, first_seen_at, trip_id, lat, lng").in("trip_id", ids),
    supabase.from("ratings").select("place_id, stars").in("trip_id", ids).eq("user_id", userId),
    supabase.from("notes").select("place_id, body").in("trip_id", ids),
    supabase.from("comments").select("place_id, body").in("trip_id", ids),
    supabase.from("expenses").select("place_id, amount, currency, amount_myr").in("trip_id", ids),
  ]);
  const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", [...new Set((members ?? []).map((m) => m.user_id))]);
  const query = parseQuery(q, {
    people: (people ?? []).filter((p) => p.id !== userId).map((p) => p.display_name),
    trips: (trips ?? []).flatMap((t) => [t.name, t.destination ?? ""]).filter(Boolean),
  });

  const tripName = new Map((trips ?? []).map((t) => [t.id, t.name]));
  const matchTrip = query.inTrip ? new Set((trips ?? []).filter((t) => t.name === query.inTrip || t.destination === query.inTrip).map((t) => t.id)) : null;
  const personId = query.withPerson ? (people ?? []).find((p) => p.display_name === query.withPerson)?.id : null;
  const withTrips = personId ? new Set((members ?? []).filter((m) => m.user_id === personId).map((m) => m.trip_id)) : null;
  const star = new Map((ratings ?? []).map((r) => [r.place_id, r.stars as number]));
  const spend = new Map<string, number>();
  for (const e of expenses ?? []) if (e.place_id) spend.set(e.place_id, (spend.get(e.place_id) ?? 0) + myr(e));
  const words = [...(notes ?? []), ...(comments ?? [])];

  let hits: Hit[] = (places ?? []).flatMap((p) => {
    if (matchTrip && !matchTrip.has(p.trip_id)) return [];
    if (withTrips && !withTrips.has(p.trip_id)) return [];
    if (query.category && p.category !== query.category) return [];
    const r = star.get(p.id) ?? null;
    if (query.minRating && (r === null || r < query.minRating)) return [];
    if (query.timeOfDay && p.first_seen_at) {
      const h = hourOf(p.first_seen_at);
      if (query.timeOfDay === "morning" && h >= 12) return [];
      if (query.timeOfDay === "afternoon" && (h < 12 || h >= 17)) return [];
      if (query.timeOfDay === "evening" && h < 17) return [];
    }
    let why: string | null = null;
    if (query.text && !/^everything$/.test(query.text)) {
      const t = query.text.toLowerCase();
      const said = words.find((w) => w.place_id === p.id && w.body.toLowerCase().includes(t));
      if (!p.name.toLowerCase().includes(t) && !said) return [];
      if (said) why = `“${said.body.slice(0, 70)}”`;
    }
    return [{ id: p.id, name: p.name, trip: tripName.get(p.trip_id) ?? "", when: p.first_seen_at, rating: r, spend: spend.get(p.id) ?? 0, why, category: (p.category ?? "other") as Category, lat: p.lat, lng: p.lng }];
  });
  hits = query.sort === "spend" ? hits.sort((a, b) => b.spend - a.spend)
    : query.sort === "rating" ? hits.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    : hits.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  hits = hits.slice(0, 30);

  const tripsHit = new Set(hits.map((h) => h.trip)).size;
  const cats = new Map<string, number>();
  for (const h of hits) cats.set(CATEGORY_LABEL[h.category], (cats.get(CATEGORY_LABEL[h.category]) ?? 0) + 1);
  const mornings = hits.filter((h) => h.when && hourOf(h.when) < 10).length;
  const facts = { question: q, results: hits.length, trips: tripsHit, by_category: Object.fromEntries(cats), arrived_before_10am: mornings,
    top: hits.slice(0, 3).map((h) => ({ name: h.name, rating: h.rating, spent_rm: Math.round(h.spend) || null })) };
  let line: string | null = null;
  if (hits.length > 1) {
    const ai = await aiJSON("search_summary",
      `You are Ato. In ONE sentence under 22 words, point out a pattern in these search results using ONLY the facts. Return JSON {"line": string}.`,
      JSON.stringify(facts), z.object({ line: z.string().max(180) }));
    const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
    line = ai?.line ?? (topCat && topCat[1] > hits.length / 2 ? `${topCat[1]} of the ${hits.length} were ${topCat[0].toLowerCase()} stops${mornings > hits.length / 2 ? `, and ${mornings} were before 10am` : ""}.` : null);
  }
  // Figma 13b "Try instead": drop one constraint at a time, so each suggestion is something you did log
  const suggestions: string[] = [];
  if (!hits.length) {
    const tripNames = (trips ?? []).map((t) => t.name);
    if (query.text && query.inTrip) suggestions.push(`${query.text} in ${tripNames.find((n) => n !== query.inTrip) ?? ""}`.trim());
    if (query.category && query.inTrip) suggestions.push(`${query.category} in ${query.inTrip}`);
    if (query.inTrip) suggestions.push(`everything in ${query.inTrip}`);
    if (query.text && !query.inTrip) suggestions.push(...tripNames.slice(0, 2).map((n) => `everything in ${n}`));
    if (!suggestions.length) suggestions.push("Everything I rated 5 stars", ...tripNames.slice(0, 2).map((n) => `everything in ${n}`));
  }
  return { query, hits, trips: tripsHit, line, suggestions: [...new Set(suggestions)].slice(0, 3) };
}
