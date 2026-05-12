import type { MetadataRoute } from "next";
import { getHomeAnimeCatalog } from "@/lib/server-anime";
import { absoluteUrl } from "@/lib/site";
import { animeId, posterOf } from "@/lib/utils";

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
      const poster = posterOf(anime);
      return {
        url: absoluteUrl(`/anime/${id}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.86,
        images: poster ? [poster] : undefined,
      };
    })
    .filter(Boolean) as MetadataRoute.Sitemap;

  return [...staticRoutes, ...animeRoutes];
}
