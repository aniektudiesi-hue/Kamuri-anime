import { FAMOUS_ANIME } from "@/lib/seo-keywords";
import type { Anime } from "@/lib/types";
import { rankAnimeForSearch } from "@/lib/utils";

export function localSearchAnime(query: string, limit = 12): Anime[] {
  const normalized = query.trim();
  if (normalized.length < 1) return [];
  return rankAnimeForSearch(FAMOUS_ANIME, normalized)
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
