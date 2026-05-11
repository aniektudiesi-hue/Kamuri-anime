import type { StreamResponse } from "./types";

const STREAM_CACHE_PREFIX = "anime-tv-stream-meta:";
const STREAM_CACHE_TTL = 1000 * 60 * 25;
const warmedManifests = new Set<string>();

type CachedStream = {
  expiresAt: number;
  value: StreamResponse;
};

export function readCachedStream(key: string) {
  try {
    const raw = window.sessionStorage.getItem(STREAM_CACHE_PREFIX + key);
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as CachedStream;
    if (!cached.value || cached.expiresAt < Date.now()) {
      window.sessionStorage.removeItem(STREAM_CACHE_PREFIX + key);
      return undefined;
    }
    return cached.value;
  } catch {
    return undefined;
  }
}

export function writeCachedStream(key: string, value: StreamResponse) {
  try {
    window.sessionStorage.setItem(
      STREAM_CACHE_PREFIX + key,
      JSON.stringify({ expiresAt: Date.now() + STREAM_CACHE_TTL, value } satisfies CachedStream),
    );
  } catch {
    // Cache writes are opportunistic.
  }
}

export function warmStreamManifest(stream: StreamResponse | undefined) {
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  if (!src || warmedManifests.has(src) || !isPlaylist(src)) return;
  warmedManifests.add(src);

  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), 7000);

  fetch(src, { cache: "force-cache", signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) return;
      const text = await response.text();
      const variant = firstVariantUrl(text, src);
      if (variant) {
        await fetch(variant, { cache: "force-cache", signal: controller.signal }).catch(() => undefined);
      }
    })
    .catch(() => undefined)
    .finally(() => window.clearTimeout(id));
}

function firstVariantUrl(text: string, src: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines.slice(i + 1).find((line) => !line.startsWith("#"));
    return next ? new URL(next, src).toString() : "";
  }
  return "";
}

function isPlaylist(url: string) {
  return /\.m3u8(?:$|[?#])/i.test(url) || /\/m3u8(?:$|[?#])/i.test(url) || /\/proxy\/(?:m3u8|moon)\b/i.test(url);
}
