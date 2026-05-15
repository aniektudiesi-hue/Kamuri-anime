import type { Metadata } from "next";
import { LibraryPage } from "@/components/library-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Watchlist",
  description: "Your private anime watchlist on animeTVplus.",
  path: "/watchlist",
  index: false,
});

export default function WatchlistPage() {
  return <LibraryPage kind="watchlist" />;
}
