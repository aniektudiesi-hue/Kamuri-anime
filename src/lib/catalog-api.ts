import type { AiringScheduleItem, Anime, EpisodeResponse, StreamResponse, Subtitle } from "./types";
import { catalogRegionHeaders } from "./edge-region";

// Single backend = the 5001 season-mapping gateway (authoritative seasons +
// internal stream/section proxy). The UI never calls 3058 directly.
export const CATALOG_API_BASE =
  process.env.CATALOG_API_BASE ||
  process.env.NEXT_PUBLIC_CATALOG_API_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

// Our enriched search backend (has synonyms, correct grouping)
const SEARCH_API_BASE =
  process.env.SEARCH_API_BASE ||
  process.env.NEXT_PUBLIC_SEARCH_API_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

export const CATALOG_PROXY_BASE = "/api/catalog-proxy";
const CLIENT_CACHE_TTL = 1000 * 60 * 5;
const clientCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

type CatalogAnime = {
  mal_id?: string | number;
  anilist_id?: string | number;
  title?: string;
  canonical_title?: string;
  english_title?: string;
  romaji_title?: string;
  native_title?: string;
  banner_image?: string;
  cover_image?: string;
  cr_poster?: string;
  cr_hero?: string;
  detail_banner?: string;
  title_logo?: string;
  synopsis?: string;
  thumbnail_4k_url?: string;
  thumbnail_1080_url?: string;
  local_banner_webp?: string;
  local_cover_webp?: string;
  local_thumbnail_4k_webp?: string;
  local_thumbnail_1080_webp?: string;
  overview?: string;
  genres_json?: string;
  studios_json?: string;
  source?: string;
  average_score?: number;
  score?: number;
  episodes_total?: number;
  current_episodes?: number;
  m3u8_episode_count?: number;
  airing_status?: string;
  status?: string;
  format?: string;
  season_year?: number;
  start_date?: string;
  next_airing_episode?: number;
  next_airing_at?: number;
  cr_season_count?: number;
  season_count?: number;
};

type CatalogListPayload = {
  items?: CatalogAnime[];
  has_more?: boolean;
};

type CatalogStreamRow = {
  episode?: number;
  stream_type?: string;
  m3u8_url?: string;
  subtitles?: string | Subtitle[];
  server_id?: number | string;
  internal_id?: string;
  real_id?: string;
  media_id?: string;
};

type CatalogStreamsPayload = {
  anime?: CatalogAnime & { title?: string };
  streams?: CatalogStreamRow[];
  count?: number;
};

export async function catalogServerGet<T>(path: string, revalidate = 60): Promise<T | undefined> {
  if (typeof window !== "undefined") {
    return catalogClientGet<T>(path).catch(() => undefined);
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${CATALOG_API_BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        ...(revalidate <= 0 ? { cache: "no-store" as const } : { next: { revalidate } }),
      });
      if (!response.ok) return undefined;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return undefined;
  }
}

export async function catalogClientGet<T>(path: string, cacheMs = CLIENT_CACHE_TTL): Promise<T> {
  const base = typeof window === "undefined" ? CATALOG_API_BASE : CATALOG_PROXY_BASE;
  const cacheKey = `${base}${path}`;
  if (cacheMs > 0) {
    const cached = clientCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;
  }
  const promise = fetch(`${base}${path}`, {
    headers: { Accept: "application/json", ...(typeof window === "undefined" ? {} : catalogRegionHeaders()) },
  }).then(async (response) => {
    if (!response.ok) throw new Error(await response.text().catch(() => `${response.status}`));
    return (await response.json()) as T;
  });
  if (cacheMs > 0) {
    clientCache.set(cacheKey, { expiresAt: Date.now() + cacheMs, promise });
    promise.catch(() => clientCache.delete(cacheKey));
  }
  return promise;
}

export function mapCatalogAnime(item: CatalogAnime | undefined): Anime {
  const id = String(item?.mal_id ?? item?.anilist_id ?? "");
  const score = Number(item?.average_score || item?.score || 0);
  const streamEpisodes = Number(item?.m3u8_episode_count || 0);
  const currentEpisodes = Number(item?.current_episodes || 0);
  const totalEpisodes = Number(item?.episodes_total || 0);
  const episodes = Math.max(streamEpisodes, currentEpisodes) || totalEpisodes || 0;
  const format = (item?.format || "").toUpperCase();
  const useSeriesCrArt = format === "TV" || format === "ONA";
  const crPoster = useSeriesCrArt ? item?.cr_poster || undefined : undefined;
  const crHero = useSeriesCrArt ? item?.cr_hero || undefined : undefined;
  const anilistCover = item?.local_cover_webp || item?.cover_image || item?.local_thumbnail_1080_webp || item?.thumbnail_1080_url || item?.local_thumbnail_4k_webp || item?.thumbnail_4k_url || item?.local_banner_webp || item?.banner_image || undefined;
  return {
    mal_id: id,
    anime_id: id,
    id: String(item?.anilist_id ?? id),
    title: item?.english_title || item?.canonical_title || item?.title || item?.romaji_title || item?.native_title || (id ? `Anime ${id}` : "Untitled"),
    title_en: item?.english_title || item?.canonical_title || undefined,
    title_jp: item?.native_title || undefined,
    // Prefer the Crunchyroll vertical poster (1560x2340) when this title has CR
    // metadata — sharper, on-brand thumbnails. Fall back to AniList covers.
    image_url: crPoster || anilistCover,
    poster: crPoster || anilistCover,
    banner: item?.detail_banner || crHero || item?.local_banner_webp || item?.banner_image || undefined,
    cr_poster: crPoster,
    cr_hero: crHero,
    detail_banner: item?.detail_banner || crHero || undefined,
    title_logo: item?.title_logo || undefined,
    synopsis: item?.synopsis || undefined,
    overview: item?.synopsis || item?.overview || undefined,
    genres: parseStringArray(item?.genres_json),
    studios: parseStringArray(item?.studios_json),
    source: item?.source || undefined,
    score: score > 10 ? score / 10 : score || undefined,
    episodes: episodes || undefined,
    episode_count: episodes || undefined,
    num_episodes: episodes || undefined,
    status: normalizeCatalogStatus(item?.airing_status || item?.status),
    start_date: item?.start_date || (item?.season_year ? `${item.season_year}-01-01` : undefined),
    year: Number(item?.season_year || 0) || undefined,
    format: format || undefined,
    season_count: Number(item?.cr_season_count || item?.season_count || 0) || undefined,
    // CR-mapped = has any Crunchyroll keyart/poster. Used to rank CR titles first.
    cr_mapped: Boolean(useSeriesCrArt && (item?.cr_poster || item?.cr_hero || item?.cr_season_count)),
  };
}

function parseStringArray(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined;
  } catch {
    return undefined;
  }
}

export function mapCatalogList(payload: CatalogListPayload | undefined): Anime[] {
  return (payload?.items ?? []).map(mapCatalogAnime).filter((anime) => anime.mal_id);
}

export async function fetchCatalogSection(path: string, limit = 24, page = 1, revalidate = 60) {
  const separator = path.includes("?") ? "&" : "?";
  const payload = await catalogServerGet<CatalogListPayload>(`${path}${separator}limit=${limit}&page=${page}`, revalidate);
  return mapCatalogList(payload);
}

export async function fetchCatalogSearch(query: string, limit = 40, page = 1) {
  const params = new URLSearchParams({ q: query, limit: String(limit), page: String(page) });
  // Use our enriched search backend (synonyms + correct season grouping)
  const base = typeof window === "undefined" ? SEARCH_API_BASE : "/api/search-proxy";
  const payload = await fetch(`${base}/api/search?${params.toString()}`, {
    headers: { Accept: "application/json", ...(typeof window === "undefined" ? {} : catalogRegionHeaders()) },
    ...(typeof window === "undefined" ? { next: { revalidate: 30 } } : {}),
  })
    .then((r) => (r.ok ? (r.json() as Promise<CatalogListPayload>) : undefined))
    .catch(() => undefined);
  return mapCatalogList(payload);
}

export async function fetchCatalogStreams(malId: string, type = "") {
  const suffix = type ? `?stream_type=${encodeURIComponent(type)}` : "";
  return catalogClientGet<CatalogStreamsPayload>(`/api/streams/${encodeURIComponent(malId)}${suffix}`);
}

export type CrEpisode = { ep: string | number; stream_ep?: string | number; title?: string; thumbnail?: string; has_stream?: boolean };
export type CrSeason = {
  season_number?: number;
  title?: string;
  episode_count?: number;
  is_primary?: boolean;
  owner_mal?: string;
  season_thumbnail?: string;
  episodes?: CrEpisode[];
};
export type CrCard = {
  mal_id: string;
  has_cr: number;
  canonical_mal_id?: string;
  cr_series_id?: string;
  image_source?: string;
  hero_banner?: string;
  poster?: string;
  // CR detail-page keyart (extracted from the series page): wide backdrop + title logo
  detail_banner?: string;
  title_logo?: string;
  keyart_local?: string;
  synopsis?: string;
  season_count?: number;
  total_episodes?: number;
  seasons: CrSeason[];
  selected_season?: CrSeason;
};

// Single source of truth for the cr-card React Query key. Card prefetch, the
// detail page, and per-season fetches MUST use this so a version bump can't leave
// them mismatched (a stale key = prefetch warms a cache nobody reads = slow open).
export const CR_CARD_QUERY_VERSION = "canonical-v10";
export function crCardQueryKey(malId: string | number, season = 1) {
  return ["cr-card", CR_CARD_QUERY_VERSION, String(malId), season] as const;
}

export async function fetchCrCard(malId: string, season?: number): Promise<CrCard | null> {
  try {
    // Use our enriched backend (single source of truth — correct season grouping
    // + synopsis, matches the season-review app). Server-side hits it directly,
    // client-side via the proxy route to stay same-origin.
    const base = typeof window === "undefined" ? SEARCH_API_BASE : "/api/search-proxy";
    const params = new URLSearchParams({ v: "canonical-v10" });
    if (season && season > 0) params.set("season", String(season));
    const card = await fetch(`${base}/api/cr/card/${encodeURIComponent(malId)}?${params.toString()}`, {
      headers: { Accept: "application/json", ...(typeof window === "undefined" ? {} : catalogRegionHeaders()) },
      ...(typeof window === "undefined" ? { next: { revalidate: 1800 } } : {}),
    }).then((r) => (r.ok ? (r.json() as Promise<CrCard>) : null));
    // React Query rejects undefined — always return a value (null when missing).
    return card ?? null;
  } catch {
    return null;
  }
}

export async function fetchCatalogEpisodes(malId: string, hint = 0): Promise<EpisodeResponse> {
  const fast = await catalogClientGet<EpisodeResponse>(
    `/api/episodes/${encodeURIComponent(malId)}`,
    1000 * 60 * 5,
  ).catch(() => undefined);
  if (fast?.episodes?.length) {
    // The catalog API already returns exactly the available episodes (with CR
    // titles + thumbnails). Trust it — do NOT inflate to the planned season total,
    // which would render unaired episodes as broken placeholders.
    return { ...fast, num_episodes: Number(fast.num_episodes || fast.episodes.length) };
  }
  const payload = await catalogClientGet<CatalogStreamsPayload>(`/api/streams/${encodeURIComponent(malId)}`);
  const streamNumbers = new Set((payload.streams ?? []).map((stream) => Number(stream.episode || 0)).filter(Boolean));
  const maxStreamEpisode = streamNumbers.size ? Math.max(...streamNumbers) : 0;
  const total = Math.max(
    Number(hint || 0),
    Number(payload.anime?.m3u8_episode_count || 0),
    Number(payload.anime?.current_episodes || 0),
    maxStreamEpisode,
    Number(payload.anime?.episodes_total || 0),
  );
  const episodeNumbers = total > 0
    ? Array.from({ length: total }, (_, index) => index + 1)
    : Array.from(streamNumbers).sort((a, b) => a - b);
  const episodes = episodeNumbers.map((episode) => ({ episode_number: episode, title: `Episode ${episode}` }));
  return {
    anime_id: malId,
    num_episodes: total || episodes.length,
    episodes,
    source: "animeTVplus catalog",
  };
}

// Stream resolver — the CF worker proxies m3u8 segments (handles CORS/Referer).
const ANIME_SEARCH_STREAM_BASE = "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

function hasPlayable(row: { m3u8_url?: string } | undefined) {
  return Boolean(row && row.m3u8_url);
}

export async function fetchCatalogStream(malId: string, episode: string | number, type: "sub" | "dub" = "sub"): Promise<StreamResponse> {
  const epNum = String(episode);

  // Fetch fresh HLS directly from our API (always resolves live, no stale URLs).
  const resolved = await fetchAnimeSearchStream(malId, epNum, type);
  if (resolved) return resolved;

  return { mal_id: malId, episode_num: epNum };
}

// Persist a live-resolved stream into our backend DB (backup_items) via the
// catalog proxy → worker → origin POST /api/stream/<mal>/<ep>.
async function cacheResolvedStream(
  malId: string,
  episode: string,
  type: "sub" | "dub",
  stream: StreamResponse,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!stream.m3u8_url) return;
  try {
    await fetch(`/api/catalog-proxy/api/stream/${encodeURIComponent(malId)}/${encodeURIComponent(episode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...catalogRegionHeaders() },
      body: JSON.stringify({
        stream_type: type,
        m3u8_url: stream.m3u8_url || "",
        subtitles: stream.subtitles || [],
        server_id: stream.server_id || "",
      }),
      keepalive: true,
    });
  } catch {
    // best-effort cache write; ignore failures
  }
}

type AnimeSearchStreamPayload = {
  m3u8_url?: string; url?: string; stream_url?: string;
  sources?: Array<{ url?: string; file?: string; type?: string; quality?: string }>;
  subtitles?: string | Subtitle[] | Array<{ lang?: string; language?: string; label?: string; url?: string; file?: string }>;
  subtitle_url?: string; server_id?: number | string;
};

// Pick the HLS (.m3u8) source from the resolver's `sources[]` array, else the
// first source. The /api/stream resolver returns sources[].url (not m3u8_url),
// so without this the sub fallback silently fails and the episode can't play.
function pickSource(payload: AnimeSearchStreamPayload): string | undefined {
  const direct = payload.m3u8_url || payload.url || payload.stream_url;
  if (direct) return direct;
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const hls = sources.find((s) => (s.type || "").toLowerCase() === "hls" || /\.m3u8(\?|$)/i.test(s.url || s.file || ""));
  return (hls?.url || hls?.file || sources[0]?.url || sources[0]?.file) || undefined;
}

function mapResolverSubtitles(value: AnimeSearchStreamPayload["subtitles"]): Subtitle[] {
  if (!Array.isArray(value)) return normalizeSubtitles(value as string | Subtitle[]);
  return value
    .map((s) => {
      const item = s as Subtitle & { lang?: string; language?: string; url?: string };
      const file = item.file || item.url || "";
      if (!file) return null;
      // Preserve real Subtitle fields (kind/default) while normalizing the doc's
      // {lang,url} shape into {file,label}.
      return { ...item, file, label: item.label || item.language || item.lang || "Subtitle" } as Subtitle;
    })
    .filter((s): s is Subtitle => Boolean(s));
}

async function fetchAnimeSearchStream(malId: string, episode: string, type: "sub" | "dub" = "sub"): Promise<StreamResponse | undefined> {
  try {
    const qs = new URLSearchParams({ type });
    const res = await fetch(
      `${ANIME_SEARCH_STREAM_BASE}/api/stream/${encodeURIComponent(malId)}/${encodeURIComponent(episode)}?${qs.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as AnimeSearchStreamPayload;
    const m3u8 = pickSource(data);
    if (!m3u8) return undefined;
    return {
      m3u8_url: m3u8,
      subtitles: mapResolverSubtitles(data.subtitles),
      subtitle_url: data.subtitle_url,
      server_id: Number(data.server_id || 0) || undefined,
      mal_id: malId,
      episode_num: episode,
    };
  } catch {
    return undefined;
  }
}

export function catalogScheduleFromAnime(items: Anime[]): AiringScheduleItem[] {
  const now = Math.floor(Date.now() / 1000);
  return items.map((anime, index) => ({
    id: String(anime.mal_id || anime.anime_id || anime.id || index),
    episode: Number(anime.episodes || anime.episode_count || 1),
    airingAt: now + index * 3600,
    anime,
  }));
}

function normalizeCatalogStatus(status?: string) {
  const value = (status || "").toLowerCase();
  if (value === "airing" || value === "releasing") return "currently_airing";
  if (value === "completed" || value === "finished") return "finished_airing";
  if (value === "upcoming" || value === "not_yet_released") return "not_yet_aired";
  return status || undefined;
}

function normalizeSubtitles(value: CatalogStreamRow["subtitles"]): Subtitle[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as Subtitle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
