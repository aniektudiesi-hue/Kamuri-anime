import { cache } from "react";
import type { Anime, EpisodeResponse } from "@/lib/types";
import { animeId, listFromPayload } from "@/lib/utils";
import { fetchAnimeMetadataByMalId } from "./anime-metadata";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";
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
  const payloads = await Promise.all(HOME_PATHS.map((path) => serverRequest<unknown>(path)));
  const byId = new Map<string, Anime>();

  for (const payload of payloads) {
    for (const anime of listFromPayload<Anime>(payload)) {
      const id = animeId(anime);
      if (id && !byId.has(id)) byId.set(id, anime);
    }
  }

  return Array.from(byId.values());
});

export const getKnownAnimeById = cache(async (malId: string) => {
  const catalog = await getHomeAnimeCatalog();
  return catalog.find((anime) => animeId(anime) === malId) || fetchAnimeMetadataByMalId(malId);
});

export const getEpisodeMetadata = cache(async (malId: string, hint = 0) => {
  const suffix = hint > 0 ? `?hint=${hint}` : "";
  return serverRequest<EpisodeResponse>(`/anime/episode/${encodeURIComponent(malId)}${suffix}`, 1800);
});
