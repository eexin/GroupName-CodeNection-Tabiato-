import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { distanceM } from "@/lib/geo";
import {
  DURATION, learnFromHistory, travelMinutes, cat,
  type Learned, type Pace,
} from "@/features/planner/itinerary";

/**
 * Your travel style, learned from your finished trips. Pure (no network, no model), so it is
 * unit-tested; learn.ts reads the rows and history.ts gathers them.
 *
 * Every number comes from your own records:
 *  - ratings → categories you love or skip, and whether lighter days suit you (learnFromHistory)
 *  - photo times → when your day usually starts and ends
 *  - when you reached one place and the next → how long you stay at each kind of place
 * A pattern is used only with enough evidence, so one odd day never changes a plan.
 */

export type HistoryPlace = {
  id: string; trip_id: string; category: string | null; lat: number; lng: number;
  first_seen_at: string | null; last_seen_at: string | null;
  stars: number | null;                                  // your own rating, if you gave one
};
export type History = { places: HistoryPlace[]; photos: { trip_id: string; taken_at: string }[] };

/** Days need this many photos before their first and last photo say anything about your rhythm. */
const MIN_DAY_PHOTOS = 3;
/** And this many such days before a start or finish time is used. */
const MIN_DAYS = 3;
/** A day whose first photo is this late was a travel day or a lie-in, not a normal start. */
const LATE_FIRST = 13 * 60;
/** A day whose last photo is this early ended for another reason (a flight, a nap). */
const EARLY_LAST = 16 * 60;
/** A difference from the usual length of a visit has to be this big to be worth saying. */
export const NOTABLE_MIN = 30;

// photo times are wall-clock time stored as UTC (lib/time.ts), so UTC fields are the local clock
const minuteOf = (iso: string) => { const d = new Date(iso); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round15 = (n: number) => Math.round(n / 15) * 15;
const PLANNABLE: Category[] = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => c !== "other" && c !== "stay");

/** "7:45am", "6pm" */
export function clock(min: number) {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** When your days usually start and end, from the first and last photo of each full day. */
export function rhythm(photos: History["photos"]) {
  const days = new Map<string, number[]>();
  for (const p of photos) {
    if (!p.taken_at) continue;
    const key = `${p.trip_id}:${p.taken_at.slice(0, 10)}`;
    days.set(key, [...(days.get(key) ?? []), minuteOf(p.taken_at)]);
  }
  const full = [...days.values()].filter((xs) => xs.length >= MIN_DAY_PHOTOS);
  const starts = full.map((xs) => Math.min(...xs)).filter((m) => m < LATE_FIRST);
  const ends = full.map((xs) => Math.max(...xs)).filter((m) => m >= EARLY_LAST);
  return {
    // out a little before the first photo, home a little after the last
    dayStart: starts.length >= MIN_DAYS ? clamp(Math.floor(median(starts) / 15) * 15, 6 * 60, 11 * 60) : null,
    dayEnd: ends.length >= MIN_DAYS ? clamp(Math.ceil((median(ends) + 30) / 15) * 15, 17 * 60, 23 * 60) : null,
    days: full.length,
  };
}

/**
 * How long you usually stay at each kind of place. A stay runs from reaching a place to reaching
 * the next one that day, minus the travel between them. When there is no next place (or a long
 * break before it), the first-to-last photo span plus half an hour stands in.
 */
export function dwell(places: HistoryPlace[]): Partial<Record<Category, number>> {
  const byDay = new Map<string, HistoryPlace[]>();
  for (const p of places) {
    if (!p.first_seen_at) continue;
    const key = `${p.trip_id}:${p.first_seen_at.slice(0, 10)}`;
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const samples = new Map<Category, number[]>();
  for (const day of byDay.values()) {
    day.sort((a, b) => a.first_seen_at!.localeCompare(b.first_seen_at!));
    day.forEach((p, i) => {
      const c = cat(p.category);
      if (!PLANNABLE.includes(c)) return;
      const next = day[i + 1];
      let stay: number | null = null;
      if (next) {
        const gap = (Date.parse(next.first_seen_at!) - Date.parse(p.first_seen_at!)) / 60000;
        const s = gap - travelMinutes(distanceM(p.lat, p.lng, next.lat, next.lng) / 1000);
        if (s >= 15 && s <= 240) stay = s;
      }
      if (stay === null && p.last_seen_at) {
        const span = (Date.parse(p.last_seen_at) - Date.parse(p.first_seen_at!)) / 60000;
        if (span >= 10) stay = span + 30;
      }
      if (stay !== null) samples.set(c, [...(samples.get(c) ?? []), stay]);
    });
  }
  const out: Partial<Record<Category, number>> = {};
  for (const [c, xs] of samples) if (xs.length >= 2) out[c] = clamp(round15(median(xs)), 30, 180);
  return out;
}

/** Places per day → the pace a new plan should start from. */
export function paceFor(stopsPerDay: number | null): Pace | null {
  if (stopsPerDay === null) return null;
  return stopsPerDay <= 3 ? "slow" : stopsPerDay <= 4.5 ? "balanced" : "packed";
}

/** Everything above, for one traveller. */
export function learnStyle(h: History): Learned {
  // the existing ratings loop: by category, and light days against heavy days
  const byDay = new Map<string, { n: number; stars: number[] }>();
  for (const p of h.places) {
    if (!p.first_seen_at) continue;
    const key = `${p.trip_id}:${p.first_seen_at.slice(0, 10)}`;
    const d = byDay.get(key) ?? { n: 0, stars: [] };
    d.n++;
    if (p.stars !== null) d.stars.push(p.stars);
    byDay.set(key, d);
  }
  const base = learnFromHistory({
    ratings: h.places.filter((p) => p.stars !== null).map((p) => ({ category: p.category, stars: p.stars! })),
    days: [...byDay.values()].map((d) => ({ stops: d.n, rating: d.stars.length ? d.stars.reduce((a, b) => a + b, 0) / d.stars.length : null })),
  });

  const r = rhythm(h.photos);
  const durations = dwell(h.places);
  const counts = [...byDay.values()].map((d) => d.n);
  const stopsPerDay = counts.length >= MIN_DAYS ? Math.round(median(counts) * 2) / 2 : null;

  // interests: what you rate highly first, then what you visit a lot and rate well
  const share = new Map<Category, number>();
  for (const p of h.places) { const c = cat(p.category); if (PLANNABLE.includes(c)) share.set(c, (share.get(c) ?? 0) + 1); }
  const total = [...share.values()].reduce((a, b) => a + b, 0);
  const frequent = [...share.entries()]
    .filter(([c, n]) => total >= 6 && n / total >= 0.25 && !base.avoid.includes(c) && (base.ratings[c] ?? 4) >= 4)
    .sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const interests = [...new Set([...base.boost.filter((c) => PLANNABLE.includes(c)), ...frequent])].slice(0, 3);

  const learned: Learned = {
    ...base,
    dayStart: r.dayStart, dayEnd: r.dayEnd, durations, stopsPerDay, pace: paceFor(stopsPerDay), interests,
    evidence: { trips: new Set(h.places.map((p) => p.trip_id)).size, days: byDay.size, places: h.places.length },
  };
  learned.notes = [...base.notes, ...habitNotes(learned, "you")];
  return learned;
}

/** Rhythm and visit-length lines, in Ato's voice. */
function habitNotes(l: Learned, who: "you" | "group"): string[] {
  const out: string[] = [];
  const you = who === "you" ? "You're" : "You're all";
  if (l.dayStart != null) out.push(`${you} usually out by ${clock(l.dayStart)}, so each day starts then.`);
  if (l.dayEnd != null) out.push(`${who === "you" ? "You usually wrap" : "The group usually wraps"} up around ${clock(l.dayEnd)}, so I don't add new places after that.`);
  for (const [c, m] of Object.entries(l.durations ?? {}) as [Category, number][]) {
    const diff = m - DURATION[c];
    if (Math.abs(diff) < NOTABLE_MIN) continue;
    const what = c === "food" ? "meals" : `${CATEGORY_LABEL[c].toLowerCase()} stops`;
    out.push(`${who === "you" ? "You" : "The group"} usually spend${who === "you" ? "" : "s"} about ${m} min at ${CATEGORY_LABEL[c].toLowerCase()} places, so ${what} get ${diff > 0 ? "more" : "less"} time.`);
  }
  return out;
}

/** Reads a saved style back (profiles.travel_style.learned); anything malformed counts as none. */
export function asLearned(x: unknown): Learned | null {
  const o = x as Learned | null;
  return o && Array.isArray(o.boost) && Array.isArray(o.avoid) && typeof o.ratings === "object" ? o : null;
}

/**
 * A group trip plans for everyone: each member's style, averaged. Members with no finished trips
 * yet simply don't count. Where people differ a lot, the preference board says so (groupConflicts).
 */
export function blendStyles(members: { name: string; style: Learned | null }[]): Learned {
  const known = members.filter((m): m is { name: string; style: Learned } => m.style !== null);
  const empty: Learned = { boost: [], avoid: [], ratings: {}, maxPerDay: null, notes: [] };
  if (!known.length) return empty;
  if (known.length === 1) {
    const only = known[0];
    if (members.length === 1) return only.style;
    return { ...only.style, notes: [`Only ${only.name} has finished trips to learn from so far.`, ...only.style.notes] };
  }

  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const ratings: Partial<Record<Category, number>> = {};
  const durations: Partial<Record<Category, number>> = {};
  for (const c of Object.keys(CATEGORY_LABEL) as Category[]) {
    const r = mean(known.map((m) => m.style.ratings[c]));
    if (r !== null) ratings[c] = Math.round(r * 10) / 10;
    const d = mean(known.map((m) => m.style.durations?.[c]));
    if (d !== null) durations[c] = round15(d);
  }
  const boost = (Object.keys(ratings) as Category[]).filter((c) => ratings[c]! >= 4.3).sort((a, b) => ratings[b]! - ratings[a]!);
  const avoid = (Object.keys(ratings) as Category[]).filter((c) => ratings[c]! <= 2.8);
  const light = known.filter((m) => m.style.maxPerDay !== null).length;
  const start = mean(known.map((m) => m.style.dayStart));
  const end = mean(known.map((m) => m.style.dayEnd));

  const out: Learned = {
    boost, avoid, ratings, durations,
    maxPerDay: light * 2 >= known.length ? 3 : null,
    dayStart: start === null ? null : round15(start),
    dayEnd: end === null ? null : round15(end),
    notes: [],
  };
  const names = known.map((m) => m.name);
  out.notes = [
    `I blended what ${names.slice(0, -1).join(", ")} and ${names.at(-1)} enjoyed on past trips.`,
    ...boost.map((c) => `Together you rate ${CATEGORY_LABEL[c].toLowerCase()} ${ratings[c]}★, so I added more of it.`),
    ...avoid.map((c) => `${CATEGORY_LABEL[c]} averages ${ratings[c]}★ across the group, so I left it out of the gaps.`),
    ...(out.maxPerDay ? ["Lighter days scored better for most of you, so I kept each day to 3 stops."] : []),
    ...habitNotes(out, "group"),
  ];
  return out;
}

/** The Profile card: a few tags and one line from Ato. Null line when there is nothing to say yet. */
export function describeStyle(l: Learned | null): { tags: string[]; line: string | null } {
  if (!l) return { tags: [], line: null };
  const tags: string[] = [];
  if (l.dayStart != null && l.dayStart <= 8 * 60) tags.push("Early riser");
  if (l.dayStart != null && l.dayStart >= 10 * 60) tags.push("Late starter");
  if (l.dayEnd != null && l.dayEnd >= 22 * 60) tags.push("Night owl");
  if (l.pace) tags.push(l.pace === "slow" ? "Slow pace" : l.pace === "packed" ? "Packs it in" : "Balanced pace");
  let longest: { c: Category; m: number } | null = null;
  for (const [c, m] of Object.entries(l.durations ?? {}) as [Category, number][]) {
    const diff = m - DURATION[c];
    if (diff >= NOTABLE_MIN) tags.push(c === "food" ? "Lingers over meals" : `Lingers at ${CATEGORY_LABEL[c].toLowerCase()}`);
    else if (diff <= -NOTABLE_MIN) tags.push(`Quick ${CATEGORY_LABEL[c].toLowerCase()} stops`);
    if (diff >= NOTABLE_MIN && (!longest || diff > longest.m - DURATION[longest.c])) longest = { c, m };
  }
  for (const c of l.boost) tags.push(`Loves ${CATEGORY_LABEL[c].toLowerCase()}`);
  for (const c of l.avoid) tags.push(`Skips ${CATEGORY_LABEL[c].toLowerCase()}`);

  const parts: string[] = [];
  if (l.dayStart != null) parts.push(`you're out by ${clock(l.dayStart)}`);
  if (l.stopsPerDay != null) {
    const n = l.stopsPerDay;
    parts.push(`fit in about ${Number.isInteger(n) ? n : `${Math.floor(n)}–${Math.ceil(n)}`} ${n === 1 ? "place" : "places"} a day`);
  }
  if (longest) parts.push(`give ${longest.c === "food" ? "meals" : `${CATEGORY_LABEL[longest.c].toLowerCase()} places`} about ${longest.m} minutes`);
  else if (l.dayEnd != null) parts.push(`wrap up around ${clock(l.dayEnd)}`);
  const line = parts.length
    ? `I noticed ${parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0]}.`
    : null;
  return { tags, line };
}
