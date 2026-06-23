import type { Metadata } from "next";
import { BrowsePageClient } from "@/components/browse-page-client";
import { fetchCatalogSection } from "@/lib/catalog-api";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Browse Anime",
  description: "Browse all anime titles, movies, OVA, ONA, genres, and simulcasts on animeTVplus.",
  path: "/browse",
});

export default async function BrowsePage() {
  const initialItems = await fetchCatalogSection("/api/search", 12, 1, 60);
  return <BrowsePageClient initialItems={initialItems} />;
}
