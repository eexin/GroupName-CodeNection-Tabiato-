import { CATEGORY_LABEL, categoriseLabel, type Category } from "@/lib/categories";
import { dayKey, formatHour12, hourOf } from "@/lib/time";

/**
 * Everything the memory book and insights say is computed HERE, in code.
 * The language model only turns these facts into prose — it never invents a number or a place.
 * Pure function, unit-tested.
 */

export type FactInput = {
  places: { id: string; name: string; category: string | null; first_seen_at: string | null }[];
  photos: { place_id: string | null; taken_at: string | null; uploaded_by: string }[];
  ratings: { place_id: string; stars: number }[];
  expenses: { amount: number; label: string | null; place_id: string | null }[];
  people: Record<string, string>; // user id → display name
};

export type PlaceFact = {
  id: string;
  name: string;
  category: Category;
  arrival: string | null;
  arrivalHour: number | null;
  photos: number;
  rating: number | null;
  spend: number;
};

export type Facts = {
  days: { day: string; places: PlaceFact[] }[];
  totals: { photos: number; places: number; spend: number; days: number };
  spendByCategory: { category: Category; label: string; amount: number; share: number }[];
  topRated: PlaceFact[];
  contributors: { name: string; photos: number }[];
  observations: string[];
  travelType: string;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeFacts(input: FactInput): Facts {
  const photosByPlace = new Map<string, number>();
  for (const p of input.photos) if (p.place_id) photosByPlace.set(p.place_id, (photosByPlace.get(p.place_id) ?? 0) + 1);

  const ratingsByPlace = new Map<string, number[]>();
  for (const r of input.ratings) ratingsByPlace.set(r.place_id, [...(ratingsByPlace.get(r.place_id) ?? []), r.stars]);

  const spendByPlace = new Map<string, number>();
  for (const e of input.expenses) if (e.place_id) spendByPlace.set(e.place_id, (spendByPlace.get(e.place_id) ?? 0) + Number(e.amount));

  const places: PlaceFact[] = input.places
    .map((p) => {
      const r = avg(ratingsByPlace.get(p.id) ?? []);
      return {
        id: p.id,
        name: p.name,
        category: ((p.category as Category) ?? "other") as Category,
        arrival: p.first_seen_at,
        arrivalHour: p.first_seen_at ? hourOf(p.first_seen_at) : null,
        photos: photosByPlace.get(p.id) ?? 0,
        rating: r === null ? null : round1(r),
        spend: spendByPlace.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => (a.arrival ?? "").localeCompare(b.arrival ?? ""));

  // group by day
  const dayMap = new Map<string, PlaceFact[]>();
  for (const p of places) {
    const k = p.arrival ? dayKey(p.arrival) : "undated";
    dayMap.set(k, [...(dayMap.get(k) ?? []), p]);
  }
  const days = [...dayMap.entries()].filter(([k]) => k !== "undated").map(([day, ps]) => ({ day, places: ps }));

  // spend by category — expense label wins, otherwise the place category
  const placeCat = new Map(places.map((p) => [p.id, p.category]));
  const catTotals = new Map<Category, number>();
  let spend = 0;
  for (const e of input.expenses) {
    const fromLabel = categoriseLabel(e.label);
    const cat = fromLabel !== "other" ? fromLabel : (e.place_id ? placeCat.get(e.place_id) : undefined) ?? "other";
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + Number(e.amount));
    spend += Number(e.amount);
  }
  const spendByCategory = [...catTotals.entries()]
    .map(([category, amount]) => ({ category, label: CATEGORY_LABEL[category], amount, share: spend ? amount / spend : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const topRated = places.filter((p) => p.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3);

  const byPerson = new Map<string, number>();
  for (const p of input.photos) byPerson.set(p.uploaded_by, (byPerson.get(p.uploaded_by) ?? 0) + 1);
  const contributors = [...byPerson.entries()]
    .map(([id, n]) => ({ name: input.people[id] ?? "Someone", photos: n }))
    .sort((a, b) => b.photos - a.photos);

  const observations = observe({ places, days, spendByCategory, photos: input.photos, contributors });

  return {
    days,
    totals: { photos: input.photos.length, places: places.length, spend, days: days.length },
    spendByCategory,
    topRated,
    contributors,
    observations,
    travelType: travelType(places, days, input.photos),
  };
}

function observe(d: {
  places: PlaceFact[];
  days: { day: string; places: PlaceFact[] }[];
  spendByCategory: Facts["spendByCategory"];
  photos: FactInput["photos"];
  contributors: Facts["contributors"];
}): string[] {
  const out: string[] = [];

  // 1. your best-rated stops share an arrival time
  const best = d.places.filter((p) => p.rating !== null && p.rating >= 4.5 && p.arrivalHour !== null);
  const rest = d.places.filter((p) => p.rating !== null && p.rating < 4.5 && p.arrivalHour !== null);
  if (best.length >= 2) {
    const latest = Math.max(...best.map((p) => p.arrivalHour as number));
    const cutoff = latest + 1;
    const restLater = rest.length === 0 || rest.some((p) => (p.arrivalHour as number) >= cutoff);
    if (cutoff <= 12 && restLater) out.push(`Every stop you rated 5★ was one you arrived at before ${formatHour12(cutoff)}.`);
  }

  // 2. when you take photos
  const hours = d.photos.map((p) => (p.taken_at ? hourOf(p.taken_at) : null)).filter((h): h is number => h !== null);
  if (hours.length >= 6) {
    let bestStart = 0, bestCount = 0;
    for (let h = 0; h < 23; h++) {
      const c = hours.filter((x) => x === h || x === h + 1).length;
      if (c > bestCount) { bestCount = c; bestStart = h; }
    }
    if (bestCount / hours.length >= 0.35) {
      const golden = bestStart >= 16 && bestStart <= 18 ? " — golden hour suits you" : "";
      out.push(`You took the most photos between ${formatHour12(bestStart)} and ${formatHour12(bestStart + 2)}${golden}.`);
    }
  }

  // 3. where the money went
  const top = d.spendByCategory[0];
  if (top && top.share >= 0.35 && top.category !== "other") {
    out.push(`${top.label} was ${Math.round(top.share * 100)}% of everything you spent.`);
  }

  // 4. fewer stops, better days
  const scored = d.days
    .map((day) => ({ n: day.places.length, r: avg(day.places.map((p) => p.rating).filter((r): r is number => r !== null)) }))
    .filter((x): x is { n: number; r: number } => x.r !== null);
  if (scored.length >= 3) {
    const median = [...scored].sort((a, b) => a.n - b.n)[Math.floor(scored.length / 2)].n;
    const light = scored.filter((x) => x.n <= median).map((x) => x.r);
    const heavy = scored.filter((x) => x.n > median).map((x) => x.r);
    const a = avg(light), b = avg(heavy);
    if (a !== null && b !== null && light.length && heavy.length && a - b >= 0.5) {
      out.push(`Days with fewer stops scored higher — ${round1(a)}★ against ${round1(b)}★.`);
    }
  }

  // 5. who held the camera
  if (d.contributors.length >= 2) {
    const total = d.contributors.reduce((s, c) => s + c.photos, 0);
    const lead = d.contributors[0];
    if (total && lead.photos / total >= 0.5) out.push(`${lead.name} took ${Math.round((lead.photos / total) * 100)}% of the photos.`);
  }

  return out;
}

function travelType(places: PlaceFact[], days: { places: PlaceFact[] }[], photos: FactInput["photos"]) {
  const perDay = days.length ? places.length / days.length : 0;
  const pace = perDay === 0 ? "Curious" : perDay <= 2.5 ? "Slow" : perDay >= 4.5 ? "Packed-schedule" : "Balanced";
  const hours = photos.map((p) => (p.taken_at ? hourOf(p.taken_at) : null)).filter((h): h is number => h !== null).sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : 12;
  const when = median < 12 ? "morning" : median >= 17 ? "evening" : "daytime";
  const counts = new Map<Category, number>();
  for (const p of places) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const topCat = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
  const noun: Record<Category, string> = { food: "foodie", nature: "wanderer", culture: "explorer", shopping: "browser", stay: "homebody", other: "explorer" };
  return `${pace} ${when} ${noun[topCat]}`;
}
