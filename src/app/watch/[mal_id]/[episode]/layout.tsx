import type { Metadata } from "next";
import { getEpisodeMetadata, getKnownAnimeById } from "@/lib/server-anime";
import { animeKeywords, breadcrumbJsonLd, buildPageMetadata, episodeJsonLd, safeJsonLd, watchDescription, watchPageTitle } from "@/lib/seo";
import { episodeCount, posterOf, titleOf } from "@/lib/utils";

type WatchLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mal_id: string; episode: string }>;
};

async function getWatchInfo(malId: string, episode: string) {
  const anime = await getKnownAnimeById(malId);
  const episodes = await getEpisodeMetadata(malId, episodeCount(anime));
  const episodeNumber = Number(episode);
  const episodeInfo = episodes?.episodes?.find((item) => item.episode_number === episodeNumber);
  const animeTitle = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const episodeTitle = episodeInfo?.title || `${animeTitle} Episode ${episode}`;
  return { anime, animeTitle, episodeTitle, episodeNumber };
}

function videoUploadDate(anime: Awaited<ReturnType<typeof getKnownAnimeById>>) {
  if (anime?.start_date) {
    const parsed = new Date(anime.start_date);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  const year = Number(anime?.year);
  if (Number.isFinite(year) && year > 1900) {
    return new Date(Date.UTC(year, 0, 1)).toISOString();
  }

  return "2026-05-01T00:00:00.000Z";
}

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string; episode: string }> }): Promise<Metadata> {
  const { mal_id: malId, episode } = await params;
  const { anime, animeTitle, episodeTitle } = await getWatchInfo(malId, episode);

  const metadata = buildPageMetadata({
    title: watchPageTitle(anime, malId, episode),
    description: watchDescription(anime, malId, episode, episodeTitle),
    path: `/watch/${malId}/${episode}`,
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
  const { mal_id: malId, episode } = await params;
  const { anime, animeTitle, episodeTitle } = await getWatchInfo(malId, episode);
  const path = `/watch/${malId}/${episode}`;

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
      { name: animeTitle, path: `/anime/${malId}` },
      { name: `Episode ${episode}`, path },
    ]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {children}
    </>
  );
}
