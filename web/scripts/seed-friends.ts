/**
 * Three test friends on your account. Run from web/:
 *
 *   npm run seed:friends -- --username <your @handle>
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local.
 *
 * Creates (or reuses) accounts for Teoh Ming Xun, Shoichik and Jiaqi, makes all three accepted
 * friends of yours, and then gives them something to have done together — otherwise a friends
 * list is three names and nothing to look at:
 *
 *   Ming Xun   joined your Tokyo and Hong Kong trips, uploaded photos, rated and commented
 *   Shoichik   joined Tokyo as view-only, so the ••• role switch has something to switch
 *   Jiaqi      invited to Hong Kong but hasn't accepted, so Pending and Remind have a row
 *
 * Safe to re-run: it reuses the accounts, and resets the friendships and memberships it manages.
 * Run it after `npm run seed:jp-hk`, because that script recreates the trips these people join.
 *
 * These accounts are not the hackathon demo accounts, so `npm run seed` leaves them alone.
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
const PASSWORD = process.env.DEMO_PASSWORD || "tabiato-test-2026";

function ok(r: { error: { message: string } | null }, what: string) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
}

const FRIENDS = [
  { key: "mx", email: "mingxun@tabiato.test", name: "Teoh Ming Xun", username: "mingxun", style: { budget: "mid", pace: "packed", interests: ["food", "culture"] } },
  { key: "sk", email: "shoichik@tabiato.test", name: "Shoichik", username: "shoichik", style: { budget: "budget", pace: "balanced", interests: ["nature", "culture"] } },
  { key: "jq", email: "jiaqi@tabiato.test", name: "Jiaqi", username: "jiaqi", style: { budget: "luxury", pace: "slow", interests: ["shopping", "food"] } },
] as const;
type Key = (typeof FRIENDS)[number]["key"];

// ---------- postcard images, same as the other seeds ----------
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
<path d="M0 ${600 + (n % 3) * 34} C300 ${520 + n * 14} 600 ${690 - n * 9} 1200 ${590 + (n % 2) * 44} V900 H0Z" fill="#ffffff" opacity="0.2"/>
<circle cx="${300 + (n % 4) * 60}" cy="${220 + (n % 3) * 26}" r="80" fill="#ffffff" opacity="0.26"/>
<text x="70" y="800" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${safe}</text>
<text x="70" y="850" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" opacity="0.85">test photo ${n + 1}</text>
</svg>`;
}

// ---------- real photos — same folders as the other seeds (scripts/demo-photos/<place-slug>/) ----------
const PHOTO_DIR = join(process.cwd(), "scripts", "demo-photos");
const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const slug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Photo n for a place: a real one if the folder has any (taken from the end, so a friend's shots
 *  differ from yours), otherwise the generated postcard. */
function photoFor(place: string, category: string, n: number, tripId: string) {
  const dir = join(PHOTO_DIR, slug(place));
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => TYPES[extname(f).toLowerCase()]).sort() : [];
  if (!files.length) return { path: `${tripId}/${randomUUID()}.svg`, body: Buffer.from(postcard(place, category, n)), type: "image/svg+xml" };
  const f = files[files.length - 1 - (n % files.length)];
  const ext = extname(f).toLowerCase();
  return { path: `${tripId}/${randomUUID()}${ext}`, body: readFileSync(join(dir, f)), type: TYPES[ext] };
}

// ---------- accounts ----------
async function allUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

async function findOwner(users: { id: string; email?: string }[]) {
  const username = arg("username")?.replace(/^@/, "");
  const email = arg("email");
  if (username) {
    const { data } = await db.from("profiles").select("id, display_name, username").eq("username", username.toLowerCase()).maybeSingle();
    if (!data) throw new Error(`No account with username @${username}. Your handle is on the Profile tab.`);
    return { id: data.id as string, label: `${data.display_name || "you"} (@${data.username})` };
  }
  if (email) {
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!hit) throw new Error(`No account with email ${email}.`);
    return { id: hit.id, label: email };
  }
  const { data } = await db.from("profiles").select("username, display_name").order("created_at");
  const who = (data ?? []).map((p) => `  @${p.username}${p.display_name ? `  ${p.display_name}` : ""}`).join("\n");
  throw new Error(`Say whose friends these are:  npm run seed:friends -- --username <handle>\n\nAccounts on this project:\n${who}`);
}

// ---------- main ----------
async function main() {
  const users = await allUsers();
  const owner = await findOwner(users);
  const ids = {} as Record<Key, string>;
  let created = 0;

  for (const f of FRIENDS) {
    const existing = users.find((u) => u.email?.toLowerCase() === f.email);
    if (existing) {
      ids[f.key] = existing.id;
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: f.email, password: PASSWORD, email_confirm: true, user_metadata: { name: f.name },
      });
      if (error || !data.user) throw new Error(`account ${f.email}: ${error?.message ?? "not created"}`);
      ids[f.key] = data.user.id;
      created++;
    }
    // the sign-up trigger invents a handle; give them the readable one either way
    ok(await db.from("profiles").update({
      display_name: f.name, username: f.username, travel_style: f.style, onboarded_at: new Date().toISOString(),
    }).eq("id", ids[f.key]), `profile ${f.name}`);
  }
  if (Object.values(ids).includes(owner.id)) throw new Error("That account is one of the three friends — name your own handle instead.");

  // ---- friendships: all three accepted, in both directions of the table's one row
  const everyone = Object.values(ids);
  await db.from("friendships").delete().in("requester", everyone).eq("addressee", owner.id);
  await db.from("friendships").delete().eq("requester", owner.id).in("addressee", everyone);
  ok(await db.from("friendships").insert(
    everyone.map((id) => ({ requester: id, addressee: owner.id, status: "accepted" })),
  ), "friendships");

  // ---- give them something to have done together, if the seeded trips are there
  const { data: trips } = await db.from("trips").select("id, name")
    .eq("owner_id", owner.id).eq("plan_style->>seeded_by", "seed-japan-hk");
  const tokyo = trips?.find((t) => t.name === "Tokyo")?.id as string | undefined;
  const hk = trips?.find((t) => t.name === "Hong Kong")?.id as string | undefined;
  const joined: string[] = [];

  if (tokyo || hk) {
    // start from a clean slate for these three on these trips
    for (const t of [tokyo, hk].filter(Boolean) as string[]) {
      await db.from("trip_members").delete().eq("trip_id", t).in("user_id", everyone);
      await db.from("comments").delete().eq("trip_id", t).in("user_id", everyone);
      await db.from("ratings").delete().eq("trip_id", t).in("user_id", everyone);
      const { data: theirs } = await db.from("photos").select("id, storage_path").eq("trip_id", t).in("uploaded_by", everyone);
      if (theirs?.length) {
        await db.storage.from("photos").remove(theirs.map((p) => p.storage_path));
        await db.from("photos").delete().in("id", theirs.map((p) => p.id));
      }
    }
  }

  if (tokyo) {
    ok(await db.from("trip_members").insert([
      { trip_id: tokyo, user_id: ids.mx, role: "contributor", status: "joined", invited_by: owner.id },
      { trip_id: tokyo, user_id: ids.sk, role: "viewer", status: "joined", invited_by: owner.id },
    ]), "Tokyo members");
    joined.push("Ming Xun and Shoichik joined Tokyo");

    const { data: places } = await db.from("places").select("id, name, category, first_seen_at").eq("trip_id", tokyo).order("first_seen_at");
    const shibuya = places?.find((p) => p.name === "Shibuya Crossing");
    const ramen = places?.find((p) => p.name === "Ichiran Shibuya");
    const skytree = places?.find((p) => p.name === "Tokyo Skytree");

    // Ming Xun held the camera at Shibuya — gives the memory book a second photographer to notice
    if (shibuya) {
      const rows = [];
      for (let i = 0; i < 4; i++) {
        const { path, body, type } = photoFor("Shibuya Crossing", "culture", i, tokyo);
        const up = await db.storage.from("photos").upload(path, body, { contentType: type });
        if (up.error) throw new Error(`upload: ${up.error.message}`);
        rows.push({
          trip_id: tokyo, place_id: shibuya.id, uploaded_by: ids.mx, storage_path: path,
          taken_at: new Date(new Date(shibuya.first_seen_at).getTime() + (i + 1) * 4 * 60000).toISOString(),
          lat: 35.6595 + i * 0.00005, lng: 139.7005 + i * 0.00005, location_source: "exif", width: 1200, height: 900,
        });
      }
      ok(await db.from("photos").insert(rows), "Ming Xun photos");
      ok(await db.from("ratings").insert({ place_id: shibuya.id, trip_id: tokyo, user_id: ids.mx, stars: 5 }), "rating");
      ok(await db.from("comments").insert([
        { place_id: shibuya.id, trip_id: tokyo, user_id: ids.mx, body: "Stood here for twenty minutes just watching the lights change." },
        { place_id: shibuya.id, trip_id: tokyo, user_id: ids.sk, body: "Crossed it four times. No regrets." },
      ]), "comments");
    }
    if (ramen) {
      ok(await db.from("ratings").insert([
        { place_id: ramen.id, trip_id: tokyo, user_id: ids.mx, stars: 5 },
        { place_id: ramen.id, trip_id: tokyo, user_id: ids.sk, stars: 4 },
      ]), "ratings");
      ok(await db.from("comments").insert({ place_id: ramen.id, trip_id: tokyo, user_id: ids.mx, body: "Order the extra noodles. You will want them." }), "comment");
    }
    if (skytree) {
      ok(await db.from("expenses").insert({ trip_id: tokyo, place_id: skytree.id, paid_by: ids.mx, amount: 3100, currency: "JPY", amount_myr: 95.17, label: "Ming Xun's ticket" }), "expense");
    }
  }

  if (hk) {
    ok(await db.from("trip_members").insert([
      { trip_id: hk, user_id: ids.mx, role: "contributor", status: "joined", invited_by: owner.id },
      { trip_id: hk, user_id: ids.jq, role: "contributor", status: "invited", invited_by: owner.id },
    ]), "Hong Kong members");
    joined.push("Ming Xun joined Hong Kong, Jiaqi is still invited");

    const { data: places } = await db.from("places").select("id, name, first_seen_at").eq("trip_id", hk);
    const peak = places?.find((p) => p.name === "Victoria Peak");
    const dimsum = places?.find((p) => p.name === "Tim Ho Wan Sham Shui Po");
    if (peak) {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const { path, body, type } = photoFor("Victoria Peak", "nature", i, hk);
        const up = await db.storage.from("photos").upload(path, body, { contentType: type });
        if (up.error) throw new Error(`upload: ${up.error.message}`);
        rows.push({
          trip_id: hk, place_id: peak.id, uploaded_by: ids.mx, storage_path: path,
          taken_at: new Date(new Date(peak.first_seen_at).getTime() + (i + 1) * 6 * 60000).toISOString(),
          lat: 22.2759 + i * 0.00005, lng: 114.1455, location_source: "exif", width: 1200, height: 900,
        });
      }
      ok(await db.from("photos").insert(rows), "Ming Xun HK photos");
      ok(await db.from("ratings").insert({ place_id: peak.id, trip_id: hk, user_id: ids.mx, stars: 5 }), "rating");
      ok(await db.from("comments").insert({ place_id: peak.id, trip_id: hk, user_id: ids.mx, body: "Worth the early start. You can see all the way to Kowloon." }), "comment");
    }
    if (dimsum) {
      ok(await db.from("comments").insert({ place_id: dimsum.id, trip_id: hk, user_id: ids.mx, body: "The baked pork buns are the whole reason to queue." }), "comment");
    }
  }

  // ---- a message waiting on the Profile tab
  await db.from("messages").delete().in("sender", everyone).eq("recipient", owner.id);
  ok(await db.from("messages").insert([
    { sender: ids.mx, recipient: owner.id, body: "Sent you the Shibuya photos — check the trip." },
    { sender: ids.jq, recipient: owner.id, body: "Is the Hong Kong invite still open? I can make the weekend." },
  ]), "messages");

  console.log(`
Friends added for ${owner.label}${created ? ` (${created} new account${created === 1 ? "" : "s"})` : " (reused existing accounts)"}:

  Teoh Ming Xun   @mingxun    friend · on Tokyo and Hong Kong · photos, ratings, comments
  Shoichik        @shoichik   friend · on Tokyo as view-only
  Jiaqi           @jiaqi      friend · invited to Hong Kong, not joined yet
${joined.length ? `\n  ${joined.join("\n  ")}` : "\n  No seeded trips found — run npm run seed:jp-hk first for the trip side of this."}

Worth a look:
  Profile → Friends            all three, with their travel styles
  Profile → Messages           unread from Ming Xun and Jiaqi
  Tokyo → Members              Shoichik is view-only; ••• → Let them add photos
  Tokyo → Shibuya Crossing     Ming Xun's photos and both their comments
  Tokyo → Trip story           the memory book now has two photographers to notice
  Hong Kong → Members          Jiaqi under Pending → Remind
  Search                       "Places I went with Ming Xun"
  Friends → Add friend         search @mingxun, or mingxun@tabiato.test

Log in as any of them with the password: ${PASSWORD}
  mingxun@tabiato.test · shoichik@tabiato.test · jiaqi@tabiato.test`);
}

main().catch((e) => {
  console.error(`\n${e.message ?? e}`);
  process.exitCode = 1;
});
