/**
 * Demo data for the finals. Run from web/:   npm run seed
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local.
 * Safe to re-run: it deletes the four demo accounts (and everything they own) first.
 *
 * The Bali trip is tuned so the memory book finds every pattern lib/facts.ts looks for:
 * 5★ stops all before 9am, most photos at golden hour, food over a third of spending,
 * lighter days rated higher, and one person holding the camera most of the time.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// must match DEMO_PASSWORD on Vercel so the "Try the demo" button can sign in
const PASSWORD = process.env.DEMO_PASSWORD || "tabiato-demo-2026";
const PEOPLE = {
  ex: { email: "eexin@demo.tabiato.app", name: "Ee Xin", style: { budget: "mid", pace: "slow", interests: ["food", "culture", "nature"] } },
  mx: { email: "max@demo.tabiato.app", name: "Max Teoh", style: { budget: "budget", pace: "packed", interests: ["food", "nightlife"] } },
  qi: { email: "qii@demo.tabiato.app", name: "Qii", style: { budget: "luxury", pace: "balanced", interests: ["shopping", "food"] } },
  jl: { email: "jim@demo.tabiato.app", name: "Jim Loong", style: { budget: "mid", pace: "balanced", interests: ["culture"] } },
  ky: { email: "kai@demo.tabiato.app", name: "Kai Yang", style: { budget: "budget", pace: "packed", interests: ["nature"] } },
} as const;
type Who = keyof typeof PEOPLE;
const ids = {} as Record<Who, string>;

/** for calls whose result we need */
function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error || r.data == null) throw new Error(`${what}: ${r.error?.message ?? "no data returned"}`);
  return r.data as NonNullable<T>;
}
/** for writes where only success matters */
function ok(r: { error: { message: string } | null }, what: string) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
}
const at = (date: string, hhmm: string) => `${date}T${hhmm}:00.000Z`; // wall clock encoded as UTC, like the app
const today = new Date();
const dayOffset = (n: number) => new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + n)).toISOString().slice(0, 10);
// off by default: alerts should only ever come from real events. `npm run seed -- --demo-alert` adds a labelled one.
const WITH_DEMO_ALERT = process.argv.includes("--demo-alert");
const addMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60000).toISOString();

// ---------- postcard images (no external downloads needed) ----------
const TONES: Record<string, [string, string]> = {
  food: ["#F9AE8C", "#C94A2C"], nature: ["#BFE4E0", "#0E4C55"], culture: ["#F6E7B8", "#C99A3E"],
  shopping: ["#DCE9F5", "#5C7FA8"], other: ["#E2EEEC", "#3D5C59"],
};
function postcard(place: string, category: string, n: number) {
  const [a, b] = TONES[category] ?? TONES.other;
  const safe = place.replace(/[&<>]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="1200" height="900" fill="url(#g)"/>
<path d="M0 ${620 + (n % 3) * 30} C300 ${540 + n * 12} 600 ${700 - n * 8} 1200 ${600 + (n % 2) * 40} V900 H0Z" fill="#ffffff" opacity="0.18"/>
<circle cx="${880 + (n % 4) * 40}" cy="${200 + (n % 3) * 30}" r="90" fill="#ffffff" opacity="0.28"/>
<text x="70" y="800" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${safe}</text>
<text x="70" y="850" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" opacity="0.85">demo photo ${n + 1}</text>
</svg>`;
}

// ---------- real photos (optional) ----------
// Put photos in scripts/demo-photos/<place-slug>/ — e.g. scripts/demo-photos/uluwatu-cliff/1.jpg.
// They're used instead of the generated postcards, and survive the nightly reset because they live in the repo.
const PHOTO_DIR = join(process.cwd(), "scripts", "demo-photos");
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function realPhotos(place: string): { body: Buffer; type: string; ext: string }[] {
  const dir = join(PHOTO_DIR, slug(place));
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => TYPES[extname(f).toLowerCase()]).sort()
    .map((f) => ({ body: readFileSync(join(dir, f)), type: TYPES[extname(f).toLowerCase()], ext: extname(f).toLowerCase() }));
}

// ---------- reset ----------
async function reset() {
  const emails = new Set<string>(Object.values(PEOPLE).map((p) => p.email));
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  const old = users.filter((u) => u.email && emails.has(u.email));
  if (!old.length) return;
  const { data: trips } = await db.from("trips").select("id").in("owner_id", old.map((u) => u.id));
  for (const t of trips ?? []) {
    const { data: files } = await db.storage.from("photos").list(t.id, { limit: 1000 });
    if (files?.length) await db.storage.from("photos").remove(files.map((f) => `${t.id}/${f.name}`));
  }
  for (const u of old) await db.auth.admin.deleteUser(u.id);
  console.log(`Removed ${old.length} previous demo accounts`);
}

// ---------- builders ----------
async function trip(owner: Who, fields: Record<string, unknown>, members: Who[] = []) {
  const t = must(await db.from("trips").insert({ owner_id: ids[owner], ...fields }).select("id").single(), "trip");
  if (members.length) {
    ok(await db.from("trip_members").insert(members.map((m) => ({ trip_id: t.id, user_id: ids[m], role: "contributor", status: "joined", invited_by: ids[owner] }))), "members");
  }
  return t.id as string;
}

type PlaceSpec = {
  name: string; category: string; lat: number; lng: number; arrive: string; photos: number;
  gapMin?: number; by?: Who[]; ratings?: Partial<Record<Who, number>>;
  spend?: { amount: number; label: string; by: Who; split?: number; currency?: string; myr?: number }[];
  note?: { by: Who; body: string }; comments?: { by: Who; body: string }[];
};

async function places(tripId: string, specs: PlaceSpec[]) {
  let uploaded = 0;
  for (const p of specs) {
    const placeId = randomUUID();
    const gap = p.gapMin ?? 12;
    const last = addMin(p.arrive, gap * Math.max(0, p.photos - 1));
    ok(await db.from("places").insert({ id: placeId, trip_id: tripId, name: p.name, category: p.category, lat: p.lat, lng: p.lng, first_seen_at: p.arrive, last_seen_at: last }), "place");

    const rows = [];
    const real = realPhotos(p.name);
    for (let i = 0; i < p.photos; i++) {
      const r = real.length ? real[i % real.length] : null;
      const path = `${tripId}/${randomUUID()}${r ? r.ext : ".svg"}`;
      const up = await db.storage.from("photos").upload(path, r ? r.body : Buffer.from(postcard(p.name, p.category, i)), { contentType: r ? r.type : "image/svg+xml" });
      if (up.error) throw new Error(`upload: ${up.error.message}`);
      const by = (p.by ?? ["ex"])[i % (p.by ?? ["ex"]).length];
      rows.push({
        trip_id: tripId, place_id: placeId, uploaded_by: ids[by], storage_path: path,
        taken_at: addMin(p.arrive, gap * i),
        lat: p.lat + (i % 3) * 0.00004, lng: p.lng + (i % 2) * 0.00004, location_source: "exif", width: 1200, height: 900,
      });
      uploaded++;
    }
    if (rows.length) ok(await db.from("photos").insert(rows), "photos");

    for (const [who, stars] of Object.entries(p.ratings ?? {})) {
      ok(await db.from("ratings").insert({ place_id: placeId, trip_id: tripId, user_id: ids[who as Who], stars }), "rating");
    }
    for (const s of p.spend ?? []) {
      ok(await db.from("expenses").insert({
        trip_id: tripId, place_id: placeId, paid_by: ids[s.by], amount: s.amount, label: s.label, split_count: s.split ?? 1,
        currency: s.currency ?? "MYR", amount_myr: s.myr ?? (s.currency && s.currency !== "MYR" ? null : s.amount),
      }), "expense");
    }
    if (p.note) ok(await db.from("notes").insert({ place_id: placeId, trip_id: tripId, user_id: ids[p.note.by], body: p.note.body }), "note");
    for (const c of p.comments ?? []) {
      ok(await db.from("comments").insert({ place_id: placeId, trip_id: tripId, user_id: ids[c.by], body: c.body }), "comment");
    }
  }
  return uploaded;
}

// ---------- main ----------
async function main() {
  await reset();

  for (const [key, p] of Object.entries(PEOPLE) as [Who, (typeof PEOPLE)[Who]][]) {
    const { data: created, error } = await db.auth.admin.createUser({ email: p.email, password: PASSWORD, email_confirm: true, user_metadata: { name: p.name } });
    if (error || !created.user) throw new Error(`user ${p.email}: ${error?.message ?? "not created"}`);
    ids[key] = created.user.id;
    const handle = { ex: "eexin", mx: "max", qi: "qii", jl: "jim", ky: "kai" }[key];
    ok(await db.from("profiles").update({ display_name: p.name, username: handle, travel_style: p.style, onboarded_at: new Date().toISOString() }).eq("id", ids[key]), "profile");
  }

  ok(await db.from("friendships").insert([
    { requester: ids.ex, addressee: ids.mx, status: "accepted" },
    { requester: ids.qi, addressee: ids.ex, status: "accepted" },
    { requester: ids.mx, addressee: ids.qi, status: "accepted" },
    { requester: ids.jl, addressee: ids.ex, status: "pending" },
  ]), "friends");

  // --- Bali: finished, three people. Tuned for every observation. ---
  const bali = await trip("ex", { name: "Bali getaway", destination: "Bali, Indonesia", start_date: "2026-06-08", end_date: "2026-06-11", status: "finished", is_public: true, dest_lat: -8.65, dest_lng: 115.22, country_code: "ID" }, ["mx", "qi"]);
  // Kai came on Bali but isn't a friend yet → "You travelled with them"; joined as view-only
  ok(await db.from("trip_members").insert({ trip_id: bali, user_id: ids.ky, role: "viewer", status: "joined", invited_by: ids.ex }), "kai");
  let photos = await places(bali, [
    { name: "Uluwatu cliff", category: "nature", lat: -8.8291, lng: 115.0849, arrive: at("2026-06-08", "07:10"), photos: 4, ratings: { ex: 5 },
      note: { by: "ex", body: "We had the cliff to ourselves for twenty minutes. Nobody wanted to leave." },
      comments: [{ by: "mx", body: "worth waking up at 6 for this" }] },
    { name: "Single Fin", category: "food", lat: -8.8150, lng: 115.0880, arrive: at("2026-06-08", "08:20"), photos: 2, ratings: { ex: 5 },
      spend: [{ amount: 120, label: "Brunch", by: "ex", split: 3 }] },
    { name: "Padang Padang Beach", category: "nature", lat: -8.8114, lng: 115.1030, arrive: at("2026-06-09", "07:40"), photos: 3, by: ["ex", "qi"], ratings: { ex: 5 } },
    { name: "Jimbaran Bay", category: "food", lat: -8.7710, lng: 115.1650, arrive: at("2026-06-09", "17:30"), photos: 8, gapMin: 9, by: ["ex", "ex", "mx"], ratings: { ex: 4 },
      spend: [{ amount: 180, label: "Seafood dinner", by: "mx", split: 3 }],
      comments: [{ by: "qi", body: "the grilled fish was unreal" }] },
    { name: "Tanah Lot", category: "culture", lat: -8.6212, lng: 115.0868, arrive: at("2026-06-10", "10:00"), photos: 3, ratings: { ex: 3, mx: 3 },
      spend: [{ amount: 30, label: "Temple entry", by: "ex" }] },
    { name: "Tegallalang Rice Terrace", category: "nature", lat: -8.4318, lng: 115.2791, arrive: at("2026-06-10", "12:30"), photos: 3, ratings: { ex: 3 } },
    { name: "Ubud Monkey Forest", category: "nature", lat: -8.5188, lng: 115.2585, arrive: at("2026-06-10", "14:30"), photos: 3, by: ["mx"], ratings: { ex: 3 } },
    { name: "Ubud Art Market", category: "shopping", lat: -8.5069, lng: 115.2625, arrive: at("2026-06-10", "16:30"), photos: 2, by: ["qi"], ratings: { ex: 2, mx: 2 },
      spend: [{ amount: 60, label: "Souvenirs", by: "qi" }] },
    { name: "Seminyak Beach", category: "nature", lat: -8.6913, lng: 115.1569, arrive: at("2026-06-11", "17:00"), photos: 6, gapMin: 14, ratings: { ex: 4 } },
  ]);
  ok(await db.from("expenses").insert({ trip_id: bali, place_id: null, paid_by: ids.ex, amount: 70, label: "Grab to airport" }), "expense");

  // --- Tokyo: ongoing and dated around today (today is day 3 of 5), so weather and replans are live ---
  const d1 = dayOffset(-2), d2 = dayOffset(-1), d3 = dayOffset(0), d4 = dayOffset(1);
  const tokyo = await trip("ex", {
    name: "Tokyo", destination: "Tokyo, Japan", start_date: d1, end_date: dayOffset(2), status: "ongoing",
    dest_lat: 35.6812, dest_lng: 139.7671, country_code: "JP",
    demo_alert: WITH_DEMO_ALERT ? {
      id: "demo-tc-1", type: "TC", name: "Demo typhoon", level: "Orange", country: "Japan",
      from: new Date().toISOString(), to: null, lat: 33.4, lng: 138.6, km: 280, url: null,
    } : null,
  }, ["mx"]);
  photos += await places(tokyo, [
    { name: "Tsukiji Outer Market", category: "food", lat: 35.6655, lng: 139.7707, arrive: at(d1, "08:30"), photos: 4, ratings: { ex: 5 },
      spend: [{ amount: 1500, currency: "JPY", myr: 46, label: "Breakfast crawl", by: "ex" }] },
    { name: "Shibuya Crossing", category: "culture", lat: 35.6595, lng: 139.7005, arrive: at(d1, "17:30"), photos: 5, by: ["ex", "mx"], ratings: { ex: 4 },
      spend: [{ amount: 4350, currency: "JPY", myr: 134, label: "Lunch", by: "mx", split: 3 }],
      note: { by: "ex", body: "Came back a second time just for the view from the Starbucks. Worth the queue." },
      comments: [{ by: "mx", body: "the crossing at night was crazy" }] },
    { name: "Senso-ji", category: "culture", lat: 35.7148, lng: 139.7967, arrive: at(d2, "09:10"), photos: 3, ratings: { ex: 4 } },
  ]);
  for (let i = 0; i < 2; i++) {
    // a real shot from scripts/demo-photos/no-location/ if there is one — it has no GPS on purpose
    const real = realPhotos("No location");
    const r = real.length ? real[i % real.length] : null;
    const path = `${tokyo}/${randomUUID()}${r ? r.ext : ".svg"}`;
    ok(await db.storage.from("photos").upload(path, r ? r.body : Buffer.from(postcard("No location", "other", i)), { contentType: r ? r.type : "image/svg+xml" }), "upload");
    ok(await db.from("photos").insert({ trip_id: tokyo, uploaded_by: ids.ex, storage_path: path, taken_at: at(d2, `1${8 + i}:05`), location_source: "none" }), "photo");
    photos++;
  }
  // the plan behind the trip — today has an outdoor stop in the afternoon, so real rain triggers a replan
  ok(await db.from("plan_stops").insert([
    { trip_id: tokyo, added_by: ids.ex, name: "teamLab Planets", lat: 35.6491, lng: 139.7898, category: "culture", source: "user", day: 3, position: 0, start_time: "11:00", duration_min: 90 },
    { trip_id: tokyo, added_by: ids.ex, name: "Hama-rikyu Gardens", lat: 35.6600, lng: 139.7633, category: "nature", source: "user", day: 3, position: 1, start_time: "15:00", duration_min: 90 },
    { trip_id: tokyo, added_by: ids.mx, name: "Meiji Jingu", lat: 35.6764, lng: 139.6993, category: "culture", source: "user", day: 4, position: 0, start_time: "10:00", duration_min: 90 },
    { trip_id: tokyo, added_by: ids.ex, name: "Yoyogi Park", lat: 35.6717, lng: 139.6949, category: "nature", source: "ato", reason: "Nature — close to the rest of the day", day: 4, position: 1, start_time: "12:00", duration_min: 90 },
  ]), "tokyo plan");
  void d3; void d4;

  // --- Seoul: finished solo trip, for cross-trip insights ---
  const seoul = await trip("ex", { name: "Seoul solo trip", destination: "Seoul, South Korea", start_date: "2026-03-02", end_date: "2026-03-04", status: "finished", dest_lat: 37.5665, dest_lng: 126.978, country_code: "KR" });
  photos += await places(seoul, [
    { name: "Gyeongbokgung Palace", category: "culture", lat: 37.5796, lng: 126.9770, arrive: at("2026-03-02", "08:45"), photos: 3, ratings: { ex: 5 } },
    { name: "Gwangjang Market", category: "food", lat: 37.5700, lng: 126.9996, arrive: at("2026-03-02", "12:30"), photos: 3, ratings: { ex: 5 }, spend: [{ amount: 52, label: "Lunch", by: "ex" }] },
    { name: "Bukchon Hanok Village", category: "culture", lat: 37.5826, lng: 126.9831, arrive: at("2026-03-03", "15:00"), photos: 2, ratings: { ex: 3 } },
  ]);

  // --- Osaka: a plan with three must-visits, ready to press Build live ---
  const osaka = await trip("ex", {
    name: "Osaka", destination: "Osaka, Japan", start_date: "2027-02-04", end_date: "2027-02-07", status: "planned",
    dest_lat: 34.6937, dest_lng: 135.5023, country_code: "JP", budget: 3000, plan_style: { pace: "balanced", interests: ["food", "culture"] },
  }, ["mx"]);
  ok(await db.from("plan_stops").insert([
    { trip_id: osaka, added_by: ids.ex, name: "Osaka Castle", lat: 34.6873, lng: 135.5262, category: "culture", source: "user" },
    { trip_id: osaka, added_by: ids.mx, name: "Dotonbori", lat: 34.6687, lng: 135.5019, category: "food", source: "user", fixed_day: 2, fixed_time: "19:00" },
    { trip_id: osaka, added_by: ids.ex, name: "Osaka Aquarium Kaiyukan", lat: 34.6545, lng: 135.4290, category: "culture", source: "user" },
  ]), "plan stops");

  // --- Max's public Hokkaido trip, so Community has something ---
  const hokkaido = await trip("mx", { name: "5 days in Hokkaido", destination: "Hokkaido, Japan", start_date: "2026-02-10", end_date: "2026-02-14", status: "finished", is_public: true, dest_lat: 43.0618, dest_lng: 141.3545, country_code: "JP" });
  photos += await places(hokkaido, [
    { name: "Otaru Canal", category: "culture", lat: 43.1993, lng: 141.0023, arrive: at("2026-02-10", "16:40"), photos: 3, by: ["mx"], ratings: { mx: 5 },
      spend: [{ amount: 90, label: "Glass workshop", by: "mx" }] },
    { name: "Nijo Market", category: "food", lat: 43.0587, lng: 141.3574, arrive: at("2026-02-11", "08:00"), photos: 3, by: ["mx"], ratings: { mx: 5 },
      spend: [{ amount: 684, label: "Crab and seafood, all trip", by: "mx" }] },
    { name: "Sapporo Clock Tower", category: "culture", lat: 43.0625, lng: 141.3536, arrive: at("2026-02-11", "11:00"), photos: 2, by: ["mx"], ratings: { mx: 3 } },
  ]);

  ok(await db.from("expenses").insert([
    { trip_id: hokkaido, place_id: null, paid_by: ids.mx, amount: 600, label: "Hostel, 4 nights", amount_myr: 600 },
    { trip_id: hokkaido, place_id: null, paid_by: ids.mx, amount: 426, label: "JR pass", amount_myr: 426 },
  ]), "hokkaido spend");

  // --- community activity: likes, a save, follows, and an unread message for Ee Xin ---
  ok(await db.from("likes").insert([
    { user_id: ids.ex, trip_id: hokkaido }, { user_id: ids.qi, trip_id: hokkaido }, { user_id: ids.ky, trip_id: hokkaido }, { user_id: ids.ky, trip_id: bali },
  ]), "likes");
  ok(await db.from("saves").insert({ user_id: ids.ex, trip_id: hokkaido }), "saves");
  ok(await db.from("follows").insert([
    { follower: ids.ex, followee: ids.mx }, { follower: ids.qi, followee: ids.mx }, { follower: ids.ky, followee: ids.ex },
  ]), "follows");
  ok(await db.from("messages").insert([
    { sender: ids.ex, recipient: ids.mx, body: "Your Hokkaido trip is exactly what I want for Feb!", read_at: new Date().toISOString() },
    { sender: ids.mx, recipient: ids.ex, body: "Go for the crab at Nijo Market, and get the JR pass — it paid for itself." },
  ]), "messages");

  // --- a pending invite on Ee Xin's home screen ---
  const penang = await trip("qi", { name: "Penang weekend", destination: "Penang, Malaysia", start_date: dayOffset(0), end_date: dayOffset(2), status: "ongoing", dest_lat: 5.4164, dest_lng: 100.3327, country_code: "MY" });
  ok(await db.from("trip_members").insert({ trip_id: penang, user_id: ids.ex, role: "contributor", status: "invited", invited_by: ids.qi }), "invite");

  const realCount = existsSync(PHOTO_DIR) ? readdirSync(PHOTO_DIR).filter((d) => !d.startsWith(".") && !d.endsWith(".md")).length : 0;
  console.log(`\nDemo ready: 5 accounts, 6 trips, ${photos} photos (${realCount ? `real photos for ${realCount} places` : "generated postcards — add real ones in scripts/demo-photos"}).\n`);
  console.log("Log in as any of these, password:", PASSWORD);
  for (const p of Object.values(PEOPLE)) console.log(`  ${p.name.padEnd(10)} ${p.email}`);
  console.log(`
Demo path as Ee Xin:
  Home → Bali getaway → Write the story (the memory book generates live)
  Home → Tokyo → today's weather and Trip intel (alerts appear only for real nearby events)
  Home → Tokyo → "2 photos need a place" → place them on the map
  Home → accept Qii's Penang invite
  Trips → Planned → Osaka → Edit → Build my itinerary
  Community → Max's Hokkaido trip
  Profile → Friends → Add friend → Kai appears under "You travelled with them"; search @max or eexin@demo.tabiato.app
  Bali → members → Kai is view-only; the ••• menu changes that
  Profile → Messages: an unread reply from Max · Profile → map theme: try Night Sky
  Community → Hokkaido → Ato compares its cost with Bali → "Use this as a starting point"
  Search: "Everything I rated 5 stars", "Places I went with Max"`);
}

// run with --demo-alert to add a clearly labelled demo typhoon for a live presentation
main().catch((e) => { console.error("\nSeed failed:", e.message ?? e); process.exit(1); });
