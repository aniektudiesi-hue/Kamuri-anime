import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Offline Playback",
  description: "Play an anime episode saved on this device.",
  path: "/offline",
  index: false,
});

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
