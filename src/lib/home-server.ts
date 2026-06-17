import type { AiringScheduleItem, Anime, HomeInitialData } from "./types";
import { catalogScheduleFromAnime, catalogServerGet, fetchCatalogSection } from "./catalog-api";

const API_BASE = process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL || "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";
const ANILIST_URL = "https://graphql.anilist.co";
const HOME_REVALIDATE_SECONDS = 30 * 60;
const SCHEDULE_REVALIDATE_SECONDS = 6 * 60 * 60;
const MONTHLY_SCHEDULE_MAX_PAGES = 10;
const HOMEPAGE_SCHEDULE_LIMIT = 60;

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

type AniListSchedule = {
  id: number;
  episode: number;
  airingAt: number;
  media: AniListMedia;
};

const ANILIST_STATUS: Record<string, string> = {
  RELEASING: "currently_airing",
  FINISHED: "finished_airing",
  NOT_YET_RELEASED: "not_yet_aired",
  CANCELLED: "finished_airing",
  HIATUS: "finished_airing",
};

type HomeInitialDataOptions = {
  fullSchedule?: boolean;
};

export async function getHomeInitialData(options: HomeInitialDataOptions = {}): Promise<HomeInitialData> {
  const [bannersRaw, thumbnailsRaw, recentRaw, topRatedRaw, popularRaw, romanceRaw, isekaiRaw, sportsRaw, healingRaw] = await Promise.all([
    fetchCatalogSection("/api/anime/season/2026/spring", 10, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/season/2026/spring", 40, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/new-releases", 40, 1, 15 * 60),
    fetchCatalogSection("/api/anime/top-rated", 40, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/popular", 40, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/genre/romance", 30, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/genre/isekai", 30, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/genre/sports", 30, 1, HOME_REVALIDATE_SECONDS),
    fetchCatalogSection("/api/anime/genre/slice-of-life", 30, 1, HOME_REVALIDATE_SECONDS),
  ]);

  // Strip sequels from discovery sections so users find season-1 entry points.
  // "popular" and "topRated" are intentionally NOT filtered — what's popular IS
  // popular including sequels (JJK S2, AoT Final, etc.). Filtering them made the
  // section appear empty because currently-trending titles are often sequels.
  const banners = bannersRaw.filter(isRootAnime);
  const thumbnails = thumbnailsRaw.filter(isRootAnime);
  const recent = recentRaw.filter(isRootAnime);
  const topRated = topRatedRaw;
  const popular = popularRaw;
  const romance = romanceRaw.filter(isRootAnime);
  const isekai = isekaiRaw.filter(isRootAnime);
  const sports = sportsRaw.filter(isRootAnime);
  const healing = healingRaw.filter(isRootAnime);

  const famousNew = prioritizeByTitle(
    mergeUniqueAnime([...recent, ...popular, ...topRated, ...isekai]),
    ["classroom", "tensura", "reincarnated as a slime", "my hero academia", "solo leveling", "jujutsu kaisen", "demon slayer"],
  );
  const selfImprovement = prioritizeByTitle(
    mergeUniqueAnime([...sports, ...healing, ...topRated, ...popular]),
    ["blue lock", "haikyuu", "run with the wind", "barakamon", "relife", "march comes in like a lion", "baby steps", "ping pong"],
  );

  const [crBanners, crThumbs, crRecent, crTop, crPopular, crFamousNew, crRomance, crIsekai, crSports, crSelfImprovement, crHealing] = await Promise.all([
    enrichWithCr(banners),
    enrichWithCr(thumbnails),
    enrichWithCr(recent),
    enrichWithCr(topRated),
    enrichWithCr(popular),
    enrichWithCr(mergeUniqueAnime([...famousNew, ...recent.slice(0, 10), ...popular.slice(0, 10)])),
    enrichWithCr(romance),
    enrichWithCr(isekai),
    enrichWithCr(sports),
    enrichWithCr(selfImprovement),
    enrichWithCr(healing),
  ]);

  const scheduleItems = options.fullSchedule
    ? catalogScheduleFromAnime(await fetchCatalogSection("/api/anime/airing", HOMEPAGE_SCHEDULE_LIMIT, 1, SCHEDULE_REVALIDATE_SECONDS))
    : [];

  return {
    banners: crBanners.slice(0, 10),
    thumbnails: crThumbs.slice(0, 24),
    recent: crRecent.slice(0, 24),
    topRated: crTop.slice(0, 24),
    popular: crPopular.slice(0, 24),
    famousNew: crFamousNew.slice(0, 24),
    romance: crRomance.slice(0, 24),
    isekai: crIsekai.slice(0, 24),
    sports: crSports.slice(0, 24),
    selfImprovement: crSelfImprovement.slice(0, 24),
    healing: crHealing.slice(0, 24),
    schedule: scheduleItems,
    generatedAt: new Date().toISOString(),
  };
}

// Sequel patterns — e.g. "Season 2", "2nd Season", "Final Season", "Part 2"
const SEQUEL_RE = /\b(season\s*[2-9]|[2-9](st|nd|rd|th)\s+season|final\s+season|part\s*[2-9ii]+|ii+$|ova$|specials?$)\b/i;

function isRootAnime(anime: Anime): boolean {
  const t = `${anime.title || ""} ${(anime as Record<string,unknown>).title_en || ""} ${(anime as Record<string,unknown>).canonical_title || ""}`.trim();
  return !SEQUEL_RE.test(t);
}

function mergeUniqueAnime(items: Anime[]) {
  const seen = new Set<string>();
  const merged: Anime[] = [];
  for (const item of items) {
    const id = String(item.mal_id || item.anime_id || item.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  return merged;
}

function prioritizeByTitle(items: Anime[], needles: string[]) {
  const normalizedNeedles = needles.map((needle) => needle.toLowerCase());
  return [...items].sort((a, b) => titlePriority(b, normalizedNeedles) - titlePriority(a, normalizedNeedles));
}

function titlePriority(item: Anime, needles: string[]) {
  const title = `${item.title || ""} ${item.title_en || ""} ${item.name || ""}`.toLowerCase();
  const match = needles.findIndex((needle) => title.includes(needle));
  return match === -1 ? 0 : 1000 - match;
}

type CrPosterMap = Record<string, { poster?: string; hero?: string; has_cr?: number }>;

// Batch-fetch CR posters for a section from our backend, merge them onto each
// title, and stable-sort CR-mapped first. Falls back to the original list if the
// lookup fails so a section never goes empty.
async function enrichWithCr(items: Anime[]): Promise<Anime[]> {
  const ids = items
    .map((a) => String(a.mal_id || a.anime_id || a.id || ""))
    .filter(Boolean);
  if (!ids.length) return items;
  try {
    const res = await catalogServerGet<{ posters?: CrPosterMap }>(
      `/api/cr/posters?ids=${encodeURIComponent(ids.join(","))}`,
      HOME_REVALIDATE_SECONDS,
    );
    const map = res?.posters || {};
    const enriched = items.map((a) => {
      const id = String(a.mal_id || a.anime_id || a.id || "");
      const cr = map[id];
      if (cr?.poster || cr?.hero) {
        return {
          ...a,
          image_url: cr.poster || a.image_url,
          poster: cr.poster || a.poster,
          cr_poster: cr.poster || a.cr_poster,
          cr_hero: cr.hero || a.cr_hero,
          detail_banner: cr.hero || a.detail_banner,
          banner: cr.hero || a.banner,
          cr_mapped: true,
        };
      }
      if (cr?.has_cr) return { ...a, cr_mapped: true };
      return a;
    });
    return enriched
      .map((a, i) => ({ a, i }))
      .sort((x, y) => (x.a.cr_mapped ? 0 : 1) - (y.a.cr_mapped ? 0 : 1) || x.i - y.i)
      .map((o) => o.a);
  } catch {
    return items;
  }
}

export async function getHomepageSchedule() {
  const airing = await fetchCatalogSection("/api/anime/airing", HOMEPAGE_SCHEDULE_LIMIT, 1, SCHEDULE_REVALIDATE_SECONDS);
  return catalogScheduleFromAnime(airing).slice(0, HOMEPAGE_SCHEDULE_LIMIT);
}

async function fetchMonthlyAiringSchedule(maxPages: number): Promise<AiringScheduleItem[]> {
  return safeJson(async () => {
    const now = new Date();
    const start = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0) / 1000) - 1;
    const end = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0) / 1000);
    const query = `
      query MonthlySchedule($page: Int!, $perPage: Int!, $start: Int!, $end: Int!) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
            id
            episode
            airingAt
            media {
              idMal id
              title { romaji english native }
              coverImage { large extraLarge }
              bannerImage
              averageScore episodes status
            }
          }
        }
      }
    `;

    const pages: AniListSchedule[][] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await timedFetch(ANILIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { page, perPage: 50, start, end } }),
        next: { revalidate: SCHEDULE_REVALIDATE_SECONDS },
      });
      if (!response.ok) break;
      const json = await response.json() as {
        data?: { Page?: { pageInfo?: { hasNextPage?: boolean }; airingSchedules?: AniListSchedule[] } };
      };
      const pageData = json.data?.Page;
      pages.push(pageData?.airingSchedules ?? []);
      if (!pageData?.pageInfo?.hasNextPage) break;
    }

    const seen = new Set<string>();
    return pages
      .flat()
      .filter((item) => item.media?.idMal || item.media?.id)
      .map(mapSchedule)
      .filter((item) => {
        const key = `${item.id}:${item.episode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.airingAt - b.airingAt);
  }, []);
}

async function timedFetch(input: string, init: RequestInit & { next?: { revalidate?: number } }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function mapSchedule(item: AniListSchedule): AiringScheduleItem {
  const media = item.media;
  return {
    id: String(media.idMal ?? media.id),
    episode: item.episode,
    airingAt: item.airingAt,
    anime: {
      mal_id: media.idMal ? String(media.idMal) : String(media.id),
      id: String(media.id),
      title: media.title.english || media.title.romaji || media.title.native || "Untitled",
      title_en: media.title.english || undefined,
      image_url: media.coverImage.extraLarge || media.coverImage.large,
      banner: media.bannerImage || undefined,
      score: media.averageScore ? media.averageScore / 10 : undefined,
      episodes: media.episodes ?? undefined,
      status: ANILIST_STATUS[media.status] || media.status.toLowerCase(),
    },
  };
}
