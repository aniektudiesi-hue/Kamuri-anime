import { FAMOUS_ANIME } from "@/lib/seo-keywords";
import type { Anime } from "@/lib/types";
import { rankAnimeForSearch } from "@/lib/utils";

// v4: dropped stale child-season ("Season 2/3") entries cached before root-only dedup.
const SEARCH_CATALOG_KEY = "anime-tv-search-catalog-v4";
const SEARCH_CATALOG_LIMIT = 1200;

export function localSearchAnime(query: string, limit = 12): Anime[] {
  const normalized = query.trim();
  if (normalized.length < 1) return [];
  return rankAnimeForSearch(mergeSearchResults(normalized, readSearchCatalog(), FAMOUS_ANIME), normalized)
    .filter((anime) => matchesAnime(anime, normalized))
    .slice(0, limit);
}

export function mergeSearchResults(query: string, ...sources: Anime[][]) {
  const byKey = new Map<string, Anime>();
  const merged: Anime[] = [];
  for (const source of sources) {
    for (const anime of source) {
      const id = String(anime.mal_id || anime.anime_id || anime.id || "");
      const key = id || `${anime.title || anime.name || ""}`.toLowerCase();
      if (!key) continue;

      const existing = byKey.get(key);
      const next = existing ? mergeAnimeResult(existing, anime) : anime;
      byKey.set(key, next);
    }
  }
  for (const item of byKey.values()) merged.push(item);
  return rankAnimeForSearch(merged, query);
}

export function rememberSearchCatalog(items: Anime[]) {
  if (typeof window === "undefined" || !items.length) return;
  try {
    const current = readSearchCatalog();
    const merged = mergeSearchResults("", items, current).slice(0, SEARCH_CATALOG_LIMIT);
    window.localStorage.setItem(SEARCH_CATALOG_KEY, JSON.stringify(merged));
  } catch {
    // Local search cache is an optimization only.
  }
}

export function readSearchCatalog(): Anime[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEARCH_CATALOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed as Anime[] : [];
  } catch {
    return [];
  }
}

function matchesAnime(anime: Anime, query: string) {
  const needle = normalize(query);
  const haystack = [
    anime.title,
    anime.title_en,
    anime.english,
    anime.name,
    ...(Array.isArray(anime.titles) ? anime.titles.map((title) => title.title) : []),
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
    .join(" ");

  return haystack.includes(needle) || needle.split(" ").every((word) => haystack.includes(word));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mergeAnimeResult(base: Anime, incoming: Anime): Anime {
  const next: Anime = { ...base, ...incoming };
  const basePoster = firstPoster(base);
  const incomingPoster = firstPoster(incoming);

  if (!basePoster && incomingPoster) {
    next.poster = incomingPoster;
    next.image = incomingPoster;
    next.thumbnail = incomingPoster;
  }

  if (!base.title_en && incoming.title_en) next.title_en = incoming.title_en;
  if (!base.title_jp && incoming.title_jp) next.title_jp = incoming.title_jp;
  if (!base.status && incoming.status) next.status = incoming.status;
  if (!Number(base.score || 0) && Number(incoming.score || 0)) next.score = incoming.score;
  if (!Number(base.episodes || base.num_episodes || base.episode_count || 0)) {
    next.episodes = incoming.episodes;
    next.num_episodes = incoming.num_episodes;
    next.episode_count = incoming.episode_count;
  }

  return next;
}

function firstPoster(anime: Anime) {
  return (
    anime.poster ||
    anime.image ||
    anime.thumbnail ||
    anime.cover ||
    anime.image_url ||
    anime.img_url ||
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url ||
    anime.images?.jpg?.image_url ||
    ""
  );
}
