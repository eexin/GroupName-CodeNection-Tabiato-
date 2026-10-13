import assert from "node:assert/strict";
import { test } from "node:test";
import { clusterPhotos } from "../src/features/places/cluster";
import { computeFacts } from "../src/features/memory-book/facts";
import { categorise, categoriseLabel } from "../src/lib/categories";
import { wallClockToIso, hourOf } from "../src/lib/time";

let n = 0;
const id = () => `p${++n}`;
const T = (h: number, m = 0) => Date.UTC(2026, 9, 12, h, m);

test("eight photos at one crossing become one place", () => {
  n = 0;
  const photos = Array.from({ length: 8 }, (_, i) => ({
    id: `ph${i}`, lat: 35.6595 + i * 0.00002, lng: 139.7005 + i * 0.00002, takenAt: T(17, 30 + i * 5), placeId: null,
  }));
  const r = clusterPhotos(photos, [], id);
  assert.equal(r.newPlaces.length, 1);
  assert.equal(r.assignments.length, 8);
  assert.ok(r.assignments.every((a) => a.placeId === r.newPlaces[0].id));
});

test("two spots 2 km apart become two places", () => {
  n = 0;
  const r = clusterPhotos(
    [
      { id: "a", lat: 35.6595, lng: 139.7005, takenAt: T(9), placeId: null },
      { id: "b", lat: 35.6655, lng: 139.7707, takenAt: T(11), placeId: null },
    ],
    [], id);
  assert.equal(r.newPlaces.length, 2);
});

test("same spot, next morning, becomes a new place (time gap)", () => {
  n = 0;
  const r = clusterPhotos(
    [
      { id: "a", lat: 35.6595, lng: 139.7005, takenAt: T(9), placeId: null },
      { id: "b", lat: 35.6595, lng: 139.7005, takenAt: T(9) + 24 * 3600e3, placeId: null },
    ],
    [], id);
  assert.equal(r.newPlaces.length, 2);
});

test("a new photo joins an existing place and updates it", () => {
  n = 0;
  const existing = [{ id: "P1", lat: 35.6595, lng: 139.7005, first: T(9), last: T(10) }];
  const r = clusterPhotos(
    [
      { id: "old", lat: 35.6595, lng: 139.7005, takenAt: T(9), placeId: "P1" },
      { id: "new", lat: 35.6597, lng: 139.7006, takenAt: T(11), placeId: null },
    ],
    existing, id);
  assert.equal(r.newPlaces.length, 0);
  assert.deepEqual(r.assignments, [{ photoId: "new", placeId: "P1" }]);
  assert.equal(r.updatedPlaces.length, 1);
  assert.equal(r.updatedPlaces[0].last, T(11));
});

test("photos without coordinates are never placed automatically", () => {
  n = 0;
  const r = clusterPhotos([{ id: "x", lat: null, lng: null, takenAt: T(9), placeId: null }], [], id);
  assert.equal(r.assignments.length, 0);
  assert.equal(r.newPlaces.length, 0);
});

test("wall-clock time survives regardless of timezone", () => {
  const d = new Date(2026, 5, 9, 7, 24, 0); // 07:24 local on the device
  assert.equal(hourOf(wallClockToIso(d)), 7);
});

test("categories", () => {
  assert.equal(categorise("amenity", "restaurant"), "food");
  assert.equal(categorise("tourism", "museum"), "culture");
  assert.equal(categorise("natural", "beach"), "nature");
  assert.equal(categoriseLabel("Lunch"), "food");
  assert.equal(categoriseLabel("Grab to hotel"), "other");
});

test("facts: 5-star stops before 9am observation, spend share, travel type", () => {
  const iso = (d: number, h: number) => new Date(Date.UTC(2026, 5, 8 + d, h, 0)).toISOString();
  const places = [
    { id: "a", name: "Uluwatu cliff", category: "nature", first_seen_at: iso(0, 7) },
    { id: "b", name: "Warung Nia", category: "food", first_seen_at: iso(0, 8) },
    { id: "c", name: "Temple day", category: "culture", first_seen_at: iso(1, 14) },
    { id: "d", name: "Beach club", category: "nature", first_seen_at: iso(2, 16) },
  ];
  const photos = [
    ...Array.from({ length: 5 }, () => ({ place_id: "a", taken_at: iso(0, 7), uploaded_by: "u1" })),
    ...Array.from({ length: 3 }, () => ({ place_id: "d", taken_at: iso(2, 17), uploaded_by: "u2" })),
  ];
  const f = computeFacts({
    places,
    photos,
    ratings: [
      { place_id: "a", stars: 5 }, { place_id: "b", stars: 5 },
      { place_id: "c", stars: 3 }, { place_id: "d", stars: 4 },
    ],
    expenses: [
      { amount: 120, label: "Lunch", place_id: "b" },
      { amount: 40, label: "Dinner", place_id: "b" },
      { amount: 60, label: "Grab", place_id: null },
    ],
    people: { u1: "Ee Xin", u2: "Max" },
  });
  assert.equal(f.totals.places, 4);
  assert.equal(f.totals.spend, 220);
  assert.equal(f.days.length, 3);
  assert.ok(f.observations.some((o) => o.startsWith("Every stop you rated 5★ was one you arrived at before 9am")), f.observations.join(" | "));
  assert.ok(f.observations.some((o) => o.startsWith("Food was 73%")), f.observations.join(" | "));
  assert.equal(f.topRated[0].rating, 5);
  assert.match(f.travelType, /morning/);
});

test("facts: no observation is invented from thin data", () => {
  const f = computeFacts({ places: [], photos: [], ratings: [], expenses: [], people: {} });
  assert.deepEqual(f.observations, []);
  assert.equal(f.totals.spend, 0);
});

import { buildItinerary, groupConflicts, type Candidate, type UserStop } from "../src/features/planner/itinerary";

const U = (id: string, lat: number, lng: number, extra: Partial<UserStop> = {}): UserStop =>
  ({ id, name: id, lat, lng, category: "culture", fixed_day: null, fixed_time: null, ...extra });
const C = (ref: string, lat: number, lng: number, category: Candidate["category"], notable = false): Candidate =>
  ({ ref, name: ref, lat, lng, category, notable });

test("planner never drops a stop the user added", () => {
  const userStops = [U("a", 34.68, 135.52), U("b", 34.66, 135.50), U("c", 34.65, 135.43), U("d", 34.69, 135.50), U("e", 34.70, 135.49)];
  const out = buildItinerary({ userStops, candidates: [], days: 2, pace: "slow", interests: [], center: { lat: 34.69, lng: 135.5 } });
  assert.deepEqual(out.filter((s) => s.source === "user").map((s) => s.id).sort(), ["a", "b", "c", "d", "e"]);
});

test("a stop pinned to day 2 at 14:00 stays there and starts no earlier", () => {
  const out = buildItinerary({
    userStops: [U("tl", 35.64, 139.78, { fixed_day: 2, fixed_time: "14:00" }), U("x", 35.71, 139.79)],
    candidates: [], days: 3, pace: "balanced", interests: [], center: { lat: 35.68, lng: 139.76 },
  });
  const tl = out.find((s) => s.id === "tl")!;
  assert.equal(tl.day, 2);
  assert.ok(tl.start >= "14:00", tl.start);
});

test("fills to the pace with nearby places matching interests, max one food fill per day", () => {
  const out = buildItinerary({
    userStops: [U("a", 34.68, 135.52)],
    candidates: [C("r1", 34.681, 135.521, "food"), C("r2", 34.682, 135.522, "food"), C("m1", 34.683, 135.519, "culture", true), C("p1", 34.679, 135.518, "nature"), C("far", 35.5, 136.5, "culture")],
    days: 1, pace: "balanced", interests: ["food", "culture"], center: { lat: 34.68, lng: 135.52 },
  });
  assert.equal(out.length, 4);
  assert.equal(out.filter((s) => s.category === "food").length, 1);
  assert.ok(!out.some((s) => s.ref === "far"));
  assert.ok(out.every((s, i) => i === 0 || s.start > out[i - 1].start));
});

test("group board names conflicts without scoring anyone", () => {
  const c = groupConflicts([
    { name: "Ee Xin", budget: "mid", pace: "slow", interests: ["food", "culture"] },
    { name: "Max", budget: "budget", pace: "packed", interests: ["food", "nightlife"] },
  ]);
  assert.deepEqual(c.map((x) => x.title), ["Budget spread", "Pace", "Shared interests"]);
  assert.match(c[2].detail, /food/);
});

import { rainWindow, summary, tripDay } from "../src/features/live/live-logic";

const H = (hour: number, rain: number) => ({ time: `2026-10-14T${String(hour).padStart(2, "0")}:00`, hour, rain, code: 0, temp: 20 });

test("rain window finds the longest daytime run above the threshold", () => {
  const hours = [H(9, 10), H(10, 20), H(14, 40), H(15, 80), H(16, 90), H(17, 70), H(18, 30), H(21, 100)];
  assert.deepEqual(rainWindow(hours), { from: 15, to: 18, peak: 90 });
  assert.equal(rainWindow([H(12, 20), H(13, 30)]), null);
  assert.deepEqual(summary(hours), { min: 20, max: 20, rainMax: 90 });
});

test("trip day is only set while the trip is running", () => {
  const trip = { start_date: "2026-10-12", end_date: "2026-10-16" };
  assert.deepEqual(tripDay(trip, "2026-10-14"), { n: 3, len: 5 });
  assert.equal(tripDay(trip, "2026-10-11"), null);
  assert.equal(tripDay(trip, "2026-10-17"), null);
});

import { learnFromHistory } from "../src/features/planner/itinerary";

test("learning from history: boosts loved categories, avoids disliked, keeps days light when that scored better", () => {
  const l = learnFromHistory({
    ratings: [
      { category: "food", stars: 5 }, { category: "food", stars: 4.5 },
      { category: "shopping", stars: 2 }, { category: "shopping", stars: 3 },
      { category: "culture", stars: 4 },            // only one rating: not enough evidence
    ],
    days: [{ stops: 2, rating: 5 }, { stops: 2, rating: 4.5 }, { stops: 4, rating: 2.75 }],
  });
  assert.deepEqual(l.boost, ["food"]);
  assert.deepEqual(l.avoid, ["shopping"]);
  assert.equal(l.ratings.culture, undefined);
  assert.equal(l.maxPerDay, 3);
  assert.equal(l.notes.length, 3);
});

test("planner uses what it learned: fewer stops a day, avoided category never filled", () => {
  const learned = learnFromHistory({
    ratings: [{ category: "shopping", stars: 2 }, { category: "shopping", stars: 2 }],
    days: [{ stops: 2, rating: 5 }, { stops: 3, rating: 4.5 }, { stops: 5, rating: 3 }],
  });
  const out = buildItinerary({
    userStops: [U("a", 34.68, 135.52)],
    candidates: [C("mall", 34.6801, 135.5201, "shopping", true), C("m1", 34.683, 135.519, "culture"), C("p1", 34.679, 135.518, "nature"), C("m2", 34.684, 135.521, "culture")],
    days: 1, pace: "packed", interests: [], center: { lat: 34.68, lng: 135.52 }, learned,
  });
  assert.equal(out.length, 3);                       // packed would be 6, history says 3
  assert.ok(!out.some((s) => s.category === "shopping"));
});

import { planHazardSwap } from "../src/features/live/live-logic";

test("hazard reschedule swaps the first outdoor day with the next all-indoor day", () => {
  const stops = [
    { id: "a", day: 4, category: "nature" }, { id: "b", day: 4, category: "culture" },
    { id: "c", day: 5, category: "culture" }, { id: "d", day: 5, category: "food" },
  ];
  assert.deepEqual(planHazardSwap(stops, 4, 5), { kind: "swap", from: 4, to: 5 });
  assert.deepEqual(planHazardSwap([{ id: "a", day: 3, category: "nature" }, { id: "b", day: 4, category: "nature" }], 3, 5), { kind: "swap", from: 3, to: 5 });
  assert.equal(planHazardSwap([{ id: "a", day: 5, category: "nature" }], 5, 5), null);   // last day: nowhere to go
  assert.equal(planHazardSwap([{ id: "x", day: 2, category: "culture" }], 1, 3), null);   // nothing outdoors
});

import { parseQuery } from "../src/features/search/parse";

test("plain-language search becomes filters", () => {
  const ctx = { people: ["Max Teoh", "Qii"], trips: ["Bali getaway", "Tokyo", "Seoul solo trip"] };
  assert.deepEqual(
    { ...parseQuery("Where did I eat the best ramen?", ctx) },
    { text: "ramen", minRating: null, category: "food", withPerson: null, inTrip: null, timeOfDay: null, sort: "rating" });
  const spend = parseQuery("What did I spend most on in Bali?", ctx);
  assert.equal(spend.sort, "spend");
  assert.equal(spend.inTrip, "Bali getaway");
  assert.equal(parseQuery("Places I went with Max", ctx).withPerson, "Max Teoh");
  assert.equal(parseQuery("Everything I rated 5 stars", ctx).minRating, 5);
  assert.equal(parseQuery("five star mornings", ctx).timeOfDay, "morning");
  assert.equal(parseQuery("shibuya", ctx).text, "shibuya");
  assert.equal(parseQuery("places with nobody", ctx).withPerson, null);
});

test("the traveller's first must-visit leads day 1, even if it's not the westernmost", () => {
  const userStops = [U("east", 34.70, 135.60), U("west", 34.66, 135.40), U("mid", 34.68, 135.50)];
  const out = buildItinerary({ userStops, candidates: [], days: 3, pace: "slow", interests: [], center: { lat: 34.68, lng: 135.5 } });
  assert.equal(out.find((s) => s.id === "east")!.day, 1);
});

import { parseMapsLink } from "../src/features/planner/maps-link";

test("a pasted Google Maps link becomes a place", () => {
  const p = parseMapsLink("https://www.google.com/maps/place/Osaka+Castle/@34.6873153,135.5236015,17z/data=!3m1!4b1!4m6!3m5!1s0x6000e0c!8m2!3d34.6872571!4d135.5258546");
  assert.equal(p?.name, "Osaka Castle");
  assert.ok(Math.abs(p!.lat - 34.6872571) < 1e-6 && Math.abs(p!.lng - 135.5258546) < 1e-6); // the pin, not the camera
  assert.deepEqual(parseMapsLink("https://maps.google.com/?q=35.6595,139.7005"), { name: "Pinned place", lat: 35.6595, lng: 139.7005 });
  assert.equal(parseMapsLink("https://example.com/not-a-map"), null);
  assert.equal(parseMapsLink("https://www.google.com/maps/@999,999,3z"), null);
});

test("must-do clash: two people pin different places to the same evening", () => {
  const c = groupConflicts([{ name: "Ee Xin" }, { name: "Max" }], [
    { name: "Dotonbori", by: "Max", fixed_day: 2, fixed_time: "19:00:00" },
    { name: "Umeda Sky", by: "Ee Xin", fixed_day: 2, fixed_time: "20:00:00" },
    { name: "Castle", by: "Ee Xin", fixed_day: 1, fixed_time: "10:00:00" },
  ]);
  const clash = c.find((x) => x.title === "Must-do clash");
  assert.ok(clash && /Dotonbori/.test(clash.detail) && /day 2/.test(clash.detail));
  assert.equal(c.filter((x) => x.title === "Must-do clash").length, 1);
});

import { aiPlanPrompt, aiPlanSchema, applyAiPlan, shortlist } from "../src/features/planner/ai-plan";

test("AI plan: invented places are dropped, real picks keep Ato's reason and order", () => {
  const ai = aiPlanSchema.parse({ days: [{ day: 1, title: "Temples and ramen", stops: [
    { id: "m1", start: "09:00", minutes: 90, reason: "A calm morning temple — you love culture." },
    { id: "made-up-place", start: "11:00", minutes: 60, reason: "Does not exist" },
    { id: "r1", start: "12:00", minutes: 60, reason: "Lunch right next door." },
  ] }] });
  const out = applyAiPlan(ai, { userStops: [], candidates: [C("m1", 34.68, 135.52, "culture"), C("r1", 34.681, 135.521, "food")], days: 1, pace: "balanced" })!;
  assert.deepEqual(out.plan.map((s) => s.ref), ["m1", "r1"]);
  assert.equal(out.plan[0].reason, "A calm morning temple — you love culture.");
  assert.equal(out.plan[1].start, "12:00");
  assert.deepEqual(out.titles, [{ day: 1, title: "Temples and ramen" }]);
});

test("AI plan: a must-visit the model forgot or moved is put back on its pinned day and time", () => {
  const ai = aiPlanSchema.parse({ days: [
    { day: 1, title: "", stops: [{ id: "tl", start: "08:00" }, { id: "m1", start: "10:00" }] },
    { day: 2, title: "", stops: [{ id: "p1", start: "09:00" }] },
  ] });
  const out = applyAiPlan(ai, {
    userStops: [U("tl", 35.64, 139.78, { fixed_day: 2, fixed_time: "14:00" }), U("x", 35.71, 139.79)],
    candidates: [C("m1", 35.70, 139.77, "culture"), C("p1", 35.65, 139.77, "nature")], days: 2, pace: "balanced",
  })!;
  const tl = out.plan.find((s) => s.id === "tl")!;
  assert.equal(tl.day, 2);
  assert.ok(tl.start >= "14:00", tl.start);
  assert.ok(out.plan.some((s) => s.id === "x"), "forgotten must-visit is kept");
});

test("AI plan: times never overlap and picks are capped by the pace", () => {
  const cands = ["a", "b", "c", "d", "e", "f", "g", "h"].map((r, i) => C(r, 34.68 + i * 0.001, 135.52, "culture"));
  const ai = aiPlanSchema.parse({ days: [{ day: 1, title: "", stops: cands.map((c) => ({ id: c.ref, start: "10:00", minutes: 120 })) }] });
  const out = applyAiPlan(ai, { userStops: [], candidates: cands, days: 1, pace: "slow" })!;
  assert.equal(out.plan.length, 3);
  for (let i = 1; i < out.plan.length; i++) {
    const prevEnd = Number(out.plan[i - 1].start.slice(0, 2)) * 60 + Number(out.plan[i - 1].start.slice(3)) + out.plan[i - 1].duration;
    const start = Number(out.plan[i].start.slice(0, 2)) * 60 + Number(out.plan[i].start.slice(3));
    assert.ok(start >= prevEnd, `${out.plan[i].start} starts before the previous stop ends`);
  }
});

test("AI plan: an answer with no usable places is rejected so the rules planner takes over", () => {
  const ai = aiPlanSchema.parse({ days: [{ day: 1, title: "x", stops: [{ id: "nowhere" }] }] });
  assert.equal(applyAiPlan(ai, { userStops: [], candidates: [C("m1", 1, 1, "culture")], days: 1, pace: "balanced" }), null);
});

test("AI plan prompt: only real shortlisted places, avoided categories ranked last", () => {
  const list = shortlist({
    candidates: [C("bar", 34.68, 135.52, "food"), C("museum", 34.69, 135.53, "culture", true), C("u", 34.68, 135.52, "culture")],
    userStops: [U("u", 34.68, 135.52)], interests: ["culture"], center: { lat: 34.68, lng: 135.52 },
    learned: { boost: [], avoid: ["food"], ratings: {}, maxPerDay: null, notes: [] },
  });
  assert.deepEqual(list.map((c) => c.ref), ["museum", "bar"]);
  const prompt = JSON.parse(aiPlanPrompt({ destination: "Osaka", startDate: "2026-11-02", days: 2, pace: "balanced", interests: ["culture"], budget: null, userStops: [U("u", 34.68, 135.52)], shortlist: list }));
  assert.equal(prompt.trip.dates[0].weekday, "Monday");
  assert.deepEqual(prompt.candidates.map((c: { ref: string }) => c.ref), ["museum", "bar"]);
  assert.equal(prompt.must_visit[0].id, "u");
});

import { namedSchema, namesToCheck, toCandidate } from "../src/features/planner/named-places";

const OSAKA = { lat: 34.6937, lng: 135.5023 };

test("a name Ato gives is kept only if the map finds it near the destination", () => {
  const near = toCandidate({ name: "Kuromon Market", kind: "food" },
    [{ name: "Kuromon Ichiba Market", lat: 34.6655, lng: 135.5068, category: "food", ref: "way/123" }], OSAKA);
  assert.equal(near?.name, "Kuromon Ichiba Market"); // the map's name, not the model's
  assert.equal(near?.ref, "way/123");
  assert.equal(near?.notable, true);

  // same name, wrong city (Tokyo): dropped
  const far = toCandidate({ name: "Senso-ji" }, [{ name: "Senso-ji", lat: 35.7148, lng: 139.7967, category: "culture", ref: "way/9" }], OSAKA);
  assert.equal(far, null);
  // the map found nothing: dropped, never guessed
  assert.equal(toCandidate({ name: "Made-up Ramen House" }, [], OSAKA), null);
});

test("the map's category wins over Ato's; Ato's fills in only when the map has none", () => {
  const hit = (category: "culture" | "other") => [{ name: "X", lat: 34.69, lng: 135.5, category, ref: "node/1" }];
  assert.equal(toCandidate({ name: "X", kind: "food" }, hit("culture"), OSAKA)?.category, "culture");
  assert.equal(toCandidate({ name: "X", kind: "Shopping" }, hit("other"), OSAKA)?.category, "shopping");
  assert.equal(toCandidate({ name: "X", kind: "spaceship" }, hit("other"), OSAKA)?.category, "other");
  // the map only says "attraction" (how OSM tags Shinsaibashi-suji): Ato's "shopping" is better
  const arcade = [{ name: "Shinsaibashi-suji Shopping Arcade", lat: 34.6735, lng: 135.5014, category: "culture" as const, type: "attraction", ref: "way/7" }];
  assert.equal(toCandidate({ name: "Shinsaibashi-suji", kind: "shopping" }, arcade, OSAKA)?.category, "shopping");
  // a specific map tag (a temple) still beats Ato's guess
  const temple = [{ name: "Shitennoji", lat: 34.6537, lng: 135.5164, category: "culture" as const, type: "temple", ref: "way/8" }];
  assert.equal(toCandidate({ name: "Shitennoji", kind: "food" }, temple, OSAKA)?.category, "culture");
});

test("names to check skip the traveller's own places and duplicates", () => {
  const list = namesToCheck([{ name: "Osaka Castle" }, { name: " Shinsekai " }, { name: "shinsekai" }, { name: "Kuromon Market" }], ["osaka castle"]);
  assert.deepEqual(list.map((n) => n.name), ["Shinsekai", "Kuromon Market"]);
  assert.equal(namedSchema.safeParse({ places: [{ name: "A" }] }).success, false); // too short to search
});

import { applyStays, budgetTier, eatsNearStops, rankStays, type MapPlace } from "../src/features/planner/stays";

const STOPS = [
  { id: "s1", name: "Osaka Castle", lat: 34.6873, lng: 135.5262, day: 1 },
  { id: "s2", name: "Dotonbori", lat: 34.6687, lng: 135.5013, day: 2 },
];
const place = (ref: string, name: string, lat: number, lng: number, kind = "hotel", stars: number | null = null, cuisine: string | null = null): MapPlace => ({ ref, name, lat, lng, kind, stars, cuisine });

test("the trip budget per day sets the hotel class; the profile band is the fallback", () => {
  assert.equal(budgetTier(1000, 4, "luxury"), "budget"); // RM250 a day
  assert.equal(budgetTier(2000, 4, null), "mid");
  assert.equal(budgetTier(4000, 4, "budget"), "luxury");
  assert.equal(budgetTier(null, 4, "luxury"), "luxury");
  assert.equal(budgetTier(null, 4, undefined), "mid");
});

test("hotels are ranked by distance to the whole plan, and Ato may only pick from that list", () => {
  const ranked = rankStays([
    place("node/1", "Far Hotel", 34.75, 135.45),
    place("node/2", "Middle Hotel", 34.678, 135.513, "hotel", 4),
    place("node/3", "Namba Hostel", 34.667, 135.502, "hostel"),
    place("node/4", "", 34.678, 135.513),
  ], STOPS);
  assert.deepEqual(ranked.map((h) => h.name), ["Middle Hotel", "Namba Hostel", "Far Hotel"]); // unnamed dropped
  assert.equal(ranked[1].nearDay, 2);

  const picked = applyStays({ stays: [{ ref: "node/999", reason: "Invented" }, { ref: "node/3", reason: "Steps from Dotonbori!" }, { ref: "node/3", reason: "again" }] }, ranked, "budget");
  assert.deepEqual(picked.map((h) => h.name), ["Namba Hostel"]);
  assert.equal(picked[0].reason, "Steps from Dotonbori!");

  // no AI: budget class first by type, then the closest; reasons use the real facts
  const fallback = applyStays(null, ranked, "budget");
  assert.equal(fallback[0].name, "Namba Hostel");
  assert.match(fallback[0].reason, /km from your stops/);
  assert.equal(applyStays(null, ranked, "luxury")[0].name, "Middle Hotel");
});

test("each stop lists up to 3 restaurants within a short walk, never itself and never twice", () => {
  const foods = [
    place("n/a", "Kani Doraku", 34.6688, 135.5017, "restaurant", null, "seafood"),
    place("n/b", "Dotonbori", 34.6687, 135.5013, "restaurant"),
    place("n/c", "Ichiran", 34.6690, 135.5020, "restaurant", null, "ramen"),
    place("n/d", "Kushikatsu Daruma", 34.6680, 135.5030, "restaurant"),
    place("n/e", "Mizuno", 34.6685, 135.5010, "restaurant", null, "okonomiyaki"),
    place("n/f", "Castle Cafe", 34.6870, 135.5255, "restaurant"),
    place("n/g", "Kyoto Place", 35.0, 135.76, "restaurant"),
  ];
  const eats = eatsNearStops(STOPS, foods);
  assert.deepEqual(eats.s1.map((e) => e.name), ["Castle Cafe"]);
  assert.equal(eats.s2.length, 3);
  assert.ok(!eats.s2.some((e) => e.name === "Dotonbori"));
  assert.ok(eats.s2.every((e) => e.walkMin >= 1 && e.walkMin <= 10));
  assert.ok(!Object.values(eats).flat().some((e) => e.name === "Kyoto Place"));
});

import { boxFromNominatim, isTooBig, keepCity } from "../src/features/planner/destination";

test("a whole country or a big island asks for a city; cities never do (real map answers)", () => {
  // type and width as Nominatim reported them in Oct 2026
  for (const [name, kind, km] of [["Japan", "country", 2830], ["Bali", "state", 176], ["Hokkaido", "region", 552], ["Okinawa", "province", 878], ["Sabah", "state", 650], ["Jeju", "province", 136]] as const)
    assert.equal(isTooBig(kind, km), true, name);
  for (const [name, kind, km] of [["Tokyo", "city", 1741], ["Beijing", "city", 210], ["Singapore", "country", 112], ["Hong Kong", "region", 70], ["Penang", "state", 51], ["Phuket", "province", 104], ["Langkawi", "district", 47]] as const)
    assert.equal(isTooBig(kind, km), false, name);
  assert.equal(isTooBig(null, 5000), false);
});

test("Ato's city suggestions are kept only if the map puts a city-sized place inside the area", () => {
  const japan = { box: boxFromNominatim(["20.2", "45.7", "122.7", "154.2"], 36.6)!.box, countryCode: "JP" };
  assert.equal(keepCity({ lat: 34.69, lng: 135.50, kind: "city", km: 25, countryCode: "JP" }, japan), true);   // Osaka
  assert.equal(keepCity({ lat: 37.57, lng: 126.98, kind: "city", km: 37, countryCode: "KR" }, japan), false);  // Seoul: wrong country
  assert.equal(keepCity({ lat: 43.43, lng: 142.95, kind: "region", km: 552, countryCode: "JP" }, japan), false); // Hokkaido: still too big
  assert.equal(keepCity(null, japan), false);
  assert.equal(boxFromNominatim(["1", "2"], 0), null);
});

test("a shrine mapped as religious land is culture, not other", () => {
  assert.equal(categorise("landuse", "religious"), "culture"); // how OSM maps Fushimi Inari-taisha
  assert.equal(categorise("building", "church"), "culture");
});

import { cleanNews, looksRelevant } from "../src/features/live/news-filter";

test("trip intel news drops press releases and repeats, newest first", () => {
  const h = (title: string, source: string, published: string, link = `https://x/${title}`) => ({ title, source, published, link });
  const out = cleanNews([
    h("Miracle Surrogacy Celebrates Growing Families", "Ein Presswire", "2026-10-12"),
    h("Japan raises departure tax for tourists", "Kyodo", "2026-10-11"),
    h("Japan Raises Departure Tax for Tourists!", "Japan Times", "2026-10-12"), // same story
    h("Typhoon disrupts flights in Osaka", "NHK", "2026-10-12"),
  ]);
  assert.deepEqual(out.map((n) => n.source), ["Japan Times", "NHK"]);
});

test("without Ato, a headline must name the place and be about travel", () => {
  const places = ["Japan", "Osaka", "Japan"];
  assert.equal(looksRelevant("Typhoon disrupts flights in Osaka", places), true);
  assert.equal(looksRelevant("Japan to raise tourist tax next year", places), true);
  assert.equal(looksRelevant("Oil rises as Saudi Arabia vows response to attacks", places), false); // no place
  assert.equal(looksRelevant("Japan's central bank holds rates", places), false);                  // not travel
});

import { ITEMS, SLOTS, decodeLook, encodeLook, lookFromSeed, lookFromUrl, lookUrl, randomLook, renderLook } from "../src/lib/character";
import { avatarFor, person } from "../src/lib/people";

test("a character look survives the round trip through its URL code", () => {
  const look = { skin: 3, hairColor: 4, items: { hair: "hair_bun", hat: "hat_straw", neck: "neck_lei", back: "back_backpack" } };
  const code = encodeLook(look);
  assert.equal(code, "s3.c4.hair_bun.hat_straw.neck_lei.back_backpack");
  assert.deepEqual(decodeLook(code), look);
  assert.deepEqual(lookFromUrl(lookUrl(look)), look);
  assert.equal(lookFromUrl("https://x.supabase.co/storage/v1/object/public/avatars/u/a.jpg"), null); // a photo
});

test("unknown parts of a look are ignored, and one item per slot wins", () => {
  assert.equal(decodeLook("s9.c1"), null);             // no such skin
  assert.equal(decodeLook("<svg onload=x>"), null);
  assert.deepEqual(decodeLook("s0.c0.hat_cap.hat_straw.<script>.hair_pixel"), { skin: 0, hairColor: 0, items: { hat: "hat_straw" } });
  assert.equal(encodeLook({ skin: 0, hairColor: 0, items: { hat: "glasses_sun" } }), "s0.c0"); // item in the wrong slot
});

test("everyone without a photo gets the same character every time, and a photo always wins", () => {
  assert.deepEqual(lookFromSeed("user-1"), lookFromSeed("user-1"));
  assert.notDeepEqual(lookFromSeed("user-1"), lookFromSeed("user-2"));
  assert.match(avatarFor("user-1", null), /^\/api\/avatar\/s\d\.c\d\./);
  assert.equal(avatarFor("user-1", "https://x/photo.jpg"), "https://x/photo.jpg");
  assert.equal(person("user-1", "Max").avatar, avatarFor("user-1", null));
});

test("Surprise me only ever picks real items, one per slot", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 50; i++) {
    const look = randomLook(rand);
    for (const [slot, key] of Object.entries(look.items)) if (key) assert.equal(ITEMS[key].slot, slot);
    assert.ok(look.items.clothes, "always dressed");
  }
});

test("the character SVG has no scripts or links and draws every slot's item", () => {
  const all = Object.fromEntries(SLOTS.map((s) => [s, Object.keys(ITEMS).find((k) => ITEMS[k].slot === s)]));
  for (const view of ["bust", "full"] as const) {
    const svg = renderLook({ skin: 5, hairColor: 5, items: all }, view);
    assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'/);
    assert.doesNotMatch(svg, /<script|on\w+=|href=/i);
  }
});
