import type { Anime } from "./types";

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

const ANILIST_STATUS: Record<string, string> = {
  RELEASING: "currently_airing",
  FINISHED: "finished_airing",
  NOT_YET_RELEASED: "not_yet_aired",
  CANCELLED: "finished_airing",
  HIATUS: "finished_airing",
};

export async function fetchAnimeMetadataByMalId(malId: string | number): Promise<Anime | undefined> {
  const id = Number(malId);
  if (!Number.isFinite(id) || id <= 0) return undefined;

  const anilist = await fetchAniListAnime(id);
  if (anilist) return anilist;
  return fetchJikanAnime(id);
}

async function fetchAniListAnime(malId: number): Promise<Anime | undefined> {
  const query = `
    query AnimeByMalId($idMal: Int!) {
      Media(idMal: $idMal, type: ANIME) {
        idMal id
        title { romaji english native }
        coverImage { large extraLarge }
        bannerImage
        averageScore episodes status
        startDate { year month day }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { idMal: malId } }),
    });
    if (!response.ok) return undefined;
    const json = await response.json() as { data?: { Media?: AniListMedia | null } };
    return json.data?.Media ? mapAniList(json.data.Media) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchJikanAnime(malId: number): Promise<Anime | undefined> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return undefined;
    const json = await response.json() as { data?: JikanAnime };
    return json.data ? mapJikan(json.data) : undefined;
  } catch {
    return undefined;
  }
}

function mapAniList(item: AniListMedia): Anime {
  return {
    mal_id: String(item.idMal ?? item.id),
    id: String(item.id),
    title: item.title.english || item.title.romaji || item.title.native || "Untitled",
    title_en: item.title.english || undefined,
    title_jp: item.title.native || undefined,
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
