import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { imageCdnUrl } from "./image-cdn";
import type { Anime, LibraryItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function posterOf(anime: Anime | undefined, variant: "poster-sm" | "poster-md" | "poster-lg" = "poster-md") {
  const jpg = anime?.images?.jpg;
  const webp = anime?.images?.webp;
  return imageCdnUrl(
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
    "",
    variant,
  );
}

export function bannerOf(anime: Anime | undefined, variant: "banner-sm" | "banner-lg" = "banner-lg") {
  return imageCdnUrl(anime?.banner || anime?.img_url || anime?.image || posterOf(anime, "poster-lg"), variant);
}

export function episodeCount(anime: Anime | undefined) {
  return Number(anime?.num_episodes || anime?.episode_count || anime?.episodes || 0);
}

export function episodeLabel(anime: Anime | undefined, prefix = "Ep") {
  const count = episodeCount(anime);
  return count > 0 ? `${prefix} ${count}` : `${prefix} TBA`;
}

export function progressOf(item: LibraryItem | undefined) {
  return Number(item?.playback_pos || item?.progress || item?.timestamp || 0);
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

export function slugifyTitle(value: string, fallback = "anime") {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || fallback;
}

export function idFromSlug(value: string | number | undefined) {
  const raw = String(value ?? "");
  const match = raw.match(/(\d+)(?!.*\d)/);
  return match?.[1] || raw;
}

export function episodeNumberFromSlug(value: string | number | undefined) {
  const raw = String(value ?? "");
  const match = raw.match(/(\d+)(?!.*\d)/);
  return match?.[1] || raw || "1";
}

export function animeSlug(anime: Anime | undefined, fallbackId?: string | number) {
  const id = animeId(anime) || String(fallbackId ?? "");
  const title = titleOf(anime) === "Untitled" ? `anime-${id || "title"}` : titleOf(anime);
  return id ? `${slugifyTitle(title)}-${id}` : slugifyTitle(title);
}

export function animePath(anime: Anime | undefined, fallbackId?: string | number) {
  return `/anime/${animeSlug(anime, fallbackId)}`;
}

export function episodeSlug(episode: string | number) {
  return `episode-${episodeNumberFromSlug(episode)}`;
}

export function watchPath(anime: Anime | undefined, fallbackId: string | number, episode: string | number) {
  return `/watch/${animeSlug(anime, fallbackId)}/${episodeSlug(episode)}`;
}

export function rankAnimeForSearch(items: Anime[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return [...items].sort((a, b) => scoreSearchItem(b, normalizedQuery) - scoreSearchItem(a, normalizedQuery));
}

function scoreSearchItem(anime: Anime, query: string) {
  const title = titleOf(anime).toLowerCase();
  const english = (anime.title_en || anime.english || "").toLowerCase();
  const status = (anime.status || "").toLowerCase();
  const currentYear = new Date().getFullYear();
  const releaseYear = releaseYearOf(anime);
  let score = 0;

  if (english) score += 20;

  if (query) {
    if (english === query || title === query) score += 420;
    if (english.startsWith(query) || title.startsWith(query)) score += 250;
    if (english.includes(query) || title.includes(query)) score += 130;
  }

  if (status.includes("currently") || status.includes("airing") || status.includes("releasing")) score += 150;
  if (status.includes("not_yet") || status.includes("upcoming")) score += 95;
  if (status.includes("finished") || status.includes("complete")) score -= 24;

  if (releaseYear) {
    const age = currentYear - releaseYear;
    if (age <= 0) score += 85;
    else if (age === 1) score += 68;
    else if (age === 2) score += 45;
    else if (age <= 4) score += 24;
    else if (age >= 10) score -= 20;
  }

  score += Math.min(Number(anime.score || 0), 10);
  return score;
}

function releaseYearOf(anime: Anime) {
  if (typeof anime.year === "number" && Number.isFinite(anime.year)) return anime.year;
  if (typeof anime.start_date === "string" && anime.start_date) {
    const parsed = new Date(anime.start_date).getFullYear();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

const HISTORY_INDEX_KEY = "kairostream-history-index";
const HISTORY_ENTRY_PREFIX = "kairostream-history-";
export const HISTORY_UPDATED_EVENT = "anime-tv-history-updated";

type HistoryPointer = {
  key: string;
  mal_id: string;
  episode: string | number;
  watched_at?: string | number;
};

function readHistoryIndex() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_INDEX_KEY) || "[]");
    return Array.isArray(parsed) ? parsed as HistoryPointer[] : [];
  } catch {
    return [];
  }
}

function watchedAtMillis(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeHistoryItem(item: LibraryItem, id: string, episode: string | number): LibraryItem {
  const playbackPos = progressOf(item);
  const numericEpisode = Number(episode);
  return {
    ...item,
    mal_id: id,
    anime_id: id,
    episode: Number.isFinite(numericEpisode) ? numericEpisode : 1,
    episode_num: Number.isFinite(numericEpisode) ? numericEpisode : 1,
    playback_pos: playbackPos,
    progress: playbackPos,
    timestamp: playbackPos,
    watched_at: item.watched_at || new Date().toISOString(),
  };
}

function notifyHistoryUpdated(item?: LibraryItem) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail: item }));
}

function isHistoryStorageKey(key: string | null): key is string {
  return typeof key === "string" && key.startsWith(HISTORY_ENTRY_PREFIX) && key !== HISTORY_INDEX_KEY;
}

export function rememberProgress(item: LibraryItem) {
  const id = String(item.mal_id || item.anime_id || "");
  const episode = item.episode || item.episode_num || 1;
  if (!id || typeof window === "undefined") return;
  const key = historyKey(id, episode);
  const saved = normalizeHistoryItem(item, id, episode);
  window.localStorage.setItem(key, JSON.stringify(saved));

  const pointer: HistoryPointer = { key, mal_id: id, episode, watched_at: saved.watched_at };
  const nextIndex = [
    pointer,
    ...readHistoryIndex().filter((entry) => String(entry.mal_id) !== id),
  ].slice(0, 250);
  window.localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
  notifyHistoryUpdated(saved);
}

export function rememberedProgress(malId: string, episode: string | number) {
  if (!malId || typeof window === "undefined") return undefined;
  try {
    return JSON.parse(window.localStorage.getItem(historyKey(malId, episode)) || "") as LibraryItem;
  } catch {
    return undefined;
  }
}

export function rememberedHistory(limit = 200) {
  if (typeof window === "undefined") return [];
  const byAnime = new Map<string, LibraryItem>();

  const addByKey = (key: string, fallback?: HistoryPointer) => {
    if (!isHistoryStorageKey(key)) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || "") as LibraryItem;
      const id = String(stored.mal_id || stored.anime_id || fallback?.mal_id || "");
      const episode = stored.episode || stored.episode_num || fallback?.episode || 1;
      if (!id) return;
      const next = normalizeHistoryItem(stored, id, episode);
      const current = byAnime.get(id);
      if (!current || watchedAtMillis(next.watched_at) >= watchedAtMillis(current.watched_at)) {
        byAnime.set(id, { ...current, ...next });
      }
    } catch {
      // Ignore corrupt local history entries instead of losing the rest.
    }
  };

  readHistoryIndex().forEach((entry) => addByKey(entry.key, entry));
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (isHistoryStorageKey(key)) addByKey(key);
  }

  return Array.from(byAnime.values())
    .sort((a, b) => watchedAtMillis(b.watched_at) - watchedAtMillis(a.watched_at))
    .slice(0, limit);
}

export function clearRememberedHistory() {
  if (typeof window === "undefined") return;
  const keys = new Set(readHistoryIndex().map((entry) => entry.key));
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (isHistoryStorageKey(key)) keys.add(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.removeItem(HISTORY_INDEX_KEY);
  notifyHistoryUpdated();
}
