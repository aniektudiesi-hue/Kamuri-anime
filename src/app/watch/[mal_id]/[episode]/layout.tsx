import type { Metadata } from "next";
import { getEpisodeMetadata, getKnownAnimeById } from "@/lib/server-anime";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { breadcrumbJsonLd, buildPageMetadata, safeJsonLd } from "@/lib/seo";
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

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string; episode: string }> }): Promise<Metadata> {
  const { mal_id: malId, episode } = await params;
  const { anime, animeTitle, episodeTitle } = await getWatchInfo(malId, episode);

  return buildPageMetadata({
    title: `Watch ${animeTitle} Episode ${episode}`,
    description: `Watch ${episodeTitle} on ${SITE_NAME}. Enjoy fast HD anime streaming with smooth HLS playback, server switching, subtitles, and watch history.`,
    path: `/watch/${malId}/${episode}`,
    image: posterOf(anime),
  });
}

export default async function WatchLayout({ children, params }: WatchLayoutProps) {
  const { mal_id: malId, episode } = await params;
  const { anime, animeTitle, episodeTitle, episodeNumber } = await getWatchInfo(malId, episode);
  const poster = posterOf(anime);
  const path = `/watch/${malId}/${episode}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: episodeTitle,
      description: `Watch ${animeTitle} episode ${episode} on ${SITE_NAME}.`,
      thumbnailUrl: poster ? [poster] : undefined,
      url: absoluteUrl(path),
      embedUrl: absoluteUrl(path),
      episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : undefined,
      inLanguage: ["ja", "en"],
      isPartOf: {
        "@type": "TVSeries",
        name: animeTitle,
        url: absoluteUrl(`/anime/${malId}`),
      },
    },
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
