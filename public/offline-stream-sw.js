self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/__anime-cache/")) {
    event.respondWith(waitForCachedSegment(event.request));
  }
});

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
