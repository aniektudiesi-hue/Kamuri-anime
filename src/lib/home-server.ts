import type { AiringScheduleItem, Anime, HomeInitialData } from "./types";
import { listFromPayload } from "./utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";
const ANILIST_URL = "https://graphql.anilist.co";
const HOME_REVALIDATE_SECONDS = 30 * 60;
const SCHEDULE_REVALIDATE_SECONDS = 6 * 60 * 60;
const MONTHLY_SCHEDULE_MAX_PAGES = 10;

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

export async function getHomeInitialData(): Promise<HomeInitialData> {
  const [banners, thumbnails, recent, topRated, schedule] = await Promise.all([
    fetchHomeList("/api/v1/banners"),
    fetchHomeList("/home/thumbnails"),
    fetchHomeList("/home/recently-added", 15 * 60),
    fetchHomeList("/home/top-rated"),
    fetchMonthlyAiringSchedule(),
  ]);

  return {
    banners: banners.slice(0, 10),
    thumbnails: thumbnails.slice(0, 24),
    recent: recent.slice(0, 24),
    topRated: topRated.slice(0, 24),
    schedule,
    generatedAt: new Date().toISOString(),
  };
}

async function fetchHomeList(path: string, revalidate = HOME_REVALIDATE_SECONDS) {
  return safeJson(async () => {
    const response = await timedFetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!response.ok) return [];
    return listFromPayload<Anime>(await response.json());
  }, []);
}

async function fetchMonthlyAiringSchedule(): Promise<AiringScheduleItem[]> {
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
    for (let page = 1; page <= MONTHLY_SCHEDULE_MAX_PAGES; page += 1) {
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
