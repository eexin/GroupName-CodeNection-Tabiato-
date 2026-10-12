/*
 * Tabiato service worker — deliberately conservative.
 *  - Pages always come from the network, so nobody ever sees a stale or someone else's page.
 *    If the network is gone, the offline screen is shown instead of the browser's error.
 *  - Static files (/_next/static, icons) also come from the network, and are copied into the
 *    cache as they go past. The cache is there to keep the app usable offline, never to decide
 *    which version of the code you run.
 *  - Other origins (Supabase, maps, APIs) are never touched.
 *
 * It used to answer static files from the cache first. That is safe for a production build,
 * where every filename is a content hash — but `next dev` names chunks after the module path
 * and keeps the name as you edit, so one visit to a production build on the same port left the
 * cache serving that day's code for ever, and fixes appeared to do nothing. Network first costs
 * nothing real (production assets are immutable, so the browser's own cache handles repeats) and
 * removes the whole class of problem. pwa.tsx additionally unregisters this worker in development.
 *
 * Bump CACHE when this file changes: `activate` deletes every cache that isn't the current one,
 * which is what clears a poisoned cache from an older version of this worker.
 */
const CACHE = "tabiato-static-v2";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // keep a copy for offline use, but always hand back what the server just sent
          if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
          return res;
        } catch {
          const hit = await caches.match(req);
          if (hit) return hit;
          throw new Error(`offline and not cached: ${url.pathname}`);
        }
      })(),
    );
  }
});
