import type { Metadata } from "next";
import { getEpisodeMetadata, getKnownAnimeById } from "@/lib/server-anime";
import {
  animeDescription,
  animeJsonLd,
  animeKeywords,
  animePageTitle,
  breadcrumbJsonLd,
  buildPageMetadata,
  safeJsonLd,
} from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { animePath, episodeCount, idFromSlug, posterOf, titleOf, watchPath } from "@/lib/utils";

type AnimeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mal_id: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string }> }): Promise<Metadata> {
  const { mal_id: rawMalId } = await params;
  const malId = idFromSlug(rawMalId);
  const anime = await getKnownAnimeById(malId);

  const metadata = buildPageMetadata({
    title: animePageTitle(anime, malId),
    description: animeDescription(anime, malId),
    path: animePath(anime, malId),
    image: posterOf(anime),
  });
  return {
    ...metadata,
    keywords: animeKeywords(anime, malId),
    openGraph: {
      ...metadata.openGraph,
      type: "video.tv_show",
      title: animePageTitle(anime, malId),
    },
  };
}

export default async function AnimeLayout({ children, params }: AnimeLayoutProps) {
  const { mal_id: rawMalId } = await params;
  const malId = idFromSlug(rawMalId);
  const anime = await getKnownAnimeById(malId);
  const hint = episodeCount(anime);
  const episodes = await getEpisodeMetadata(malId, hint);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);

  const jsonLd = [
    animeJsonLd(anime, malId),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: title, path: animePath(anime, malId) },
    ]),
    episodes?.episodes?.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${title} episode list`,
          numberOfItems: episodes.episodes.length,
          itemListElement: episodes.episodes.slice(0, 100).map((episode, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(watchPath(anime, malId, episode.episode_number)),
            name: episode.title || `${title} Episode ${episode.episode_number}`,
          })),
        }
      : undefined,
  ].filter(Boolean);

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
