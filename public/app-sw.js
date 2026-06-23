// animeTVplus app service worker.
// Responsibilities:
//  1. Pre-cache a fully self-contained offline shell (/offline.html + player) so
//     the packaged app can open with ZERO network and play saved downloads.
//  2. Navigation fallback: when the device is offline and the WebView tries to
//     load the live site, serve the cached offline shell instead of an error.
//  3. Serve the progressive-playback segment cache (/__anime-cache/).

const SHELL_CACHE = "atv-app-shell-v1";
const SHELL_ASSETS = [
  "/offline.html",
  "/hls.min.js",
  "/logo-full.webp",
  "/logo-icon.webp",
  "/splash-bg-portrait.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort: never let one missing asset block install.
      await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== "anime-tv-progressive-stream-v1").map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Progressive playback segments — wait until the chunk lands in the cache.
  if (url.pathname.startsWith("/__anime-cache/")) {
    event.respondWith(waitForCachedSegment(request));
    return;
  }

  // The offline shell + its assets: cache-first so they work with no network.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Page navigations: network-first, fall back to the offline shell when the
  // network is unreachable (the whole point of the hybrid offline mode).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match("/offline.html")) || Response.error();
      }),
    );
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function waitForCachedSegment(request) {
  const cache = await caches.open("anime-tv-progressive-stream-v1");
  for (let i = 0; i < 240; i++) {
    const match = await cache.match(request);
    if (match) return match;
    await sleep(250);
  }
  return new Response("Segment is not cached yet", { status: 504 });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
