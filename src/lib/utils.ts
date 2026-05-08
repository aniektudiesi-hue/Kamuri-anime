import { clsx, type ClassValue } from "clsx";
import type { Anime, LibraryItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function listFromPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    for (const key of ["value", "results", "items", "data"]) {
      if (Array.isArray(value[key])) return value[key] as T[];
    }
  }
  return [];
}

export function animeId(anime: Anime | undefined) {
  return String(anime?.anime_id ?? anime?.mal_id ?? anime?.id ?? "");
}

export function posterOf(anime: Anime | undefined) {
  const jpg = anime?.images?.jpg;
  const webp = anime?.images?.webp;
  return (
    anime?.poster ||
    anime?.image ||
    anime?.thumbnail ||
    anime?.cover ||
    anime?.image_url ||
    anime?.img_url ||
    webp?.large_image_url ||
    jpg?.large_image_url ||
    webp?.image_url ||
    jpg?.image_url ||
    ""
  );
}

export function bannerOf(anime: Anime | undefined) {
  return anime?.banner || anime?.img_url || anime?.image || posterOf(anime);
}

export function episodeCount(anime: Anime | undefined) {
  return Number(anime?.num_episodes || anime?.episode_count || anime?.episodes || 0);
}

export function displayStatus(status?: string) {
  if (!status) return "Unknown";
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function titleOf(anime: Anime | undefined) {
  const titles = anime?.titles;
  const titleFromArray = Array.isArray(titles)
    ? titles.find((item) => ["English", "Default"].includes(item.type ?? ""))?.title || titles[0]?.title
    : undefined;
  const titleFromObject = titles && !Array.isArray(titles) ? titles.english || titles.en || titles.default || titles.romaji : undefined;
  return anime?.title_en || anime?.title || anime?.name || anime?.english || titleFromArray || titleFromObject || anime?.title_jp || anime?.japanese || "Untitled";
}

export function rankAnimeForSearch(items: Anime[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return [...items].sort((a, b) => scoreSearchItem(b, normalizedQuery) - scoreSearchItem(a, normalizedQuery));
}

function scoreSearchItem(anime: Anime, query: string) {
  const title = titleOf(anime).toLowerCase();
  const english = (anime.title_en || anime.english || "").toLowerCase();
  const status = (anime.status || "").toLowerCase();
  let score = 0;
  if (english) score += 30;
  if (english === query || title === query) score += 120;
  if (english.startsWith(query) || title.startsWith(query)) score += 70;
  if (english.includes(query) || title.includes(query)) score += 30;
  if (status.includes("currently") || status.includes("airing")) score += 24;
  if (status.includes("not_yet")) score += 12;
  score += Math.min(Number(anime.score || 0), 10);
  return score;
}

export function rememberAnime(anime: Anime | undefined) {
  const id = animeId(anime);
  if (!id || typeof window === "undefined") return;
  window.localStorage.setItem(`kairostream-anime-${id}`, JSON.stringify(anime));
}

export function rememberedAnime(id: string) {
  if (!id || typeof window === "undefined") return undefined;
  try {
    return JSON.parse(window.localStorage.getItem(`kairostream-anime-${id}`) || "") as Anime;
  } catch {
    return undefined;
  }
}

export function historyKey(malId: string, episode: string | number) {
  return `kairostream-history-${malId}-${episode}`;
}

export function rememberProgress(item: LibraryItem) {
  const id = String(item.mal_id || item.anime_id || "");
  const episode = item.episode || item.episode_num || 1;
  if (!id || typeof window === "undefined") return;
  window.localStorage.setItem(historyKey(id, episode), JSON.stringify(item));
}

export function rememberedProgress(malId: string, episode: string | number) {
  if (!malId || typeof window === "undefined") return undefined;
  try {
    return JSON.parse(window.localStorage.getItem(historyKey(malId, episode)) || "") as LibraryItem;
  } catch {
    return undefined;
  }
}
