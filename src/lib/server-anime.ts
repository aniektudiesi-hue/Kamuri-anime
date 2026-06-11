import { cache } from "react";
import type { Anime, EpisodeResponse } from "@/lib/types";
import { animeId } from "@/lib/utils";
import { fetchAnimeMetadataByMalId } from "./anime-metadata";
import { catalogServerGet, fetchCatalogSection, mapCatalogAnime } from "./catalog-api";

const API_BASE = process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL || "https://anime-tv-stream-proxy.kamuri-anime.workers.dev";
const HOME_PATHS = ["/api/v1/banners", "/home/thumbnails", "/home/recently-added", "/home/top-rated"];

async function serverRequest<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const getHomeAnimeCatalog = cache(async () => {
  const payloads = await Promise.all([
    fetchCatalogSection("/api/anime/database", 100, 1, 300),
    fetchCatalogSection("/api/anime/top-rated", 100, 1, 300),
    fetchCatalogSection("/api/anime/airing", 100, 1, 300),
  ]);
  const byId = new Map<string, Anime>();

  for (const payload of payloads) {
    for (const anime of payload) {
      const id = animeId(anime);
      if (id && !byId.has(id)) byId.set(id, anime);
    }
  }

  return Array.from(byId.values());
});

export const getKnownAnimeById = cache(async (malId: string) => {
  const catalog = await getHomeAnimeCatalog();
  const known = catalog.find((anime) => animeId(anime) === malId);
  if (known) return known;
  const payload = await catalogServerGet<{ anime?: Record<string, unknown> }>(`/api/streams/${encodeURIComponent(malId)}`, 300);
  if (payload?.anime) return mapCatalogAnime(payload.anime as Parameters<typeof mapCatalogAnime>[0]);
  return fetchAnimeMetadataByMalId(malId);
});

export const getEpisodeMetadata = cache(async (malId: string, hint = 0) => {
  void hint;
  const payload = await catalogServerGet<{ streams?: Array<{ episode?: number }> }>(`/api/streams/${encodeURIComponent(malId)}`, 300);
  const episodes = Array.from(new Set((payload?.streams ?? []).map((item) => Number(item.episode || 0)).filter(Boolean)))
    .sort((a, b) => a - b)
    .map((episode) => ({ episode_number: episode, title: `Episode ${episode}` }));
  return {
    anime_id: malId,
    num_episodes: episodes.length,
    episodes,
    source: "animeTVplus catalog",
  } satisfies EpisodeResponse;
});
