import type { Metadata } from "next";
import { SearchPageClient } from "@/components/search-page-client";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: `Search Anime Online - Find Free Anime Episodes on ${SITE_NAME}`,
  description:
    `Search anime on ${SITE_NAME}. Find anime titles, new episodes, currently airing shows, top rated anime, genres, subbed anime, dubbed anime, and direct watch pages.`,
  path: "/search",
});

export default function SearchPage() {
  return <SearchPageClient />;
}
