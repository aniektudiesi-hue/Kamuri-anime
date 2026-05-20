import type { Metadata } from "next";
import { getKnownAnimeById } from "@/lib/server-anime";
import { animeKeywords, breadcrumbJsonLd, buildPageMetadata, episodeJsonLd, safeJsonLd, videoUploadDate, watchDescription, watchPageTitle } from "@/lib/seo";
import { animePath, episodeNumberFromSlug, idFromSlug, posterOf, titleOf, watchPath } from "@/lib/utils";

type WatchLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mal_id: string; episode: string }>;
};

async function getWatchInfo(malId: string, episode: string) {
  const anime = await getKnownAnimeById(malId);
  const episodeNumber = Number(episode);
  const animeTitle = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const episodeTitle = `${animeTitle} Episode ${episode}`;
  return { anime, animeTitle, episodeTitle, episodeNumber };
}

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string; episode: string }> }): Promise<Metadata> {
  const { mal_id: rawMalId, episode: rawEpisode } = await params;
  const malId = idFromSlug(rawMalId);
  const episode = episodeNumberFromSlug(rawEpisode);
  const { anime, animeTitle, episodeTitle } = await getWatchInfo(malId, episode);

  const metadata = buildPageMetadata({
    title: watchPageTitle(anime, malId, episode),
    description: watchDescription(anime, malId, episode, episodeTitle),
    path: watchPath(anime, malId, episode),
    image: posterOf(anime),
  });
  return {
    ...metadata,
    keywords: [
      ...animeKeywords(anime, malId),
      `${animeTitle} episode ${episode}`,
      `watch ${animeTitle} episode ${episode}`,
      `${animeTitle} episode ${episode} online`,
      `${episodeTitle} watch online`,
    ],
    openGraph: {
      ...metadata.openGraph,
      type: "video.episode",
      title: watchPageTitle(anime, malId, episode),
      description: watchDescription(anime, malId, episode, episodeTitle),
    },
  };
}

export default async function WatchLayout({ children, params }: WatchLayoutProps) {
  const { mal_id: rawMalId, episode: rawEpisode } = await params;
  const malId = idFromSlug(rawMalId);
  const episode = episodeNumberFromSlug(rawEpisode);
  const { anime, animeTitle, episodeTitle } = await getWatchInfo(malId, episode);
  const path = watchPath(anime, malId, episode);
  const embedPath = `/embed/${malId}/${episode}`;

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
      { name: animeTitle, path: animePath(anime, malId) },
      { name: `Episode ${episode}`, path },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <link rel="alternate" type="text/html" href={embedPath} title={`${episodeTitle} embedded player`} />
      <noscript>
        <iframe
          title={`${episodeTitle} player`}
          src={embedPath}
          width="1280"
          height="720"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </noscript>
      {children}
    </>
  );
}
