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
  return String(anime?.mal_id ?? anime?.anime_id ?? anime?.id ?? "");
}

export function posterOf(anime: Anime | undefined, variant: "poster-xs" | "poster-sm" | "poster-md" | "poster-lg" = "poster-md") {
  return imageCdnUrl(rawPosterOf(anime), variant);
}

export function rawPosterOf(anime: Anime | undefined) {
  const jpg = anime?.images?.jpg;
  const webp = anime?.images?.webp;
  const format = String(anime?.format || "").toUpperCase();
  const useSeriesCrArt = format === "TV" || format === "ONA" || !format;
  return (
    (useSeriesCrArt ? anime?.cr_poster : "") ||
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

export function bannerOf(anime: Anime | undefined, variant: "banner-md" | "banner-sm" | "banner-lg" = "banner-lg") {
  const format = String(anime?.format || "").toUpperCase();
  const useSeriesCrArt = format === "TV" || format === "ONA" || !format;
  return imageCdnUrl(anime?.detail_banner || (useSeriesCrArt ? anime?.cr_hero : "") || anime?.cr_wide || anime?.banner || "", variant);
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

/** Relevance score for a single item against a query — exposed so the search
 *  page can rank the grid + pick the featured top-3 with the same logic. */
export function searchRelevanceScore(anime: Anime, rawQuery: string) {
  return scoreSearchItem(anime, rawQuery.trim().toLowerCase());
}

/** Just the MATCH tier (1000 exact / 700 prefix / 480 substring / 360 all-words /
 *  0 none) with no popularity noise — so the search page can sort by match quality
 *  first, then break ties by CR-mapped + shortest title (the root). */
export function searchMatchTier(anime: Anime, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;
  const hays = [
    titleOf(anime).toLowerCase(),
    (anime.title_en || anime.english || "").toLowerCase(),
    (anime.title_jp || "").toLowerCase(),
    (anime.name || "").toLowerCase(),
  ].filter(Boolean);
  const words = query.split(/\s+/).filter(Boolean);
  // Strip stop words (len < 3) for the all-words check so "eminence of shadow"
  // still matches "The Eminence in Shadow" even though "of" ≠ "in".
  const meaningful = words.filter((w) => w.length >= 3);
  // Punctuation-insensitive form so "re zero" matches "Re:Zero", "demon slayer"
  // matches "Demon Slayer: Kimetsu no Yaiba", etc. — the #1 cause of a real title
  // scoring low or missing was just a colon/dash/comma in the catalog name.
  const norm = (s: string) => s.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const nQuery = norm(query);
  let m = 0;
  for (const hay of hays) {
    if (hay === query) m = Math.max(m, 1000);
    else if (hay.startsWith(query)) m = Math.max(m, 700);
    else if (hay.includes(query)) m = Math.max(m, 480);
    const nh = norm(hay);
    if (nh === nQuery) m = Math.max(m, 1000);
    else if (nh.startsWith(nQuery)) m = Math.max(m, 700);
    else if (nh.includes(nQuery)) m = Math.max(m, 480);
    else if (meaningful.length > 0 && meaningful.every((w) => nh.includes(w))) m = Math.max(m, 360);
  }
  return m;
}

// TIERED scoring. Match quality (exact > prefix > substring > all-words) is the
// PRIMARY key and lives in bands of 360-1000; the contextual signal (CR art,
// airing, recency, popularity) is capped well under one band so it can only
// break ties WITHIN a match tier — never let a popular airing show outrank an
// exact-title hit (the old summed-score bug where "one piece"/"attack on titan"
// could be buried under a trending unrelated title).
//
// Season/part/cour/ordinal markers. A title that carries one is a SEASON variant,
// not the root series ("Attack on Titan Final Season Part 2" vs "Attack on Titan").
const SEASON_MARKER_RE = /\b(final\s+)?season\b|\b\d+(st|nd|rd|th)\s+season\b|\bpart\s*\d+\b|\bcour\s*\d+\b|\b(2nd|3rd|4th)\b|\s(ii|iii|iv|v|vi|vii)\s*$/i;
function scoreSearchItem(anime: Anime, query: string) {
  const haystacks = [
    titleOf(anime).toLowerCase(),
    (anime.title_en || anime.english || "").toLowerCase(),
    (anime.title_jp || "").toLowerCase(),
    (anime.name || "").toLowerCase(),
  ].filter(Boolean);

  let match = 0;
  if (query) {
    const words = query.split(/\s+/).filter(Boolean);
    for (const hay of haystacks) {
      if (hay === query) match = Math.max(match, 1000);
      else if (hay.startsWith(query)) match = Math.max(match, 700);
      else if (hay.includes(query)) match = Math.max(match, 480);
      else if (words.filter((w) => w.length >= 3).length > 0 && words.filter((w) => w.length >= 3).every((word) => hay.includes(word))) match = Math.max(match, 360);
    }
  }

  // Contextual tie-breakers — capped (~max 88) so they stay inside one match band.
  let ctx = 0;
  if (anime.cr_mapped) ctx += 40;
  const status = (anime.status || "").toLowerCase();
  if (status.includes("currently") || status.includes("airing") || status.includes("releasing")) ctx += 18;
  else if (status.includes("not_yet") || status.includes("upcoming")) ctx += 8;
  const releaseYear = releaseYearOf(anime);
  if (releaseYear) {
    const age = new Date().getFullYear() - releaseYear;
    if (age <= 0) ctx += 16;
    else if (age <= 2) ctx += 10;
    else if (age <= 4) ctx += 5;
  }
  ctx += Math.min(Number(anime.score || 0), 10);
  if (anime.title_en || anime.english) ctx += 2;

  // Within the SAME match tier, the root series must outrank its own season/part
  // variants. For "attack" both "Attack on Titan" and "...Final Season Part 2" are
  // prefix hits (tier 700); without this the newer Part 2 wins on recency/score and
  // the season-collapse then keeps Part 2 instead of the root. 32 reliably drops a
  // variant below its root (ctx spread is < 32) yet stays well inside one match band
  // (gaps are ≥ 120) so it never crosses tiers.
  if (SEASON_MARKER_RE.test(titleOf(anime).toLowerCase())) ctx -= 32;

  return match + ctx;
}

function releaseYearOf(anime: Anime) {
  if (typeof anime.year === "number" && Number.isFinite(anime.year)) return anime.year;
  if (typeof anime.start_date === "string" && anime.start_date) {
    const parsed = new Date(anime.start_date).getFullYear();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const ANIME_CACHE_PREFIX = "kairostream-anime-";
const ANIME_CACHE_MAX = 60;

// Fields the detail page needs to paint instantly before its live fetch lands.
// Persisting the WHOLE anime object per viewed title (unbounded) overflowed the
// localStorage quota → QuotaExceededError on the detail page. Keep it lean + capped.
const ANIME_CACHE_KEEP_KEYS: string[] = [
  "mal_id", "anime_id", "id", "title", "title_en", "title_jp", "name",
  "poster", "image", "image_url", "img_url", "cover", "thumbnail", "cr_poster",
  "banner", "cr_hero", "detail_banner", "title_logo",
  "format", "status", "score", "year", "start_date",
  "num_episodes", "episode_count", "episodes", "season_count", "genres", "studios", "overview",
];

function slimAnimeForCache(anime: Anime): Anime {
  const out: Record<string, unknown> = {};
  for (const key of ANIME_CACHE_KEEP_KEYS) {
    const value = (anime as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out as Anime;
}

function animeCacheKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(ANIME_CACHE_PREFIX)) keys.push(key);
  }
  return keys;
}

export function rememberAnime(anime: Anime | undefined) {
  const id = animeId(anime);
  if (!id || !anime || typeof window === "undefined") return;
  const key = `${ANIME_CACHE_PREFIX}${id}`;
  // Keep the paint-cache bounded so it can't grow without limit.
  const others = animeCacheKeys().filter((existing) => existing !== key);
  if (others.length >= ANIME_CACHE_MAX) {
    others.slice(0, others.length - ANIME_CACHE_MAX + 1).forEach((stale) => window.localStorage.removeItem(stale));
  }
  const value = JSON.stringify(slimAnimeForCache(anime));
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Over quota — drop the rest of the paint-cache and retry; it's only a cache.
    animeCacheKeys().filter((existing) => existing !== key).forEach((stale) => window.localStorage.removeItem(stale));
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // give up silently — a missing paint-cache entry only slows the first paint
    }
  }
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

// Only the fields the history UI actually renders. Persisting the WHOLE anime
// object (synopsis, genres, banners, studios…) per episode quickly blew past the
// ~5MB localStorage quota — QuotaExceededError on setItem. Keep this list lean.
const HISTORY_KEEP_KEYS: string[] = [
  "mal_id", "anime_id", "id", "title", "title_en", "name",
  "poster", "image", "image_url", "img_url", "cover", "thumbnail", "cr_poster",
  "format", "status", "score",
  "episode", "episode_num", "num_episodes", "episode_count", "episodes",
  "playback_pos", "progress", "timestamp", "watched_at",
];

function slimHistoryItem(item: LibraryItem): LibraryItem {
  const out: Record<string, unknown> = {};
  for (const key of HISTORY_KEEP_KEYS) {
    const value = (item as Record<string, unknown>)[key];
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out as LibraryItem;
}

function normalizeHistoryItem(item: LibraryItem, id: string, episode: string | number): LibraryItem {
  const playbackPos = progressOf(item);
  const numericEpisode = Number(episode);
  return {
    ...slimHistoryItem(item),
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

// Remove stored episode entries whose key is no longer in the (capped) index, so
// old per-episode blobs can't accumulate forever.
function pruneOrphanHistoryKeys(keepKeys: Set<string>) {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (isHistoryStorageKey(key) && !keepKeys.has(key)) toRemove.push(key);
  }
  toRemove.forEach((key) => window.localStorage.removeItem(key));
}

// setItem that survives a full quota: drop progressively more old history and
// retry, so a watch never crashes the player with QuotaExceededError.
function setItemWithQuotaGuard(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    for (const keep of [120, 40, 10, 0]) {
      const index = readHistoryIndex();
      const keepKeys = new Set(index.slice(0, keep).map((entry) => entry.key));
      keepKeys.add(key);
      pruneOrphanHistoryKeys(keepKeys);
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch {
        // still over quota — prune harder on the next pass
      }
    }
    return false;
  }
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
  if (!setItemWithQuotaGuard(key, JSON.stringify(saved))) return;

  const pointer: HistoryPointer = { key, mal_id: id, episode, watched_at: saved.watched_at };
  const nextIndex = [
    pointer,
    ...readHistoryIndex().filter((entry) => String(entry.mal_id) !== id),
  ].slice(0, 150);
  // Drop episode blobs that fell out of the capped index so storage stays bounded.
  pruneOrphanHistoryKeys(new Set(nextIndex.map((entry) => entry.key)));
  setItemWithQuotaGuard(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
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
