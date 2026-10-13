import { z } from "zod";
import { distanceM } from "@/lib/geo";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import {
  DAY_START, DURATION, STOPS_PER_DAY, cat, toHHMM, toMin, travelMinutes,
  type Candidate, type Learned, type Pace, type Scheduled, type UserStop,
} from "@/features/planner/itinerary";

/**
 * The AI itinerary (Figma 31). Pure — no network — so it is unit-tested.
 *
 * Ato writes the whole plan: which real places fill the gaps, the order, the times, a reason for
 * every pick and a title for every day. Code still owns the rules the model could get wrong:
 *  - it may only use places from the real OpenStreetMap list it was given, or the traveller's own
 *  - every must-visit place appears exactly once, on its pinned day, never before its pinned time
 *  - times are recomputed so stops never overlap and travel time between them is respected
 * If the answer breaks the plan (nothing usable in it), the caller falls back to buildItinerary.
 */

export const MAX_CANDIDATES = 60;
const DAY_END = 21 * 60;

export const aiPlanSchema = z.object({
  days: z.array(z.object({
    day: z.coerce.number(),
    title: z.string().max(80).optional().default(""),
    stops: z.array(z.object({
      id: z.coerce.string(),
      start: z.string().optional(),
      minutes: z.coerce.number().optional(),
      reason: z.string().max(300).optional(),
    })).max(12),
  })).min(1).max(14),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

export const AI_PLAN_SYSTEM = (minPerDay: number, maxPerDay: number, dayStart: string) => `You are Ato, a cheerful goldfish travel planner. Build a complete, realistic day-by-day itinerary for this traveller.
Rules:
- Use ONLY places from "must_visit" (by their "id") and "candidates" (by their "ref"). Never invent a place.
- Include every must_visit place exactly once. If it has fixed_day, put it on that day. If it has fixed_time, start it at or after that time.
- Every day has between ${minPerDay} and ${maxPerDay} stops in total, must_visit places included. Days start around ${dayStart} and finish by 21:00.
- Plan like a local: keep each day in one area (use lat/lng), eat lunch between 11:30 and 13:30 and dinner between 18:00 and 20:00 when food places exist, put parks, temples and viewpoints in the morning, markets and night views in the evening.
- Favour categories in "interests" and "loved". Leave out categories in "avoid" unless they are must_visit.
- Make every day feel different. Do not put the same category three times in a row.
- For each stop give "start" (HH:MM, 24-hour) and "minutes" (how long to stay, 30 to 180).
- For each stop you chose from candidates, give "reason": one short sentence, at most 15 words, in Ato's voice, about why it suits this traveller.
- Base each reason only on the place's name, category and the traveller. Never claim a dish, cuisine, price, award or opening hours the data does not show.
- Give each day a short, fun "title" of at most 6 words.
Return JSON only: {"days":[{"day":number,"title":string,"stops":[{"id":string,"start":"HH:MM","minutes":number,"reason":string}]}]}
"id" is a must_visit id or a candidate ref.`;

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** Picks the most relevant real places for the prompt, so it stays small and fast. */
export function shortlist(input: {
  candidates: Candidate[]; userStops: UserStop[]; interests: string[];
  center: { lat: number; lng: number }; learned?: Learned;
}): Candidate[] {
  const wanted = new Set(input.interests.map((i) => i.toLowerCase()));
  const boost = new Set(input.learned?.boost ?? []);
  const avoid = new Set(input.learned?.avoid ?? []);
  const taken = new Set(input.userStops.map((s) => s.name.toLowerCase()));
  const seen = new Set<string>();
  return input.candidates
    .filter((c) => !taken.has(c.name.toLowerCase()))
    .filter((c) => (seen.has(c.ref) ? false : (seen.add(c.ref), true)))
    .map((c) => {
      const km = distanceM(input.center.lat, input.center.lng, c.lat, c.lng) / 1000;
      const score = km - (wanted.has(c.category) ? 2.5 : 0) - (boost.has(c.category) ? 3 : 0)
        + (avoid.has(c.category) ? 20 : 0) - (c.notable ? 1.5 : 0);
      return { c, km, score };
    })
    .filter((x) => x.km <= 15)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.c);
}

/** The user message for the model: the trip, the traveller, and the only places it may use. */
export function aiPlanPrompt(input: {
  destination: string; startDate: string; days: number; pace: Pace; interests: string[]; budget: number | null;
  userStops: UserStop[]; shortlist: Candidate[]; learned?: Learned;
}) {
  const start = new Date(`${input.startDate}T00:00:00Z`);
  return JSON.stringify({
    trip: {
      destination: input.destination, days: input.days, pace: input.pace, interests: input.interests,
      budget_myr: input.budget,
      dates: Array.from({ length: input.days }, (_, i) => {
        const d = new Date(start.getTime() + i * 86400000);
        return { day: i + 1, date: d.toISOString().slice(0, 10), weekday: d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }) };
      }),
    },
    loved: (input.learned?.boost ?? []).map((c) => CATEGORY_LABEL[c]),
    avoid: (input.learned?.avoid ?? []).map((c) => CATEGORY_LABEL[c]),
    must_visit: input.userStops.map((s) => ({
      id: s.id, name: s.name, category: cat(s.category), fixed_day: s.fixed_day ?? null,
      fixed_time: s.fixed_time ? s.fixed_time.slice(0, 5) : null, lat: round(s.lat), lng: round(s.lng),
    })),
    candidates: input.shortlist.map((c) => ({
      ref: c.ref, name: c.name, category: c.category, well_known: c.notable, lat: round(c.lat), lng: round(c.lng),
    })),
  });
}

export function perDayRange(pace: Pace, learned?: Learned) {
  const max = Math.min(STOPS_PER_DAY[pace], learned?.maxPerDay ?? Infinity);
  return { min: Math.max(2, max - 2), max };
}

const hhmm = (t: string | undefined) => (t && /^\d{1,2}:\d{2}/.test(t) ? toMin(t) : null);

/**
 * Turns the model's answer into a schedule the app can trust, or returns null when the answer is
 * unusable (then the caller uses buildItinerary instead).
 */
export function applyAiPlan(ai: AiPlan, input: {
  userStops: UserStop[]; candidates: Candidate[]; days: number; pace: Pace; learned?: Learned;
}): { plan: Scheduled[]; titles: { day: number; title: string }[] } | null {
  const days = Math.max(1, Math.min(14, input.days));
  const { max } = perDayRange(input.pace, input.learned);
  const users = new Map(input.userStops.map((s) => [s.id, s]));
  const cands = new Map(input.candidates.map((c) => [c.ref, c]));

  type Row = { u?: UserStop; c?: Candidate; aiStart: number | null; minutes: number | null; reason: string | null };
  const buckets: Row[][] = Array.from({ length: days }, () => []);
  const seen = new Set<string>();

  for (const d of ai.days) {
    const i = Math.round(d.day) - 1;
    if (i < 0 || i >= days) continue;
    for (const s of d.stops) {
      if (seen.has(s.id)) continue;
      const u = users.get(s.id);
      const c = u ? undefined : cands.get(s.id);
      if (!u && !c) continue;                                    // an invented place: dropped
      if (u?.fixed_day && Math.min(days, Math.max(1, u.fixed_day)) !== i + 1) continue; // placed on its own day below
      seen.add(s.id);
      buckets[i].push({ u, c, aiStart: hhmm(s.start), minutes: s.minutes ?? null, reason: s.reason?.trim().slice(0, 140) || null });
    }
  }

  // every must-visit place appears: on its pinned day, or the lightest day
  for (const u of input.userStops) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const i = u.fixed_day
      ? Math.min(days, Math.max(1, u.fixed_day)) - 1
      : buckets.reduce((best, b, k) => (b.length < buckets[best].length ? k : best), 0);
    buckets[i].push({ u, aiStart: u.fixed_time ? toMin(u.fixed_time) : null, minutes: null, reason: null });
  }

  // never more Ato picks than the pace allows; the traveller's own places always stay
  for (const b of buckets) {
    const mine = b.filter((r) => r.u).length;
    let room = Math.max(0, max - mine);
    for (let k = 0; k < b.length; k++) {
      if (b[k].c) { if (room > 0) room--; else { b.splice(k, 1); k--; } }
    }
  }

  const picks = buckets.reduce((n, b) => n + b.filter((r) => r.c).length, 0);
  if (input.candidates.length > 0 && picks === 0) return null;    // the model filled nothing

  const plan: Scheduled[] = [];
  buckets.forEach((b, i) => {
    // the model's order by time; fixed times win; rows without a time keep their place at the end
    const rows = b.map((r, k) => ({ r, k, t: r.u?.fixed_time ? Math.max(toMin(r.u.fixed_time), r.aiStart ?? 0) : r.aiStart }))
      .sort((a, z) => (a.t ?? 9e9) - (z.t ?? 9e9) || a.k - z.k)
      .map((x) => x.r);
    let clock = DAY_START[input.pace];
    rows.forEach((r, position) => {
      const lat = r.u ? r.u.lat : r.c!.lat, lng = r.u ? r.u.lng : r.c!.lng;
      if (position > 0) {
        const p = rows[position - 1];
        clock += travelMinutes(distanceM(p.u ? p.u.lat : p.c!.lat, p.u ? p.u.lng : p.c!.lng, lat, lng) / 1000);
      }
      if (r.aiStart !== null && r.aiStart > clock && r.aiStart < DAY_END) clock = r.aiStart;
      if (r.u?.fixed_time) clock = Math.max(clock, toMin(r.u.fixed_time));
      const category: Category = cat(r.u ? r.u.category : r.c!.category);
      const duration = Math.round(Math.min(180, Math.max(30, r.minutes ?? DURATION[category])) / 5) * 5;
      plan.push(r.u
        ? { id: r.u.id, name: r.u.name, lat, lng, category, source: "user",
            reason: r.u.fixed_time ? `Fixed at ${r.u.fixed_time.slice(0, 5)}` : null,
            day: i + 1, position, start: toHHMM(clock), duration }
        : { id: null, ref: r.c!.ref, name: r.c!.name, lat, lng, category, source: "ato",
            reason: r.reason ?? "Close to the rest of the day",
            day: i + 1, position, start: toHHMM(clock), duration });
      clock += duration;
    });
  });

  const titles = ai.days
    .filter((d) => d.day >= 1 && d.day <= days && d.title?.trim())
    .map((d) => ({ day: Math.round(d.day), title: d.title.trim().slice(0, 60) }));
  return { plan, titles };
}
