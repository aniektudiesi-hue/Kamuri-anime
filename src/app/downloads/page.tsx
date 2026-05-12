import type { Metadata } from "next";
import { LibraryPage } from "@/components/library-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Downloads",
  description: "Your private anime downloads on animeTv.",
  path: "/downloads",
  index: false,
});

export default function DownloadsPage() {
  return <LibraryPage kind="downloads" />;
}
