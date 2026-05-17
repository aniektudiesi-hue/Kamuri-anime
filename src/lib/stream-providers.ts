import { api } from "./api";
import { warmMoonPipeline, warmStreamManifest } from "./stream-cache";
import type { StreamResponse, Subtitle } from "./types";

export type StreamAudioType = "sub" | "dub";
export type StreamProviderId = "mega" | "moon" | "hd1" | (string & {});

export type StreamProvider = {
  id: StreamProviderId;
  label: string;
  desc: string;
  queryType: (type: StreamAudioType) => string;
  fetch: (malId: string, episode: string, type: StreamAudioType) => Promise<StreamResponse>;
  retry: false | number;
  warm?: (stream: StreamResponse | undefined) => void;
};

export const DEFAULT_STREAM_PROVIDER_ID = "mega" satisfies StreamProviderId;

function warmMoonStream(stream: StreamResponse | undefined) {
  if (!warmMoonPipeline(stream, 2)) {
    warmStreamManifest(stream, { segments: 2, timeoutMs: 15_000 });
  }
}

export const STREAM_PROVIDERS = [
  {
    id: DEFAULT_STREAM_PROVIDER_ID,
    label: "MegaPlay",
    desc: "Primary - Adaptive HLS",
    queryType: (type) => type,
    fetch: (malId, episode, type) => api.stream(malId, episode, type),
    retry: false,
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
  {
    id: "hd1",
    label: "HD1",
    desc: "Alternate - Direct",
    queryType: () => "any",
    fetch: (malId, episode) => api.hd1(malId, episode),
    retry: false,
    warm: (stream) => warmStreamManifest(stream, { segments: 1, timeoutMs: 10_000 }),
  },
] as const satisfies readonly StreamProvider[];

export function streamUrlOf(data: StreamResponse | undefined) {
  return data?.m3u8_url || data?.url || data?.stream_url || "";
}

export function hasPlayableStream(data: StreamResponse | undefined) {
  return Boolean(streamUrlOf(data));
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
