import type { Metadata } from "next";
import { getKnownAnimeById } from "@/lib/server-anime";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  episodeJsonLd,
  safeJsonLd,
  videoUploadDate,
  watchDescription,
  watchPageTitle,
} from "@/lib/seo";
import { animePath, episodeNumberFromSlug, idFromSlug, posterOf, titleOf, watchPath } from "@/lib/utils";

type WatchLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mal_id: string; episode: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string; episode: string }> }): Promise<Metadata> {
  const { mal_id: rawMalId, episode: rawEpisode } = await params;
  const malId = idFromSlug(rawMalId);
  const episode = episodeNumberFromSlug(rawEpisode);
  const anime = await getKnownAnimeById(malId);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const episodeTitle = `${title} Episode ${episode}`;

  return buildPageMetadata({
    title: watchPageTitle(anime, malId, episode),
    description: watchDescription(anime, malId, episode, episodeTitle),
    path: watchPath(anime, malId, episode),
    image: posterOf(anime),
    keywords: [
      `${title} episode ${episode}`,
      `watch ${title} episode ${episode}`,
      `${title} ep ${episode}`,
      `${title} anime episode ${episode}`,
      `watch ${title} online`,
      `${title} episodes`,
      "watch anime episode online",
      "subbed anime episode",
      "dubbed anime episode",
    ],
  });
}

export default async function WatchLayout({ children, params }: WatchLayoutProps) {
  const { mal_id: rawMalId, episode: rawEpisode } = await params;
  const malId = idFromSlug(rawMalId);
  const episode = episodeNumberFromSlug(rawEpisode);
  const anime = await getKnownAnimeById(malId);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const episodeTitle = `${title} Episode ${episode}`;

  const jsonLd = [
    ...episodeJsonLd({
      anime,
      malId,
      episode,
      episodeTitle,
      uploadDate: videoUploadDate(anime),
    }),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: title, path: animePath(anime, malId) },
      { name: `Episode ${episode}`, path: watchPath(anime, malId, episode) },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {children}
    </>
  );
}
