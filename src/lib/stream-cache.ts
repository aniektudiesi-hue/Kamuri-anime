import type { StreamResponse } from "./types";

const STREAM_CACHE_PREFIX = "anime-tv-stream-meta:";
const STREAM_CACHE_TTL = 1000 * 60 * 15;
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

export function clearCachedStream(key: string) {
  try {
    window.sessionStorage.removeItem(STREAM_CACHE_PREFIX + key);
  } catch {
    // Cache clears are opportunistic.
  }
}

export function warmStreamManifest(
  stream: StreamResponse | undefined,
  options: { segments?: number; timeoutMs?: number } = {},
) {
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  if (!src || warmedManifests.has(src) || !isPlaylist(src)) return;
  warmedManifests.add(src);
  preconnectTo(src);

  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  const segmentCount = options.segments ?? 1;

  warmPlaylist(src, segmentCount, controller.signal)
    .catch(() => undefined)
    .finally(() => window.clearTimeout(id));
}

export function warmMoonPipeline(stream: StreamResponse | undefined, segments = 4) {
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  if (!src) return false;

  const match = src.match(/^(https?:\/\/[^/]+)\/proxy\/moon\/([^/?#]+)\/m3u8/i);
  if (!match) return false;

  const warmUrl = `${match[1]}/proxy/moon/${match[2]}/warm?segments=${Math.max(1, Math.min(6, segments))}`;
  void fetch(warmUrl, {
    method: "GET",
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
  return true;
}

async function warmPlaylist(src: string, segmentCount: number, signal: AbortSignal) {
  const response = await fetch(src, { cache: "force-cache", signal });
  if (!response.ok) return;
  const text = await response.text();
  const variant = firstVariantUrl(text, src);
  if (variant) {
    preconnectTo(variant);
    await warmPlaylist(variant, segmentCount, signal);
    return;
  }

  const keys = keyUrls(text, src);
  const segments = segmentUrls(text, src).slice(0, segmentCount);
  await Promise.allSettled(
    [...keys, ...segments].map(async (url) => {
      preconnectTo(url);
      const res = await fetch(url, { cache: "force-cache", signal });
      if (res.ok) await res.arrayBuffer();
    }),
  );
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

function segmentUrls(text: string, src: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !/\.m3u8(?:$|[?#])/i.test(line))
    .map((line) => new URL(line, src).toString());
}

function keyUrls(text: string, src: string) {
  const urls: string[] = [];
  const keyPattern = /#EXT-X-KEY:[^\n\r]*URI=(?:"([^"]+)"|([^,\s]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(text))) {
    const url = match[1] || match[2];
    if (url) urls.push(new URL(url, src).toString());
  }
  return urls;
}

function isPlaylist(url: string) {
  return /\.m3u8(?:$|[?#])/i.test(url) || /\/m3u8(?:$|[?#])/i.test(url) || /\/proxy\/(?:m3u8|moon)\b/i.test(url);
}

function preconnectTo(url: string) {
  try {
    const origin = new URL(url).origin;
    if (document.head.querySelector(`link[data-stream-origin="${origin}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    link.dataset.streamOrigin = origin;
    document.head.appendChild(link);
  } catch {
    // Ignore invalid upstream URLs.
  }
}
