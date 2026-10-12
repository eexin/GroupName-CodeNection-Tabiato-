/**
 * Test data on your own account — Japan and Hong Kong. Run from web/:
 *
 *   npm run seed:jp-hk -- --username <your @handle>
 *   npm run seed:jp-hk -- --email you@example.com
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local.
 *
 * Unlike `npm run seed`, this creates no accounts and touches nobody else's data. It attaches
 * three trips to the account you name, so you can stay logged in as yourself:
 *
 *   Tokyo        finished, public — the trip story, the memory book, Community
 *   Hong Kong    running right now — today's weather, live trip intel, photos that need a place
 *   Kyoto        planned — must-visit places ready for "Build my itinerary"
 *
 * Safe to re-run: it removes its own three trips (and their photo files) first, and leaves any
 * other trip on the account alone.
 *
 * Photos are generated postcards, so nothing is downloaded. Drop real ones into
 * scripts/demo-photos/<place-slug>/ and they get used instead, exactly as in seed-demo.ts.
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

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

// ---------- helpers ----------
function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error || r.data == null) throw new Error(`${what}: ${r.error?.message ?? "no data returned"}`);
  return r.data as NonNullable<T>;
}
function ok(r: { error: { message: string } | null }, what: string) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
}
/** wall clock encoded as UTC, the way the app stores what the camera said */
const at = (date: string, hhmm: string) => `${date}T${hhmm}:00.000Z`;
const addMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60000).toISOString();
const today = new Date();
const dayOffset = (n: number) =>
  new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + n)).toISOString().slice(0, 10);

/** Rough rates, only so spend shows "JPY … ≈ RM …". The app converts real expenses at ECB rates. */
const RATE = { JPY: 0.0307, HKD: 0.55 } as const;
const toMyr = (amount: number, currency: keyof typeof RATE) => Math.round(amount * RATE[currency] * 100) / 100;

// ---------- postcard images, same approach as seed-demo.ts ----------
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
<text x="70" y="850" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" opacity="0.85">test photo ${n + 1}</text>
</svg>`;
}

const PHOTO_DIR = join(process.cwd(), "scripts", "demo-photos");
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function realPhotos(place: string) {
  const dir = join(PHOTO_DIR, slug(place));
  if (!existsSync(dir)) return [] as { body: Buffer; type: string; ext: string }[];
  return readdirSync(dir).filter((f) => TYPES[extname(f).toLowerCase()]).sort()
    .map((f) => ({ body: readFileSync(join(dir, f)), type: TYPES[extname(f).toLowerCase()], ext: extname(f).toLowerCase() }));
}

// ---------- who are we seeding for ----------
/**
 * Every trip this script writes carries this marker, and a re-run only deletes trips that have
 * it. Matching on the name alone would throw away a real trip of yours that happened to be
 * called Tokyo.
 */
const MARK = "seed-japan-hk";
const marked = (style: Record<string, unknown> = {}) => ({ ...style, seeded_by: MARK });

async function findUser() {
  const username = arg("username")?.replace(/^@/, "");
  const email = arg("email");
  if (username) {
    const { data } = await db.from("profiles").select("id, display_name, username").eq("username", username.toLowerCase()).maybeSingle();
    if (!data) throw new Error(`No account with username @${username}. Your handle is on the Profile tab.`);
    return { id: data.id as string, label: `${data.display_name || "you"} (@${data.username})` };
  }
  if (email) {
    for (let page = 1; page < 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (hit) return { id: hit.id, label: email };
      if (data.users.length < 200) break;
    }
    throw new Error(`No account with email ${email}.`);
  }
  // neither given: show what's there so the next run can name one
  const { data } = await db.from("profiles").select("username, display_name").order("created_at");
  const who = (data ?? []).map((p) => `  @${p.username}${p.display_name ? `  ${p.display_name}` : ""}`).join("\n");
  throw new Error(`Say whose account to seed:  npm run seed:jp-hk -- --username <handle>\n\nAccounts on this project:\n${who}`);
}

/** Remove a previous run of this script, and nothing else. */
async function clearPrevious(userId: string) {
  const { data: mine } = await db.from("trips").select("id, name")
    .eq("owner_id", userId).eq("plan_style->>seeded_by", MARK);
  if (!mine?.length) return;
  for (const t of mine) {
    const { data: files } = await db.storage.from("photos").list(t.id, { limit: 1000 });
    if (files?.length) await db.storage.from("photos").remove(files.map((f) => `${t.id}/${f.name}`));
  }
  ok(await db.from("trips").delete().in("id", mine.map((t) => t.id)), "clear previous");
  console.log(`Replaced ${mine.length} trip(s) from an earlier run: ${mine.map((t) => t.name).join(", ")}`);
}

// ---------- builders ----------
type Spend = { amount: number; label: string; currency?: keyof typeof RATE };
type PlaceSpec = {
  name: string; category: string; lat: number; lng: number; arrive: string; photos: number;
  gapMin?: number; rating?: number; spend?: Spend[]; note?: string; comments?: string[];
};

async function addPlaces(tripId: string, userId: string, specs: PlaceSpec[]) {
  let uploaded = 0;
  for (const p of specs) {
    const placeId = randomUUID();
    const gap = p.gapMin ?? 11;
    ok(await db.from("places").insert({
      id: placeId, trip_id: tripId, name: p.name, category: p.category, lat: p.lat, lng: p.lng,
      first_seen_at: p.arrive, last_seen_at: addMin(p.arrive, gap * Math.max(0, p.photos - 1)),
    }), `place ${p.name}`);

    const real = realPhotos(p.name);
    const rows = [];
    for (let i = 0; i < p.photos; i++) {
      const r = real.length ? real[i % real.length] : null;
      const path = `${tripId}/${randomUUID()}${r ? r.ext : ".svg"}`;
      const up = await db.storage.from("photos").upload(path, r ? r.body : Buffer.from(postcard(p.name, p.category, i)), {
        contentType: r ? r.type : "image/svg+xml",
      });
      if (up.error) throw new Error(`upload ${p.name}: ${up.error.message}`);
      rows.push({
        trip_id: tripId, place_id: placeId, uploaded_by: userId, storage_path: path,
        taken_at: addMin(p.arrive, gap * i),
        lat: p.lat + (i % 3) * 0.00004, lng: p.lng + (i % 2) * 0.00004,
        location_source: "exif", width: 1200, height: 900,
      });
      uploaded++;
    }
    if (rows.length) ok(await db.from("photos").insert(rows), `photos ${p.name}`);

    if (p.rating) ok(await db.from("ratings").insert({ place_id: placeId, trip_id: tripId, user_id: userId, stars: p.rating }), "rating");
    for (const s of p.spend ?? []) {
      ok(await db.from("expenses").insert({
        trip_id: tripId, place_id: placeId, paid_by: userId, amount: s.amount, label: s.label,
        currency: s.currency ?? "MYR",
        amount_myr: s.currency ? toMyr(s.amount, s.currency) : s.amount,
      }), "expense");
    }
    if (p.note) ok(await db.from("notes").insert({ place_id: placeId, trip_id: tripId, user_id: userId, body: p.note }), "note");
    for (const body of p.comments ?? []) {
      ok(await db.from("comments").insert({ place_id: placeId, trip_id: tripId, user_id: userId, body }), "comment");
    }
  }
  return uploaded;
}

/** A photo with no coordinates — the "needs a place" flow on the trip screen. */
async function unplacedPhoto(tripId: string, userId: string, takenAt: string, n: number) {
  // a real shot from scripts/demo-photos/no-location/ if there is one — it has no GPS on purpose
  const real = realPhotos("No location");
  const r = real.length ? real[n % real.length] : null;
  const path = `${tripId}/${randomUUID()}${r ? r.ext : ".svg"}`;
  ok(await db.storage.from("photos").upload(path, r ? r.body : Buffer.from(postcard("No location", "other", n)), { contentType: r ? r.type : "image/svg+xml" }), "upload");
  ok(await db.from("photos").insert({ trip_id: tripId, uploaded_by: userId, storage_path: path, taken_at: takenAt, location_source: "none" }), "photo");
}

// ---------- main ----------
async function main() {
  const user = await findUser();
  console.log(`Seeding Japan and Hong Kong trips for ${user.label}\n`);
  await clearPrevious(user.id);
  let photos = 0;

  // ---- Tokyo: finished and public. Arrivals are tuned so the memory book finds real patterns:
  // every 5★ stop is before 9am, and food is the biggest slice of the spend.
  const tokyo = must(await db.from("trips").insert({
    owner_id: user.id, name: "Tokyo", destination: "Tokyo, Japan",
    start_date: "2026-09-12", end_date: "2026-09-15", status: "finished", is_public: true,
    dest_lat: 35.6812, dest_lng: 139.7671, country_code: "JP", budget: 4000, plan_style: marked(),
  }).select("id").single(), "Tokyo trip").id as string;

  photos += await addPlaces(tokyo, user.id, [
    { name: "Tsukiji Outer Market", category: "food", lat: 35.6655, lng: 139.7707, arrive: at("2026-09-12", "07:40"), photos: 5, rating: 5,
      spend: [{ amount: 3800, currency: "JPY", label: "Breakfast crawl" }],
      note: "Go at opening. By nine it was shoulder to shoulder and half the stalls had sold out.",
      comments: ["the tamagoyaki stand at the corner, every time"] },
    { name: "Senso-ji", category: "culture", lat: 35.7148, lng: 139.7967, arrive: at("2026-09-12", "08:20"), photos: 4, rating: 5,
      note: "Empty at eight, a wall of people by eleven. The incense smell stays with you." },
    { name: "Nakamise-dori", category: "shopping", lat: 35.7122, lng: 139.7960, arrive: at("2026-09-12", "10:30"), photos: 3, rating: 3,
      spend: [{ amount: 2400, currency: "JPY", label: "Souvenirs" }] },
    { name: "Shibuya Crossing", category: "culture", lat: 35.6595, lng: 139.7005, arrive: at("2026-09-12", "17:45"), photos: 6, gapMin: 7, rating: 4,
      comments: ["best view is upstairs in the Starbucks, worth the queue"] },
    { name: "Ichiran Shibuya", category: "food", lat: 35.6616, lng: 139.7008, arrive: at("2026-09-12", "20:10"), photos: 2, rating: 4,
      spend: [{ amount: 1180, currency: "JPY", label: "Ramen" }] },
    { name: "Shinjuku Gyoen", category: "nature", lat: 35.6852, lng: 139.7100, arrive: at("2026-09-13", "08:35"), photos: 4, rating: 5,
      spend: [{ amount: 500, currency: "JPY", label: "Garden entry" }],
      note: "Worth the early start. Found a bench by the pond and stayed an hour longer than planned." },
    { name: "teamLab Planets", category: "culture", lat: 35.6491, lng: 139.7898, arrive: at("2026-09-13", "13:00"), photos: 7, gapMin: 6, rating: 4,
      spend: [{ amount: 3800, currency: "JPY", label: "Tickets" }],
      comments: ["bring shorts, you walk through water"] },
    { name: "Harajuku Takeshita Street", category: "shopping", lat: 35.6716, lng: 139.7030, arrive: at("2026-09-14", "14:20"), photos: 3, rating: 2,
      spend: [{ amount: 5600, currency: "JPY", label: "Clothes" }] },
    { name: "Tokyo Skytree", category: "culture", lat: 35.7101, lng: 139.8107, arrive: at("2026-09-14", "16:40"), photos: 4, rating: 4,
      spend: [{ amount: 3100, currency: "JPY", label: "Observation deck" }] },
    { name: "Omoide Yokocho", category: "food", lat: 35.6936, lng: 139.6997, arrive: at("2026-09-15", "19:30"), photos: 5, gapMin: 9, rating: 4,
      spend: [{ amount: 4200, currency: "JPY", label: "Yakitori and beer" }],
      note: "Six seats per bar. Point at what the person next to you is having." },
  ]);
  ok(await db.from("expenses").insert([
    { trip_id: tokyo, place_id: null, paid_by: user.id, amount: 14800, currency: "JPY", amount_myr: toMyr(14800, "JPY"), label: "Hotel, 3 nights" },
    { trip_id: tokyo, place_id: null, paid_by: user.id, amount: 3200, currency: "JPY", amount_myr: toMyr(3200, "JPY"), label: "Suica top-ups" },
  ]), "Tokyo spend");

  // ---- Hong Kong: running right now, today is day 3 of 5, so weather and intel are live
  const hkStart = dayOffset(-2), d1 = dayOffset(-2), d2 = dayOffset(-1), d3 = dayOffset(0);
  const hk = must(await db.from("trips").insert({
    owner_id: user.id, name: "Hong Kong", destination: "Hong Kong", start_date: hkStart, end_date: dayOffset(2), status: "ongoing",
    dest_lat: 22.3193, dest_lng: 114.1694, country_code: "HK", budget: 3500, plan_style: marked(),
  }).select("id").single(), "Hong Kong trip").id as string;

  photos += await addPlaces(hk, user.id, [
    { name: "Victoria Peak", category: "nature", lat: 22.2759, lng: 114.1455, arrive: at(d1, "08:15"), photos: 5, rating: 5,
      spend: [{ amount: 148, currency: "HKD", label: "Peak Tram return" }],
      note: "Queue was twenty minutes at eight, an hour by ten. Go up early, come down for lunch.",
      comments: ["the haze cleared about nine, worth waiting for"] },
    { name: "Star Ferry", category: "culture", lat: 22.2937, lng: 114.1686, arrive: at(d1, "11:30"), photos: 3, rating: 5,
      spend: [{ amount: 6, currency: "HKD", label: "Ferry, lower deck" }],
      note: "Five HKD for the best view in the city. Sit on the upper deck going towards Kowloon." },
    { name: "Tim Ho Wan Sham Shui Po", category: "food", lat: 22.3302, lng: 114.1626, arrive: at(d1, "12:40"), photos: 4, rating: 4,
      spend: [{ amount: 182, currency: "HKD", label: "Dim sum" }] },
    { name: "Tsim Sha Tsui Promenade", category: "culture", lat: 22.2934, lng: 114.1722, arrive: at(d1, "19:50"), photos: 6, gapMin: 5, rating: 4,
      comments: ["Symphony of Lights at 8, get there by 7:40 for a spot on the rail"] },
    { name: "Tai Kwun", category: "culture", lat: 22.2819, lng: 114.1540, arrive: at(d2, "10:20"), photos: 4, rating: 4,
      note: "Old police station turned art complex. Free to walk in, and the cells are still there." },
    { name: "Tian Tan Buddha", category: "culture", lat: 22.2540, lng: 113.9050, arrive: at(d2, "13:15"), photos: 5, rating: 5,
      spend: [{ amount: 235, currency: "HKD", label: "Ngong Ping cable car" }],
      note: "268 steps. The cable car over the water is half the reason to come." },
    { name: "Temple Street Night Market", category: "shopping", lat: 22.3080, lng: 114.1700, arrive: at(d2, "20:30"), photos: 4, rating: 3,
      spend: [{ amount: 320, currency: "HKD", label: "Clay pot rice and bits" }] },
    { name: "Mong Kok", category: "food", lat: 22.3193, lng: 114.1694, arrive: at(d3, "12:10"), photos: 3, rating: 4,
      spend: [{ amount: 96, currency: "HKD", label: "Egg waffles and milk tea" }] },
  ]);
  // two photos the app can't place on its own — the trip screen offers to pin them
  await unplacedPhoto(hk, user.id, at(d2, "18:05"), 0);
  await unplacedPhoto(hk, user.id, at(d2, "18:19"), 1);
  photos += 2;
  ok(await db.from("expenses").insert({ trip_id: hk, place_id: null, paid_by: user.id, amount: 2400, currency: "HKD", amount_myr: toMyr(2400, "HKD"), label: "Hotel, 4 nights" }), "HK spend");
  // the plan behind the live trip: an outdoor stop this afternoon, so real rain triggers a replan
  ok(await db.from("plan_stops").insert([
    { trip_id: hk, added_by: user.id, name: "Man Mo Temple", lat: 22.2838, lng: 114.1503, category: "culture", source: "user", day: 3, position: 0, start_time: "10:00", duration_min: 60 },
    { trip_id: hk, added_by: user.id, name: "Dragon's Back trail", lat: 22.2383, lng: 114.2430, category: "nature", source: "user", day: 3, position: 1, start_time: "14:30", duration_min: 150 },
    { trip_id: hk, added_by: user.id, name: "Ladies' Market", lat: 22.3186, lng: 114.1707, category: "shopping", source: "user", day: 4, position: 0, start_time: "11:00", duration_min: 90 },
    { trip_id: hk, added_by: user.id, name: "Hong Kong Museum of History", lat: 22.3017, lng: 114.1772, category: "culture", source: "ato", reason: "Indoors, and close to the rest of the day", day: 4, position: 1, start_time: "14:00", duration_min: 120 },
  ]), "HK plan");

  // ---- Kyoto: a plan with must-visit places, ready for "Build my itinerary"
  const kyoto = must(await db.from("trips").insert({
    owner_id: user.id, name: "Kyoto", destination: "Kyoto, Japan",
    start_date: "2027-03-20", end_date: "2027-03-23", status: "planned",
    dest_lat: 35.0116, dest_lng: 135.7681, country_code: "JP", budget: 5000,
    plan_style: marked({ pace: "balanced", interests: ["culture", "food", "nature"] }),
  }).select("id").single(), "Kyoto trip").id as string;
  ok(await db.from("plan_stops").insert([
    { trip_id: kyoto, added_by: user.id, name: "Fushimi Inari Taisha", lat: 34.9671, lng: 135.7727, category: "culture", source: "user", priority: 0 },
    { trip_id: kyoto, added_by: user.id, name: "Arashiyama Bamboo Grove", lat: 35.0170, lng: 135.6716, category: "nature", source: "user", priority: 1, fixed_day: 2, fixed_time: "09:00" },
    { trip_id: kyoto, added_by: user.id, name: "Kiyomizu-dera", lat: 34.9949, lng: 135.7850, category: "culture", source: "user", priority: 2 },
    { trip_id: kyoto, added_by: user.id, name: "Nishiki Market", lat: 35.0050, lng: 135.7649, category: "food", source: "user", priority: 3 },
  ]), "Kyoto plan");

  console.log(`
Done. ${photos} photos across 3 trips.

  Tokyo        finished, public   10 places, spend in JPY
  Hong Kong    running now         8 places + 2 photos that need a place, spend in HKD
  Kyoto        planned             4 must-visit places

Worth a look:
  Home                     both trips pinned on the map
  Tokyo → Trip story       route, highlights, then Write the story for the memory book
  Tokyo → a place          JPY spend shown as "JPY … ≈ RM …", your rating, notes, comments
  Hong Kong                today's weather and Trip intel for HK
  Hong Kong                "2 photos need a place" → tap the map to pin them
  Trips → Planned → Kyoto  Edit → Build my itinerary (Arashiyama is pinned to day 2 at 09:00)
  Insights                 patterns across both trips
  Search                   "Everything I rated 5 stars", "Where did I eat the best dim sum?"

Re-run this any time; it replaces its own three trips and leaves everything else alone.`);
}

main().catch((e) => {
  console.error(`\n${e.message ?? e}`);
  process.exitCode = 1;
});
