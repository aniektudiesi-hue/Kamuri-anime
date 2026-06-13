import type { Anime } from "./types";
import { animeId } from "./utils";
import { catalogClientGet, mapCatalogList } from "./catalog-api";
import { catalogRegionHeaders } from "./edge-region";

type AniListMedia = {
  idMal: number | null;
  id: number;
  title: { romaji: string; english: string | null; native?: string | null };
  coverImage: { large?: string; extraLarge?: string };
  bannerImage?: string | null;
  averageScore: number | null;
  episodes: number | null;
  status: string;
  startDate?: { year?: number | null; month?: number | null; day?: number | null };
};

type JikanAnime = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  images?: {
    jpg?: { image_url?: string; large_image_url?: string };
    webp?: { image_url?: string; large_image_url?: string };
  };
  score?: number | null;
  episodes?: number | null;
  status?: string | null;
  aired?: { from?: string | null };
};

type MediaSort = "POPULARITY_DESC" | "TRENDING_DESC" | "SCORE_DESC" | "START_DATE_DESC";
type MediaStatus = "RELEASING" | "FINISHED" | "NOT_YET_RELEASED";
type MediaSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type DiscoveryIntent = {
  key: string;
  label: string;
  sourceLabel: string;
  useBackend: boolean;
  search?: string;
  genre?: string;
  tag?: string;
  status?: MediaStatus;
  season?: MediaSeason;
  seasonYear?: number;
  sort: MediaSort;
  jikanQuery?: string;
  jikanOrderBy?: "popularity" | "score" | "start_date";
  jikanStatus?: "airing" | "complete" | "upcoming";
};

export const DISCOVERY_CHIPS = [
  "Explore",
  "Popular",
  "Top Rated",
  "Airing",
  "Spring 2026",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Harem",
  "Ecchi",
  "Erotica",
  "Isekai",
  "Dungeon",
  "Reincarnation",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Martial Arts",
];

const ANILIST_STATUS: Record<string, string> = {
  RELEASING: "currently_airing",
  FINISHED: "finished_airing",
  NOT_YET_RELEASED: "not_yet_aired",
  CANCELLED: "finished_airing",
  HIATUS: "finished_airing",
};

const ANILIST_GENRES = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
]);

const TAG_ALIASES: Record<string, string> = {
  isekai: "Isekai",
  school: "School",
  "martial arts": "Martial Arts",
  vampire: "Vampire",
  "time travel": "Time Manipulation",
  demons: "Demons",
  dungeon: "Dungeon",
  dungeons: "Dungeon",
  reincarnation: "Reincarnation",
  reincarnated: "Reincarnation",
  erotica: "Erotica",
  erotic: "Erotica",
  harem: "Harem",
  ninja: "Ninja",
};

const GENRE_ALIASES = new Map(
  Array.from(ANILIST_GENRES).map((genre) => [normalize(genre), genre]),
);

export function resolveDiscoveryIntent(rawQuery: string): DiscoveryIntent {
  const query = rawQuery.trim();
  const normalized = normalize(query);

  if (["", "explore", "browse", "browse anime", "all anime", "database", "catalogue", "catalog"].includes(normalized)) {
    return {
      key: "browse:database",
      label: "Explore Anime",
      sourceLabel: "Full animeTVplus database",
      useBackend: false,
      sort: "START_DATE_DESC",
      jikanOrderBy: "start_date",
    };
  }

  const seasonMatch = normalized.match(/\b(winter|spring|summer|fall|autumn)\s*(20\d{2})?\b/);
  if (seasonMatch) {
    const season = seasonMatch[1] === "autumn" ? "FALL" : seasonMatch[1].toUpperCase();
    const year = seasonMatch[2] ? Number(seasonMatch[2]) : new Date().getFullYear();
    return {
      key: `season:${season}:${year}`,
      label: `${toTitleCase(season.toLowerCase())} ${year}`,
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      season: season as MediaSeason,
      seasonYear: year,
      sort: "POPULARITY_DESC",
      jikanQuery: query,
      jikanOrderBy: "popularity",
    };
  }

  if (["trending", "popular", "popular today", "most popular"].includes(normalized)) {
    return {
      key: "browse:popular",
      label: "Popular Anime",
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      sort: "TRENDING_DESC",
      jikanOrderBy: "popularity",
    };
  }

  if (["top rated", "top", "highest rated", "best rated", "rating"].includes(normalized)) {
    return {
      key: "browse:top-rated",
      label: "Top Rated Anime",
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      sort: "SCORE_DESC",
      jikanOrderBy: "score",
    };
  }

  if (["new releases", "new release", "new", "latest", "recent launches"].includes(normalized)) {
    return {
      key: "browse:new-releases",
      label: "New Releases",
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      status: "RELEASING",
      sort: "START_DATE_DESC",
      jikanOrderBy: "start_date",
      jikanStatus: "airing",
    };
  }

  if (["airing", "currently airing"].includes(normalized)) {
    return {
      key: "browse:airing",
      label: "Currently Airing",
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      status: "RELEASING",
      sort: "START_DATE_DESC",
      jikanOrderBy: "start_date",
      jikanStatus: "airing",
    };
  }

  const genre = GENRE_ALIASES.get(normalized);
  if (genre) {
    return {
      key: `genre:${genre}`,
      label: genre,
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      genre,
      sort: "POPULARITY_DESC",
      jikanQuery: genre,
      jikanOrderBy: "popularity",
    };
  }

  const tag = TAG_ALIASES[normalized];
  if (tag) {
    return {
      key: `tag:${tag}`,
      label: tag,
      sourceLabel: "animeTVplus catalog",
      useBackend: false,
      tag,
      sort: "POPULARITY_DESC",
      jikanQuery: tag,
      jikanOrderBy: "popularity",
    };
  }

  return {
    key: `search:${normalized}`,
    label: query,
    sourceLabel: "animeTVplus catalog",
    useBackend: true,
    search: query,
    sort: "POPULARITY_DESC",
    jikanQuery: query,
  };
}

// Our enriched search backend — root-only (no S2/S3 dupes), CR metadata, synonyms.
const SEARCH_DISCOVERY_BASE =
  process.env.SEARCH_API_BASE ||
  process.env.NEXT_PUBLIC_SEARCH_API_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

function searchParamsForIntent(intent: DiscoveryIntent, page: number, fmt = ""): string {
  const params = new URLSearchParams({ limit: "60", page: String(page) });
  const genre = intent.genre || intent.tag;
  if (intent.search) {
    params.set("q", intent.search);
  } else if (genre) {
    params.set("genre", genre);
  }
  if (fmt && fmt !== "ALL") params.set("fmt", fmt);
  // Sort hint so browse intents are genuinely sorted (Top Rated by score, New
  // Releases by date) instead of the whole catalog by popularity.
  if (intent.key === "browse:top-rated") params.set("sort", "score");
  else if (intent.key === "browse:new-releases" || intent.key === "browse:airing") params.set("sort", "new");
  // Browse intents (popular/top-rated/database/airing/new-releases) and the
  // bare "Explore" land here with neither q nor genre → backend browse mode
  // (root anime sorted by popularity).
  return params.toString();
}

export type DiscoveryFacets = { ALL: number; TV: number; MOVIE: number; OVA: number; ONA: number; SPECIAL: number };

export async function fetchAniListDiscovery(
  intent: DiscoveryIntent,
  page: number,
  fmt = "",
  timeoutMs?: number,
): Promise<{ media: Anime[]; hasNextPage: boolean; total: number; count: number; page: number; facets?: DiscoveryFacets }> {
  const isBrowse = !intent.search && !intent.genre && !intent.tag;
  const effectiveTimeout = timeoutMs ?? (isBrowse ? 25000 : 3500);
  try {
    const qs = searchParamsForIntent(intent, page, fmt);
    // Server-side hits the backend directly; client-side goes through the proxy
    // route to stay same-origin.
    const base = typeof window === "undefined" ? `${SEARCH_DISCOVERY_BASE}/api/search` : "/api/search-proxy/api/search";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeout);
    const json = await fetch(`${base}?${qs}`, {
      headers: { Accept: "application/json", ...(typeof window === "undefined" ? {} : catalogRegionHeaders()) },
      signal: controller.signal,
      ...(typeof window === "undefined" ? { next: { revalidate: 30 } } : {}),
    })
      .then((r) => (r.ok ? (r.json() as Promise<Parameters<typeof mapCatalogList>[0] & { total?: number; count?: number; page?: number; facets?: DiscoveryFacets }>) : undefined))
      .finally(() => clearTimeout(timeout));
    return {
      media: mapCatalogList(json),
      hasNextPage: Boolean(json?.has_more),
      total: Number(json?.total || 0),
      count: Number(json?.count || 0),
      page: Number(json?.page || page),
      facets: json?.facets,
    };
  } catch {
    return { media: [], hasNextPage: false, total: 0, count: 0, page };
  }
}

export async function fetchJikanDiscovery(
  intent: DiscoveryIntent,
  page: number,
): Promise<{ media: Anime[]; hasNextPage: boolean }> {
  void intent;
  void page;
  return { media: [], hasNextPage: false };
}

export function mergeAnimeSources(...sources: Anime[][]) {
  const seen = new Set<string>();
  const merged: Anime[] = [];
  for (const source of sources) {
    for (const anime of source) {
      const id = animeId(anime);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(anime);
    }
  }
  return merged;
}

function catalogPathForIntent(intent: DiscoveryIntent, page: number) {
  const limit = "60";
  if (!intent.label && !intent.search && !intent.genre && !intent.tag && !intent.seasonYear) {
    return `/api/anime/database?limit=${limit}&page=${page}`;
  }
  if (intent.key === "browse:top-rated") {
    return `/api/anime/top-rated?limit=${limit}&page=${page}`;
  }
  if (intent.key === "browse:airing") {
    return `/api/anime/airing?limit=${limit}&page=${page}`;
  }
  if (intent.key === "browse:new-releases") {
    return `/api/anime/new-releases?limit=${limit}&page=${page}`;
  }
  if (intent.key === "browse:popular") {
    return `/api/anime/popular?limit=${limit}&page=${page}`;
  }
  if (intent.key === "browse:database") {
    return `/api/anime/database?limit=${limit}&page=${page}`;
  }
  if (intent.seasonYear && intent.season) {
    return `/api/anime/season/${intent.seasonYear}/${intent.season.toLowerCase()}?limit=${limit}&page=${page}`;
  }
  if (intent.genre || intent.tag) {
    return `/api/anime/genre/${encodeURIComponent(intent.genre || intent.tag || "")}?limit=${limit}&page=${page}`;
  }
  const query = intent.search || intent.genre || intent.tag || intent.jikanQuery || intent.label;
  return `/api/search?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}`;
}

function mapAniList(item: AniListMedia): Anime {
  return {
    mal_id: item.idMal ? String(item.idMal) : String(item.id),
    title: item.title.english || item.title.romaji || item.title.native || "Untitled",
    title_en: item.title.english || undefined,
    image_url: item.coverImage.extraLarge || item.coverImage.large,
    banner: item.bannerImage || undefined,
    score: item.averageScore ? item.averageScore / 10 : undefined,
    episodes: item.episodes ?? undefined,
    status: ANILIST_STATUS[item.status] || item.status.toLowerCase(),
    start_date: formatAniListStartDate(item.startDate),
    year: item.startDate?.year ?? undefined,
  };
}

function mapJikan(item: JikanAnime): Anime {
  return {
    mal_id: String(item.mal_id),
    title: item.title_english || item.title || item.title_japanese || "Untitled",
    title_en: item.title_english || undefined,
    title_jp: item.title_japanese || undefined,
    image_url: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url || item.images?.webp?.image_url || item.images?.jpg?.image_url,
    score: item.score ?? undefined,
    episodes: item.episodes ?? undefined,
    status: normalizeJikanStatus(item.status),
    start_date: item.aired?.from || undefined,
    year: item.aired?.from ? new Date(item.aired.from).getFullYear() : undefined,
  };
}

function formatAniListStartDate(startDate?: AniListMedia["startDate"]) {
  const year = startDate?.year;
  if (!year) return undefined;
  const month = startDate.month ? String(startDate.month).padStart(2, "0") : "01";
  const day = startDate.day ? String(startDate.day).padStart(2, "0") : "01";
  return `${year}-${month}-${day}`;
}

function normalizeJikanStatus(status?: string | null) {
  const value = (status || "").toLowerCase();
  if (value.includes("airing")) return "currently_airing";
  if (value.includes("finished")) return "finished_airing";
  if (value.includes("not yet")) return "not_yet_aired";
  return status || undefined;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_+-]+/g, " ").replace(/\s+/g, " ");
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
