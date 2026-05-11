import type { StreamResponse } from "./types";

type WarmOptions = {
  signal: AbortSignal;
  maxDurationSeconds: number;
  maxSegments: number;
  concurrency: number;
};

type Segment = {
  url: string;
  duration: number;
};

export async function warmHlsStream(stream: StreamResponse | undefined, options: WarmOptions) {
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  if (!src || !isPlaylist(src)) return;

  try {
    const mediaUrl = await resolveMediaPlaylist(src, options.signal);
    const playlist = await fetchText(mediaUrl, options.signal);
    const resources = collectWarmResources(playlist, mediaUrl, options.maxDurationSeconds, options.maxSegments);
    await fetchWarmResources(resources, options.concurrency, options.signal);
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      // Warming is opportunistic. Playback should never depend on it.
    }
  }
}

async function resolveMediaPlaylist(src: string, signal: AbortSignal) {
  const text = await fetchText(src, signal);
  if (!text.includes("#EXT-X-STREAM-INF")) return src;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const variants: Array<{ score: number; url: string }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines.slice(i + 1).find((line) => !line.startsWith("#"));
    if (!next) continue;
    variants.push({ score: variantScore(lines[i]), url: new URL(next, src).toString() });
  }

  variants.sort((a, b) => b.score - a.score);
  return variants[0]?.url || src;
}

function collectWarmResources(playlist: string, playlistUrl: string, maxDurationSeconds: number, maxSegments: number) {
  const resources: Segment[] = [];
  let duration = 0;
  let nextDuration = 0;

  for (const raw of playlist.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXT-X-KEY") || line.startsWith("#EXT-X-MAP")) {
      const uri = line.match(/URI="([^"]+)"/)?.[1];
      if (uri) resources.push({ url: new URL(uri, playlistUrl).toString(), duration: 0 });
      continue;
    }

    if (line.startsWith("#EXTINF")) {
      nextDuration = Number(line.match(/#EXTINF:([\d.]+)/)?.[1] || 0);
      continue;
    }

    if (line.startsWith("#")) continue;
    if (resources.filter((resource) => resource.duration > 0).length >= maxSegments) break;
    if (duration >= maxDurationSeconds) break;

    resources.push({ url: new URL(line, playlistUrl).toString(), duration: nextDuration || 10 });
    duration += nextDuration || 10;
    nextDuration = 0;
  }

  return resources;
}

async function fetchWarmResources(resources: Segment[], concurrency: number, signal: AbortSignal) {
  let cursor = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), resources.length);

  async function worker() {
    while (cursor < resources.length) {
      const index = cursor;
      cursor += 1;
      const resource = resources[index];
      const response = await fetch(resource.url, { cache: "force-cache", signal });
      if (response.ok) await response.arrayBuffer();
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
}

async function fetchText(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: "force-cache", signal });
  if (!response.ok) throw new Error(`HLS warm request failed (${response.status})`);
  return response.text();
}

function isPlaylist(url: string) {
  return /\.m3u8(?:$|[?#])/i.test(url) || /\/m3u8(?:$|[?#])/i.test(url) || /\/proxy\/(?:m3u8|moon)\b/i.test(url);
}

function variantScore(line: string) {
  const resolution = line.match(/RESOLUTION=\d+x(\d+)/i);
  const bandwidth = line.match(/BANDWIDTH=(\d+)/i);
  return Number(resolution?.[1] || 0) * 100000000 + Number(bandwidth?.[1] || 0);
}
