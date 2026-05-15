import type { Metadata } from "next";
import { LibraryPage } from "@/components/library-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Watch History",
  description: "Your private anime watch history on animeTVplus.",
  path: "/history",
  index: false,
});

export default function HistoryPage() {
  return <LibraryPage kind="history" />;
}
