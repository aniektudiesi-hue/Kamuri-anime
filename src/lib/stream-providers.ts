import { api } from "./api";
import { warmMoonPipeline, warmStreamManifest } from "./stream-cache";
import type { StreamResponse, Subtitle } from "./types";

export type StreamAudioType = "sub" | "dub";
export type StreamProviderId = "hd1" | "hd2" | "megaplay" | "moon" | (string & {});

export type StreamProvider = {
  id: StreamProviderId;
  label: string;
  desc: string;
  queryType: (type: StreamAudioType) => string;
  fetch: (malId: string, episode: string, type: StreamAudioType) => Promise<StreamResponse>;
  retry: false | number;
  warm?: (stream: StreamResponse | undefined) => void;
};

// HD1 and HD2 are the SAME stream proxied through two different Cloudflare
// workers. If one worker is under heavy load (or fails), the player falls back
// to the other — so we always have a healthy edge.
const KAMURI_WORKER = "anime-tv-stream-proxy.animetvplus-stream.workers.dev";
const ANIMETVPLUS_WORKER = "anime-tv-stream-proxy.animetvplus-stream.workers.dev";

// Rewrite every proxied URL in a stream response from the Kamuri worker host to
// another worker host (used for HD2).
function viaWorker(stream: StreamResponse | undefined, host: string): StreamResponse | undefined {
  if (!stream) return stream;
  const swap = (u: unknown) => (typeof u === "string" ? u.split(KAMURI_WORKER).join(host) : u as string | undefined);
  return {
    ...stream,
    m3u8_url: swap(stream.m3u8_url),
    url: swap(stream.url),
    stream_url: swap(stream.stream_url),
    subtitle_url: swap(stream.subtitle_url),
    vtt_url: swap(stream.vtt_url),
    subtitles: stream.subtitles?.map((s) => ({ ...s, file: swap(s.file) as string })),
  } as StreamResponse;
}

export const DEFAULT_STREAM_PROVIDER_ID = "hd1" satisfies StreamProviderId;

function warmMoonStream(stream: StreamResponse | undefined) {
  if (!warmMoonPipeline(stream, 12)) {
    warmStreamManifest(stream, { segments: 8, timeoutMs: 15_000 });
  }
}

export const STREAM_PROVIDERS = [
  {
    id: DEFAULT_STREAM_PROVIDER_ID,
    label: "HD1",
    desc: "Kamuri edge",
    queryType: (type) => type,
    fetch: (malId, episode, type) => api.stream(malId, episode, type),
    retry: false,
    warm: (stream) => warmStreamManifest(stream, { segments: 2, timeoutMs: 8_000 }),
  },
  {
    id: "hd2",
    label: "HD2",
    desc: "AnimeTVPlus edge",
    queryType: (type) => type,
    fetch: async (malId, episode, type) => viaWorker(await api.stream(malId, episode, type), ANIMETVPLUS_WORKER) as StreamResponse,
    retry: 1,
    warm: (stream) => warmStreamManifest(stream, { segments: 2, timeoutMs: 8_000 }),
  },
  {
    id: "megaplay",
    label: "Megaplay",
    desc: "Megaplay CDN",
    queryType: (type) => type,
    fetch: (malId, episode, type) => api.megaplay(malId, episode, type),
    retry: 1,
    warm: (stream) => warmStreamManifest(stream, { segments: 4, timeoutMs: 10_000 }),
  },
  {
    id: "moon",
    label: "Moon",
    desc: "Backup - Fast CDN",
    queryType: () => "any",
    fetch: (malId, episode) => api.moon(malId, episode),
    retry: 1,
    warm: warmMoonStream,
  },
] as const satisfies readonly StreamProvider[];

export function streamUrlOf(data: StreamResponse | undefined) {
  return data?.m3u8_url || data?.url || data?.stream_url || "";
}

export function iframeUrlOf(data: StreamResponse | undefined) {
  return data?.iframe_url || data?.embed_url || "";
}

export function hasPlayableStream(data: StreamResponse | undefined) {
  return Boolean(streamUrlOf(data) || iframeUrlOf(data));
}

export function subtitlesOfStream(data: StreamResponse | undefined): Subtitle[] {
  const subtitles = [...(data?.subtitles ?? [])];
  if (data?.subtitle_url) {
    subtitles.push({ file: data.subtitle_url, label: "English", kind: "subtitles", default: !subtitles.length });
  }
  if (data?.vtt_url) {
    subtitles.push({ file: data.vtt_url, label: "English", kind: "subtitles", default: !subtitles.length });
  }

  const seen = new Set<string>();
  return subtitles.filter((subtitle) => {
    if (!subtitle.file || seen.has(subtitle.file)) return false;
    seen.add(subtitle.file);
    return true;
  });
}

export function withFallbackSubtitles(
  stream: StreamResponse | undefined,
  fallbacks: Array<StreamResponse | undefined>,
) {
  if (!stream) return undefined;
  const own = subtitlesOfStream(stream);
  if (own.length) return { ...stream, subtitles: own };

  const fallbackSubtitles = fallbacks.flatMap((fallback) => subtitlesOfStream(fallback));
  if (!fallbackSubtitles.length) return stream;

  const seen = new Set<string>();
  return {
    ...stream,
    subtitles: fallbackSubtitles.filter((subtitle) => {
      if (seen.has(subtitle.file)) return false;
      seen.add(subtitle.file);
      return true;
    }),
  };
}

export function streamProviderQueryKey(
  provider: StreamProvider,
  malId: string,
  episode: string,
  type: StreamAudioType,
) {
  return ["stream", malId, episode, provider.id, provider.queryType(type)] as const;
}

export function streamProviderCacheKey(
  provider: StreamProvider,
  malId: string,
  episode: string,
  type: StreamAudioType,
) {
  return `${provider.id}:${malId}:${episode}:${provider.queryType(type)}`;
}

export function fetchStreamProvider(
  provider: StreamProvider,
  params: { malId: string; episode: string; type: StreamAudioType },
) {
  return provider.fetch(params.malId, params.episode, params.type);
}

export function warmStreamProvider(provider: StreamProvider, stream: StreamResponse | undefined) {
  provider.warm?.(stream);
}

export function streamProviderIndex(id: StreamProviderId) {
  return STREAM_PROVIDERS.findIndex((provider) => provider.id === id);
}

export function streamProviderById(id: StreamProviderId) {
  return STREAM_PROVIDERS.find((provider) => provider.id === id);
}
