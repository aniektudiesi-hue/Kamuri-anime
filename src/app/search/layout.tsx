import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Search Anime",
  description: `Search anime titles, episodes, and ratings on ${SITE_NAME}.`,
  path: "/search",
  index: false,
});

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
