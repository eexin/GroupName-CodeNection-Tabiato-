/**
 * Smoke tests against the real production build: starts `next start`, hits the routes over HTTP.
 * Run after `npm run build` with NEXT_PUBLIC_SUPABASE_URL/ANON_KEY set to any value (CI uses dummies).
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { after, before, test } from "node:test";

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;

before(async () => {
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true, env: process.env });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
});
after(() => { try { process.kill(-server.pid!); } catch { /* already gone */ } });

const get = (p: string) => fetch(`${BASE}${p}`, { redirect: "manual" });

test("public pages render", async () => {
  for (const p of ["/start", "/login", "/signup", "/exif-test", "/offline", "/forgot-password"]) assert.equal((await get(p)).status, 200, p);
});

test("installable: manifest, icons and service worker load without a login", async () => {
  const m = await get("/manifest.webmanifest");
  assert.equal(m.status, 200);
  const j = await m.json();
  assert.equal(j.display, "standalone");
  assert.ok(j.icons.some((i: { purpose?: string }) => i.purpose === "maskable"));
  for (const p of ["/icons/icon-192.png", "/icons/icon-512.png", "/apple-icon.png", "/sw.js"]) assert.equal((await get(p)).status, 200, p);
  assert.match((await get("/sw.js")).headers.get("cache-control") ?? "", /no-cache/);
});

test("security headers are set", async () => {
  const h = (await get("/login")).headers;
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.match(h.get("permissions-policy") ?? "", /camera=\(self\)/);
});

test("signed-out visitors to the home page see the splash", async () => {
  const r = await get("/");
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /\/start$/);
});

test("every private page sends a signed-out visitor to login", async () => {
  for (const p of ["/trips", "/community", "/profile", "/friends", "/add", "/insights", "/search", "/plan", "/plan/new",
    "/trips/new", "/trips/x", "/trips/x/upload", "/trips/x/book", "/trips/x/book/print", "/trips/x/alert", "/trips/x/intel",
    "/places/x", "/plan/x", "/plan/x/places", "/plan/x/build", "/plan/x/setup", "/trips/x/edit", "/trips/x/story",
    "/trips/x/reroute", "/trips/x/members", "/trips/x/options", "/privacy", "/u/someone", "/friends/add", "/onboarding",
    "/community/x", "/messages", "/messages/x", "/profile/avatar", "/search?q=rated%205%20stars", "/trips/x/share", "/trips/x/invite", "/join/abc"]) {
    const r = await get(p);
    assert.equal(r.status, 307, p);
    assert.match(r.headers.get("location") ?? "", /\/login(\?next=[^&]+)?$/, p);
  }
});

test("judges get a one-tap demo, and its password never reaches the browser", async () => {
  const html = await (await get("/login")).text();
  if (process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD) assert.match(html, /Explore a sample account/);
  if (process.env.DEMO_PASSWORD) assert.ok(!html.includes(process.env.DEMO_PASSWORD), "demo password leaked into the page");
});

test("auth callback without a code goes back to login, never crashes", async () => {
  const r = await get("/auth/callback?next=//evil.com");
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /\/login\?oauth=failed$/);
  const reset = await get("/reset-password");
  assert.equal(reset.status, 307);
});

test("login offers forgot password", async () => {
  assert.match(await (await get("/login")).text(), /Forgot password\?/);
});

test("a scanned friend link survives the login", async () => {
  const r = await get("/u/max");
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location") ?? "", /\/login\?next=%2Fu%2Fmax$/);
});

test("login page has a labelled form and no leaked secrets", async () => {
  const html = await (await get("/login")).text();
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
  assert.match(html, /Skip to content/);
  assert.doesNotMatch(html, /GROQ_API_KEY|SERVICE_ROLE|gsk_/);
});

test("health endpoint answers with a status and never redirects", async () => {
  const r = await get("/api/health");
  assert.ok([200, 503].includes(r.status), String(r.status));
  const j = await r.json();
  assert.ok(["ok", "degraded", "down"].includes(j.status));
  assert.ok(j.checks.database);
});

test("client error reports are accepted", async () => {
  const r = await fetch(`${BASE}/api/client-error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "test", path: "/x" }) });
  assert.equal(r.status, 204);
});

test("characters are public SVG images, and unknown looks are refused", async () => {
  const r = await get("/api/avatar/s2.c1.hair_long.hat_straw");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /image\/svg\+xml/);
  assert.match(r.headers.get("cache-control") ?? "", /immutable/);
  assert.match(await r.text(), /^<svg /);
  assert.equal((await get("/api/avatar/%3Cscript%3E")).status, 404);
  assert.equal((await get("/api/avatar/s99.c1")).status, 404);
});

