import type { MetadataRoute } from "next";
import { getHomeAnimeCatalog } from "@/lib/server-anime";
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
    ...["privacy", "terms", "dmca"].map((path) => ({
      url: absoluteUrl(`/${path}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.2,
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

  const watchRoutes = catalog
    .map((anime) => {
      const id = animeId(anime);
      if (!id || episodeCount(anime) < 1) return null;
      return {
        url: absoluteUrl(`/watch/${id}/1`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.74,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticRoutes, ...animeRoutes, ...watchRoutes];
}
