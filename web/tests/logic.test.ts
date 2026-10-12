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
