import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import { distanceM } from "@/lib/geo";

/**
 * The itinerary builder. Pure — no network, no model — so it is unit-tested.
 *
 * Rules (product rule 5 in CLAUDE.md):
 *  - every stop the user added appears in the result; none is dropped
 *  - a stop with fixed_day stays on that day; fixed_time is honoured as the earliest start
 *  - the planner only ORDERS the user's stops and FILLS remaining slots with real OSM places
 */

export type Pace = "slow" | "balanced" | "packed";
export type UserStop = {
  id: string; name: string; lat: number; lng: number; category: string | null;
  fixed_day: number | null; fixed_time: string | null;   // "HH:MM" or "HH:MM:SS"
};
export type Candidate = { ref: string; name: string; lat: number; lng: number; category: Category; notable: boolean };

export type Scheduled = {
  id: string | null;            // null for an Ato pick that is not in the database yet
  ref?: string;
  name: string; lat: number; lng: number; category: Category;
  source: "user" | "ato";
  reason: string | null;
  day: number; position: number; start: string; duration: number;
};

/** What past trips taught us. Produced by learnFromHistory, consumed by buildItinerary. */
export type Learned = {
  boost: Category[];                               // categories you rate highly — add more of these
  avoid: Category[];                               // categories you rate poorly — leave out of the gaps
  ratings: Partial<Record<Category, number>>;      // your average rating per category
  maxPerDay: number | null;                        // lighter days if your lighter days scored better
  notes: string[];                                 // shown to the traveller, in Ato's voice
  // from photo times (features/planner/style.ts); missing when there is not enough evidence
  dayStart?: number | null;                        // minutes after midnight you are usually out by
  dayEnd?: number | null;                          // minutes after midnight you usually wrap up by
  durations?: Partial<Record<Category, number>>;   // how long you usually stay, per category
  stopsPerDay?: number | null;                     // places you usually visit in a day
  pace?: Pace | null;                              // suggested pace for a new plan
  interests?: Category[];                          // suggested interests for a new plan
  evidence?: { trips: number; days: number; places: number };
};

const avgOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The memory → planning loop. Pure; unit-tested.
 * Only patterns with enough evidence are used: at least two ratings per category, at least two
 * rated days on each side of the light/heavy split.
 */
export function learnFromHistory(input: {
  ratings: { category: string | null; stars: number }[];
  days: { stops: number; rating: number | null }[];
}): Learned {
  const byCat = new Map<Category, number[]>();
  for (const r of input.ratings) {
    const c = (r.category && r.category in CATEGORY_LABEL ? r.category : "other") as Category;
    if (c === "other") continue;
    byCat.set(c, [...(byCat.get(c) ?? []), r.stars]);
  }
  const ratings: Partial<Record<Category, number>> = {};
  const boost: Category[] = [], avoid: Category[] = [], notes: string[] = [];
  for (const [c, xs] of byCat) {
    if (xs.length < 2) continue;
    const a = r1(avgOf(xs));
    ratings[c] = a;
    if (a >= 4.3) boost.push(c);
    else if (a <= 2.8) avoid.push(c);
  }
  boost.sort((a, b) => (ratings[b] ?? 0) - (ratings[a] ?? 0));
  for (const c of boost) notes.push(`You rated ${CATEGORY_LABEL[c].toLowerCase()} ${ratings[c]}★ on past trips, so I added more of it.`);
  for (const c of avoid) notes.push(`${CATEGORY_LABEL[c]} averaged ${ratings[c]}★ for you, so I left it out of the gaps.`);

  let maxPerDay: number | null = null;
  const rated = input.days.filter((d): d is { stops: number; rating: number } => d.rating !== null);
  const light = rated.filter((d) => d.stops <= 3).map((d) => d.rating);
  const heavy = rated.filter((d) => d.stops > 3).map((d) => d.rating);
  if (light.length >= 2 && heavy.length >= 1 && avgOf(light) - avgOf(heavy) >= 0.5) {
    maxPerDay = 3;
    notes.push(`Your days with 3 stops or fewer scored ${r1(avgOf(light))}★ against ${r1(avgOf(heavy))}★, so I kept each day light.`);
  }
  return { boost, avoid, ratings, maxPerDay, notes };
}

export const STOPS_PER_DAY: Record<Pace, number> = { slow: 3, balanced: 4, packed: 6 };
export const DAY_START: Record<Pace, number> = { slow: 9 * 60 + 30, balanced: 9 * 60, packed: 8 * 60 };
export const DURATION: Record<Category, number> = { food: 60, culture: 90, nature: 90, shopping: 60, stay: 30, other: 60 };

/** When a day starts: when you are usually out (learned from your photos), else the pace's default. */
export const startOfDay = (pace: Pace, learned?: Learned) => learned?.dayStart ?? DAY_START[pace];
/** How long a stop lasts: how long you usually stay at this kind of place, else the default. */
export const durationFor = (category: Category, learned?: Learned) => learned?.durations?.[category] ?? DURATION[category];

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
export const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const cat = (c: string | null | undefined): Category => ((c && c in CATEGORY_LABEL) ? c : "other") as Category;

/** Walking-ish transfer: 15 minutes plus 3 per kilometre, capped at an hour. */
export const travelMinutes = (km: number) => Math.min(60, Math.round(15 + 3 * km));

/** Greedy tour. With keepFirst, it starts from the first item (the traveller's top priority). */
function nearestNeighbour<T extends { lat: number; lng: number }>(items: T[], keepFirst = false): T[] {
  if (!keepFirst && items.length < 3) return [...items].sort((a, b) => a.lng - b.lng);
  if (items.length < 2) return [...items];
  const left = keepFirst ? [...items] : [...items].sort((a, b) => a.lng - b.lng);
  const out = [left.shift()!];
  while (left.length) {
    const cur = out[out.length - 1];
    let bi = 0, bd = Infinity;
    left.forEach((p, i) => { const d = distanceM(cur.lat, cur.lng, p.lat, p.lng); if (d < bd) { bd = d; bi = i; } });
    out.push(left.splice(bi, 1)[0]);
  }
  return out;
}

export function buildItinerary(input: {
  userStops: UserStop[];
  candidates: Candidate[];
  days: number;
  pace: Pace;
  interests: string[];                  // e.g. ["food", "culture"]
  center: { lat: number; lng: number };
  learned?: Learned;
}): Scheduled[] {
  const days = Math.max(1, Math.min(14, input.days));
  const perDay = Math.min(STOPS_PER_DAY[input.pace], input.learned?.maxPerDay ?? Infinity);
  const boost = new Set(input.learned?.boost ?? []);
  const avoid = new Set(input.learned?.avoid ?? []);
  const buckets: { user: UserStop[]; picks: Candidate[] }[] = Array.from({ length: days }, () => ({ user: [], picks: [] }));

  // 1. pinned stops go to their day (clamped into range, never dropped)
  const free: UserStop[] = [];
  for (const s of input.userStops) {
    if (s.fixed_day) buckets[Math.min(days, Math.max(1, s.fixed_day)) - 1].user.push(s);
    else free.push(s);
  }

  // 2. the rest follow a geographic tour, split evenly across days
  // userStops arrive in the traveller's order, so their top pick leads the first day
  const tour = nearestNeighbour(free, true);
  const target = Math.max(1, Math.ceil(input.userStops.length / days));
  let d = 0;
  for (const s of tour) {
    while (d < days - 1 && buckets[d].user.length >= target) d++;
    buckets[d].user.push(s);
  }

  // 3. fill empty slots with real places near each day's stops, preferring your interests
  const wanted = new Set(input.interests.map((i) => i.toLowerCase()));
  const used = new Set<string>();
  const taken = new Set(input.userStops.map((s) => s.name.toLowerCase()));
  for (const b of buckets) {
    const anchor = b.user.length
      ? { lat: b.user.reduce((a, s) => a + s.lat, 0) / b.user.length, lng: b.user.reduce((a, s) => a + s.lng, 0) / b.user.length }
      : input.center;
    const pool = input.candidates
      .filter((c) => !used.has(c.ref) && !taken.has(c.name.toLowerCase()))
      .map((c) => {
        const km = distanceM(anchor.lat, anchor.lng, c.lat, c.lng) / 1000;
        const score = km - (wanted.has(c.category) ? 2.5 : 0) - (boost.has(c.category) ? 3 : 0)
          + (avoid.has(c.category) ? 50 : 0) - (c.notable ? 1 : 0);
        return { c, km, score };
      })
      .filter((x) => x.km <= 8)
      .sort((a, b) => a.score - b.score);
    // one food stop per day at most from the fill, so a day is not four restaurants
    let foodPicked = b.user.some((s) => cat(s.category) === "food");
    for (const { c } of pool) {
      if (b.user.length + b.picks.length >= perDay) break;
      if (c.category === "food" && foodPicked) continue;
      if (c.category === "food") foodPicked = true;
      b.picks.push(c);
      used.add(c.ref);
    }
  }

  // 4. order within each day and assign times; fixed_time is a floor, not a suggestion
  const out: Scheduled[] = [];
  buckets.forEach((b, i) => {
    type Row = { u?: UserStop; c?: Candidate; lat: number; lng: number };
    const rows: Row[] = [...b.user.map((u) => ({ u, lat: u.lat, lng: u.lng })), ...b.picks.map((c) => ({ c, lat: c.lat, lng: c.lng }))];
    const ordered = nearestNeighbour(rows);
    // fixed-time stops sorted into chronological order among themselves
    const fixedIdx = ordered.map((r, k) => (r.u?.fixed_time ? k : -1)).filter((k) => k >= 0);
    const fixedSorted = fixedIdx.map((k) => ordered[k]).sort((a, z) => toMin(a.u!.fixed_time!) - toMin(z.u!.fixed_time!));
    fixedIdx.forEach((k, j) => { ordered[k] = fixedSorted[j]; });

    // your usual rhythm (learned) wins over the pace's default start; Ato adds nothing after your usual finish
    let clock = startOfDay(input.pace, input.learned);
    const end = input.learned?.dayEnd ?? null;
    let prev: Row | null = null, position = 0;
    for (const r of ordered) {
      let t = clock + (prev ? travelMinutes(distanceM(prev.lat, prev.lng, r.lat, r.lng) / 1000) : 0);
      if (r.u?.fixed_time) t = Math.max(t, toMin(r.u.fixed_time));
      if (!r.u && end !== null && t >= end) continue;
      const category = cat(r.u ? r.u.category : r.c!.category);
      const duration = durationFor(category, input.learned);
      out.push(
        r.u
          ? { id: r.u.id, name: r.u.name, lat: r.lat, lng: r.lng, category, source: "user", reason: r.u.fixed_time ? `Fixed at ${r.u.fixed_time.slice(0, 5)}` : null, day: i + 1, position, start: toHHMM(t), duration }
          : { id: null, ref: r.c!.ref, name: r.c!.name, lat: r.lat, lng: r.lng, category, source: "ato",
              reason: input.learned?.ratings[category] && boost.has(category)
                ? `${CATEGORY_LABEL[category]} — you rated it ${input.learned.ratings[category]}★ on past trips`
                : wanted.has(category) ? `${CATEGORY_LABEL[category]} — one of your interests, close by` : `Close to the rest of the day`,
              day: i + 1, position, start: toHHMM(t), duration },
      );
      position++;
      clock = t + duration;
      prev = r;
    }
  });
  return out;
}

/** Figma 30 — where the group disagrees. The leader decides; nothing is scored. */
export function groupConflicts(
  members: { name: string; budget?: string; pace?: string; interests?: string[]; start?: number | null }[],
  stops: { name: string; by: string; fixed_day: number | null; fixed_time: string | null }[] = [],
) {
  const out: { title: string; detail: string }[] = [];
  // two people pinned different things to the same slot (within two hours)
  const pinned = stops.filter((s) => s.fixed_day && s.fixed_time);
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  for (let i = 0; i < pinned.length; i++) for (let j = i + 1; j < pinned.length; j++) {
    const a = pinned[i], b = pinned[j];
    if (a.by !== b.by && a.fixed_day === b.fixed_day && Math.abs(mins(a.fixed_time!) - mins(b.fixed_time!)) < 120) {
      out.push({ title: "Must-do clash", detail: `${a.name} (${a.by}) and ${b.name} (${b.by}) are both pinned to day ${a.fixed_day} around ${a.fixed_time!.slice(0, 5)}` });
    }
  }
  const budgets = [...new Set(members.map((m) => m.budget).filter(Boolean))];
  if (budgets.length > 1) out.push({ title: "Budget spread", detail: members.filter((m) => m.budget).map((m) => `${m.name}: ${m.budget}`).join(", ") });
  const paces = [...new Set(members.map((m) => m.pace).filter(Boolean))];
  if (paces.length > 1) out.push({ title: "Pace", detail: members.filter((m) => m.pace).map((m) => `${m.name} likes ${m.pace}`).join(", ") });
  // learned from photos: when each person is usually out. Far apart → someone waits every morning
  const starts = members.filter((m): m is typeof m & { start: number } => typeof m.start === "number");
  if (starts.length > 1) {
    const early = starts.reduce((a, b) => (b.start < a.start ? b : a)), late = starts.reduce((a, b) => (b.start > a.start ? b : a));
    if (late.start - early.start >= 90) {
      const at = (m: number) => `${Math.floor(m / 60) % 12 || 12}${m % 60 ? `:${String(m % 60).padStart(2, "0")}` : ""}${m < 720 ? "am" : "pm"}`;
      out.push({ title: "Early birds and late starters", detail: `${early.name} is usually out by ${at(early.start)}, ${late.name} by ${at(late.start)}. Days will start in between.` });
    }
  }
  const lists = members.map((m) => new Set(m.interests ?? [])).filter((s) => s.size);
  if (lists.length > 1) {
    const shared = [...lists[0]].filter((x) => lists.every((s) => s.has(x)));
    out.push(shared.length
      ? { title: "Shared interests", detail: `Everyone picked ${shared.join(", ")}` }
      : { title: "No shared interests", detail: "Nobody overlaps — split the days, or take turns choosing." });
  }
  return out;
}
