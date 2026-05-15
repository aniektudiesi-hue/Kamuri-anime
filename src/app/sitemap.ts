import type { MetadataRoute } from "next";
import { getEpisodeMetadata, getHomeAnimeCatalog } from "@/lib/server-anime";
import { SEO_CATEGORIES } from "@/lib/seo-categories";
import { absoluteUrl } from "@/lib/site";
import { animeId, episodeCount } from "@/lib/utils";

export const revalidate = 3600;

const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Isekai",
  "Mecha",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const catalog = await getHomeAnimeCatalog();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...SEO_CATEGORIES.map((category) => ({
      url: absoluteUrl(category.path),
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: category.slug === "airing" || category.slug === "new-releases" ? 0.9 : 0.84,
    })),
    {
      url: absoluteUrl("/schedule"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.82,
    },
    ...["privacy", "terms", "dmca", "licensing"].map((path) => ({
      url: absoluteUrl(`/${path}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: path === "licensing" ? 0.58 : 0.2,
    })),
    ...GENRES.map((genre) => ({
      url: absoluteUrl(`/genre/${encodeURIComponent(genre)}`),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.72,
    })),
  ];

  const animeRoutes = catalog
    .map((anime) => {
      const id = animeId(anime);
      if (!id) return null;
      return {
        url: absoluteUrl(`/anime/${id}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.86,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  const watchRoutes = (
    await Promise.all(
      catalog.map(async (anime) => {
        const id = animeId(anime);
        if (!id) return [];
        const knownCount = episodeCount(anime);
        const episodeMetadata = await getEpisodeMetadata(id, knownCount);
        const episodeNumbers = episodeMetadata?.episodes?.length
          ? episodeMetadata.episodes.map((episode) => episode.episode_number)
          : Array.from({ length: Math.min(knownCount, 36) }, (_, index) => index + 1);
        return prioritizedEpisodes(episodeNumbers, 36).map((episodeNumber) => ({
          url: absoluteUrl(`/watch/${id}/${episodeNumber}`),
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: episodeNumber === 1 ? 0.78 : 0.72,
        }));
      }),
    )
  ).flat();

  return [...staticRoutes, ...animeRoutes, ...watchRoutes];
}

function prioritizedEpisodes(episodes: number[], limit: number) {
  const normalized = [...new Set(episodes.filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  if (normalized.length <= limit) return normalized;

  const first = normalized.slice(0, Math.floor(limit * 0.7));
  const latest = normalized.slice(-Math.ceil(limit * 0.3));
  return [...new Set([...first, ...latest])].slice(0, limit);
}
