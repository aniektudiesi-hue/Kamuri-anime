import { FAMOUS_ANIME } from "@/lib/seo-keywords";
import type { Anime } from "@/lib/types";
import { rankAnimeForSearch } from "@/lib/utils";

const SEARCH_CATALOG_KEY = "anime-tv-search-catalog-v2";
const SEARCH_CATALOG_LIMIT = 1200;

export function localSearchAnime(query: string, limit = 12): Anime[] {
  const normalized = query.trim();
  if (normalized.length < 1) return [];
  return rankAnimeForSearch([...readSearchCatalog(), ...FAMOUS_ANIME], normalized)
    .filter((anime) => matchesAnime(anime, normalized))
    .slice(0, limit);
}

export function mergeSearchResults(query: string, ...sources: Anime[][]) {
  const seen = new Set<string>();
  const merged: Anime[] = [];
  for (const source of sources) {
    for (const anime of source) {
      const id = String(anime.mal_id || anime.anime_id || anime.id || "");
      const key = id || `${anime.title || anime.name || ""}`.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(anime);
    }
  }
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
