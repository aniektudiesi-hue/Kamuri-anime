import type { Anime } from "./types";
import { animeId } from "./utils";

type AniListMedia = {
  idMal: number | null;
  id: number;
  title: { romaji: string; english: string | null; native?: string | null };
  coverImage: { large?: string; extraLarge?: string };
  bannerImage?: string | null;
  averageScore: number | null;
  episodes: number | null;
  status: string;
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
  "Popular",
  "Top Rated",
  "Airing",
  "Spring 2026",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Isekai",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
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
  ninja: "Ninja",
};

const GENRE_ALIASES = new Map(
  Array.from(ANILIST_GENRES).map((genre) => [normalize(genre), genre]),
);

export function resolveDiscoveryIntent(rawQuery: string): DiscoveryIntent {
  const query = rawQuery.trim();
  const normalized = normalize(query);

  const seasonMatch = normalized.match(/\b(winter|spring|summer|fall|autumn)\s*(20\d{2})?\b/);
  if (seasonMatch) {
    const season = seasonMatch[1] === "autumn" ? "FALL" : seasonMatch[1].toUpperCase();
    const year = seasonMatch[2] ? Number(seasonMatch[2]) : new Date().getFullYear();
    return {
      key: `season:${season}:${year}`,
      label: `${toTitleCase(season.toLowerCase())} ${year}`,
      sourceLabel: "Seasonal results from AniList and MyAnimeList",
      useBackend: false,
      season: season as MediaSeason,
      seasonYear: year,
      sort: "POPULARITY_DESC",
      jikanQuery: query,
      jikanOrderBy: "popularity",
    };
  }

  if (["trending", "popular", "popular today", "browse", "most popular"].includes(normalized)) {
    return {
      key: "browse:popular",
      label: "Popular Anime",
      sourceLabel: "Ranked by AniList trending and MyAnimeList popularity",
      useBackend: false,
      sort: "TRENDING_DESC",
      jikanOrderBy: "popularity",
    };
  }

  if (["top rated", "top", "highest rated", "best rated", "rating"].includes(normalized)) {
    return {
      key: "browse:top-rated",
      label: "Top Rated Anime",
      sourceLabel: "Sorted by AniList scores with MyAnimeList backup",
      useBackend: false,
      sort: "SCORE_DESC",
      jikanOrderBy: "score",
    };
  }

  if (["airing", "new releases", "new release", "new", "latest", "recent launches", "currently airing"].includes(normalized)) {
    return {
      key: "browse:airing",
      label: "Currently Airing",
      sourceLabel: "Fresh airing anime from AniList and MyAnimeList",
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
      sourceLabel: "Genre results from AniList with MyAnimeList backup",
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
      sourceLabel: "Tag results from AniList with MyAnimeList backup",
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
    sourceLabel: "Search results from your API, AniList, and MyAnimeList",
    useBackend: true,
    search: query,
    sort: "POPULARITY_DESC",
    jikanQuery: query,
    jikanOrderBy: "popularity",
  };
}

export async function fetchAniListDiscovery(
  intent: DiscoveryIntent,
  page: number,
): Promise<{ media: Anime[]; hasNextPage: boolean }> {
  const gql = `
    query DiscoverAnime(
      $page: Int!,
      $perPage: Int!,
      $search: String,
      $genre: String,
      $tag: String,
      $status: MediaStatus,
      $season: MediaSeason,
      $seasonYear: Int,
      $sort: [MediaSort]
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(
          type: ANIME,
          search: $search,
          genre: $genre,
          tag: $tag,
          status: $status,
          season: $season,
          seasonYear: $seasonYear,
          sort: $sort
        ) {
          idMal id
          title { romaji english native }
          coverImage { large extraLarge }
          bannerImage
          averageScore episodes status
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: gql,
        variables: {
          page,
          perPage: 30,
          search: intent.search,
          genre: intent.genre,
          tag: intent.tag,
          status: intent.status,
          season: intent.season,
          seasonYear: intent.seasonYear,
          sort: [intent.sort],
        },
      }),
    });
    if (!response.ok) return { media: [], hasNextPage: false };
    const json = await response.json() as {
      data?: { Page?: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } };
    };
    const pageData = json.data?.Page;
    return {
      media: (pageData?.media ?? []).filter((item) => item.idMal || item.id).map(mapAniList),
      hasNextPage: pageData?.pageInfo?.hasNextPage ?? false,
    };
  } catch {
    return { media: [], hasNextPage: false };
  }
}

export async function fetchJikanDiscovery(
  intent: DiscoveryIntent,
  page: number,
): Promise<{ media: Anime[]; hasNextPage: boolean }> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      sfw: "true",
      order_by: intent.jikanOrderBy ?? "popularity",
      sort: "desc",
    });
    if (intent.jikanStatus) params.set("status", intent.jikanStatus);
    if (intent.jikanQuery) params.set("q", intent.jikanQuery);

    const response = await fetch(`https://api.jikan.moe/v4/anime?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { media: [], hasNextPage: false };
    const json = await response.json() as {
      data?: JikanAnime[];
      pagination?: { has_next_page?: boolean };
    };
    return {
      media: (json.data ?? []).map(mapJikan),
      hasNextPage: Boolean(json.pagination?.has_next_page),
    };
  } catch {
    return { media: [], hasNextPage: false };
  }
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
  };
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
