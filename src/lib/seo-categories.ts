import type { Anime } from "@/lib/types";
import { fetchAniListDiscovery, fetchJikanDiscovery, mergeAnimeSources, resolveDiscoveryIntent } from "@/lib/anime-discovery";
import { listFromPayload, rankAnimeForSearch } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

export type SeoCategorySlug = "popular" | "new-releases" | "top-rated" | "airing" | "free-anime" | "hindi-anime";

export type SeoCategory = {
  slug: SeoCategorySlug;
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  intro: string;
  sourceLabel: string;
};

export const SEO_CATEGORIES: SeoCategory[] = [
  {
    slug: "popular",
    path: "/popular",
    title: "Popular Anime",
    eyebrow: "Browse",
    description: "Explore popular anime to watch online on animeTv, with fast anime browsing, posters, ratings, and episode links.",
    intro: "Find anime people are watching right now, including high-demand TV series, long-running favorites, and trending seasonal titles.",
    sourceLabel: "Popular titles",
  },
  {
    slug: "new-releases",
    path: "/new-releases",
    title: "New Release Anime",
    eyebrow: "Fresh episodes",
    description: "Watch new release anime and recently added anime episodes online on animeTv.",
    intro: "Track fresh anime releases and recently added shows so you can jump into new episodes faster.",
    sourceLabel: "Recently added",
  },
  {
    slug: "top-rated",
    path: "/top-rated",
    title: "Top Rated Anime",
    eyebrow: "Best rated",
    description: "Browse top rated anime online with scores, episode counts, posters, and quick watch links on animeTv.",
    intro: "A focused list of highly rated anime for viewers who want strong picks instead of endless searching.",
    sourceLabel: "Highest rated",
  },
  {
    slug: "airing",
    path: "/airing",
    title: "Currently Airing Anime",
    eyebrow: "Airing now",
    description: "Find currently airing anime and ongoing seasonal releases online on animeTv.",
    intro: "Follow ongoing anime and currently airing seasonal releases, with newer shows placed ahead of older completed titles.",
    sourceLabel: "Airing anime",
  },
  {
    slug: "free-anime",
    path: "/free-anime",
    title: "Watch Free Anime Online",
    eyebrow: "Free anime",
    description:
      "Watch free anime online on animeTv with fast HD anime streaming, subbed and dubbed anime discovery, episode lists, and smooth playback.",
    intro:
      "Start with a fast, crawlable collection of popular anime, new episodes, and high-demand series for viewers who want free anime streaming without slow browsing.",
    sourceLabel: "Free anime picks",
  },
  {
    slug: "hindi-anime",
    path: "/hindi-anime",
    title: "Hindi Anime and Dubbed Anime",
    eyebrow: "Hindi and dub",
    description:
      "Find Hindi anime searches, dubbed anime-friendly titles, subbed anime, and fast anime episode pages on animeTv.",
    intro:
      "Browse anime searches around Hindi anime, dubbed anime, and easy episode discovery. Availability depends on the current stream sources and title metadata.",
    sourceLabel: "Hindi and dubbed anime discovery",
  },
];

export function getSeoCategory(slug: SeoCategorySlug) {
  return SEO_CATEGORIES.find((category) => category.slug === slug) ?? SEO_CATEGORIES[0];
}

export async function getSeoCategoryAnime(slug: SeoCategorySlug) {
  if (slug === "airing") {
    const intent = resolveDiscoveryIntent("airing");
    const [anilist, jikan, recent] = await Promise.all([
      fetchAniListDiscovery(intent, 1),
      fetchJikanDiscovery(intent, 1),
      fetchHomeList("/home/recently-added", 900),
    ]);
    return rankAnimeForSearch(mergeAnimeSources(anilist.media, jikan.media, recent), "airing").slice(0, 48);
  }

  if (slug === "free-anime") {
    const [popular, recent, topRated] = await Promise.all([
      fetchHomeList("/home/thumbnails", 1800),
      fetchHomeList("/home/recently-added", 900),
      fetchHomeList("/home/top-rated", 1800),
    ]);
    return rankAnimeForSearch(mergeAnimeSources(recent, popular, topRated), "airing").slice(0, 48);
  }

  if (slug === "hindi-anime") {
    const intent = resolveDiscoveryIntent("hindi dubbed anime");
    const [anilist, jikan, backendHindi, backendDub, recent] = await Promise.all([
      fetchAniListDiscovery(intent, 1),
      fetchJikanDiscovery(intent, 1),
      fetchHomeList("/search/hindi", 1800),
      fetchHomeList("/search/dub", 1800),
      fetchHomeList("/home/recently-added", 900),
    ]);
    return rankAnimeForSearch(
      mergeAnimeSources(backendHindi, backendDub, anilist.media, jikan.media, recent),
      "hindi dub",
    ).slice(0, 48);
  }

  const path =
    slug === "top-rated"
      ? "/home/top-rated"
      : slug === "new-releases"
        ? "/home/recently-added"
        : "/home/thumbnails";

  const list = await fetchHomeList(path, slug === "new-releases" ? 900 : 1800);
  return slug === "new-releases" ? rankAnimeForSearch(list, "airing") : list;
}

async function fetchHomeList(path: string, revalidate: number) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });
    if (!response.ok) return [];
    return listFromPayload<Anime>(await response.json());
  } catch {
    return [];
  }
}
