/**
 * Trip intel news (Figma 34), the part code decides. Pure, so it is unit-tested.
 * NewsData matches a keyword anywhere in an article, so a search for "travel" also returns press
 * releases and world news that never mention the destination. Code removes what is plainly not
 * travel news; Ato then keeps only what could change this trip.
 */

/** Paid press-release wires: adverts written as news, never travel intel. */
const PRESS_RELEASES = /ein ?presswire|pr ?newswire|globe ?newswire|business ?wire|accesswire|newsfile|openpr|prweb|newswire\.ca|issuewire|pr\.com/i;

/** Words that make a headline about travelling, as opposed to about the economy or politics. */
const TRAVEL = /travel|touris|visitor|visa|entry|immigration|passport|border|airport|airline|flight|rail|train|metro|subway|ferry|cruise|hotel|strike|closure|typhoon|earthquake|flood|eruption|storm|heat ?wave|snow|festival|holiday|sightseeing|attraction|museum|temple|park|tax[- ]free|tourist (tax|levy)|yen|exchange rate/i;

export type RawHeadline = { title: string; link: string; source: string; published: string | null };

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** No press releases, no repeats (the same story from two outlets), newest first, at most `max`. */
export function cleanNews<T extends RawHeadline>(items: T[], max = 8): T[] {
  const seen = new Set<string>();
  return items
    .filter((n) => n.title?.trim() && n.link && !PRESS_RELEASES.test(`${n.source} ${n.link}`))
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
    .filter((n) => { const k = norm(n.title).slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}

/** Without Ato: keep a headline only if it names the destination or the country and is about travel. */
export function looksRelevant(title: string, places: string[]): boolean {
  const named = places.filter(Boolean).some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(title));
  return named && TRAVEL.test(title);
}
