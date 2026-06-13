import type { Metadata } from "next";
import { getKnownAnimeById } from "@/lib/server-anime";
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
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const episodeNumbers = hint > 0 ? Array.from({ length: Math.min(hint, 100) }, (_, index) => index + 1) : [];

  const jsonLd = [
    animeJsonLd(anime, malId),
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: title, path: animePath(anime, malId) },
    ]),
    episodeNumbers.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${title} episode list`,
          numberOfItems: hint,
          itemListElement: episodeNumbers.map((episode, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(watchPath(anime, malId, episode)),
            name: `${title} Episode ${episode}`,
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
