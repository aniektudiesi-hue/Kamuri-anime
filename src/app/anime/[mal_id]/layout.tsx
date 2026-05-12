import type { Metadata } from "next";
import { getEpisodeMetadata, getKnownAnimeById } from "@/lib/server-anime";
import {
  animeDescription,
  animeJsonLd,
  breadcrumbJsonLd,
  buildPageMetadata,
  safeJsonLd,
} from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { episodeCount, posterOf, titleOf } from "@/lib/utils";

type AnimeLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mal_id: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ mal_id: string }> }): Promise<Metadata> {
  const { mal_id: malId } = await params;
  const anime = await getKnownAnimeById(malId);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);

  return buildPageMetadata({
    title: `${title} Episodes, Details and Watch Online`,
    description: animeDescription(anime, malId),
    path: `/anime/${malId}`,
    image: posterOf(anime),
  });
}

export default async function AnimeLayout({ children, params }: AnimeLayoutProps) {
  const { mal_id: malId } = await params;
  const anime = await getKnownAnimeById(malId);
  const hint = episodeCount(anime);
  const episodes = await getEpisodeMetadata(malId, hint);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);

  const jsonLd = [
    animeJsonLd(anime, malId),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: title, path: `/anime/${malId}` },
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
            url: absoluteUrl(`/watch/${malId}/${episode.episode_number}`),
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
