import assert from "node:assert/strict";
import { test } from "node:test";
import { bounds, centroid, distanceM } from "../src/lib/geo";
import { colorFor, initials, person } from "../src/lib/people";
import { formatHour12, formatRange, formatTime } from "../src/lib/time";
import { CATEGORY_LABEL, categorise } from "../src/lib/categories";

test("distance between two known points", () => {
  // Shibuya crossing → Tokyo Station is about 6.5 km
  const d = distanceM(35.6595, 139.7005, 35.6812, 139.7671) / 1000;
  assert.ok(d > 6 && d < 7, String(d));
  assert.equal(distanceM(1, 1, 1, 1), 0);
});

test("centroid and bounds", () => {
  assert.deepEqual(centroid([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }]), { lat: 1, lng: 2 });
  assert.deepEqual(bounds([{ lat: 1, lng: 5 }, { lat: -2, lng: 3 }]), [[3, -2], [5, 1]]);
  assert.equal(bounds([]), null);
});

test("initials and stable colours", () => {
  assert.equal(initials("Ee Xin"), "EX");
  assert.equal(initials("Qii"), "QI");
  assert.equal(initials("   "), "?");
  assert.equal(colorFor("abc"), colorFor("abc"));
  assert.equal(person("u1", "").name, "Traveller");
});

test("time formatting reads the wall clock", () => {
  assert.equal(formatTime("2026-06-08T07:05:00.000Z"), "07:05");
  assert.equal(formatHour12(9), "9am");
  assert.equal(formatHour12(17), "5pm");
  assert.equal(formatHour12(12), "12pm");
  assert.equal(formatRange(null, null), "No dates yet");
  assert.match(formatRange("2026-06-08", "2026-06-11"), /^8–11 Jun 2026$/);
  assert.match(formatRange("2026-06-28", "2026-07-02"), /28 Jun – 2 Jul 2026/);
});

test("every category has a label and unknown OSM tags fall back to other", () => {
  for (const c of ["food", "nature", "culture", "shopping", "stay", "other"]) assert.ok(CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]);
  assert.equal(categorise("amenity", "parking"), "other");
  assert.equal(categorise("historic", "anything"), "culture");
  assert.equal(categorise("shop", "bakery"), "food");
});

import { safeNext } from "../src/lib/safe-next";

test("after-login redirect never leaves the site", () => {
  assert.equal(safeNext("/u/max"), "/u/max");
  assert.equal(safeNext("/trips/abc?view=timeline"), "/trips/abc?view=timeline");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null, "/a b", "/x\"onload"]) {
    assert.equal(safeNext(bad as string), "/", String(bad));
  }
});
