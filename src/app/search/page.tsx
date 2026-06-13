import type { Metadata } from "next";
import { SearchPageClient, type SearchInitialData } from "@/components/search-page-client";
import { fetchAniListDiscovery, resolveDiscoveryIntent } from "@/lib/anime-discovery";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: `Search Anime Online - Find Free Anime Episodes on ${SITE_NAME}`,
  description:
    `Search anime on ${SITE_NAME}. Find anime titles, new episodes, currently airing shows, top rated anime, genres, subbed anime, dubbed anime, and direct watch pages.`,
  path: "/search",
});

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const intent = resolveDiscoveryIntent(query);
  const initial = await fetchAniListDiscovery(intent, 1, "ALL", query ? 3000 : 20000).catch(() => undefined);
  const initialData: SearchInitialData | undefined = initial
    ? {
      intentKey: intent.key,
      fmtKey: "ALL",
      page: 1,
      media: initial.media,
      hasNextPage: initial.hasNextPage,
      total: initial.total,
      count: initial.count,
      facets: initial.facets,
    }
    : undefined;
  return <SearchPageClient initialData={initialData} />;
}
