import type { Metadata } from "next";
import type { Anime } from "@/lib/types";
import { absoluteUrl, cleanText, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { animeId, displayStatus, episodeCount, posterOf, titleOf } from "@/lib/utils";

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  index?: boolean;
}): Metadata {
  const canonical = absoluteUrl(path);
  const metaTitle = cleanText(title, SITE_NAME);
  const metaDescription = cleanText(description, SITE_DESCRIPTION);
  const imageUrl = image || absoluteUrl("/opengraph-image");

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonical,
      title: metaTitle,
      description: metaDescription,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: metaTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: [imageUrl],
    },
    robots: {
      index,
      follow: index,
      googleBot: {
        index,
        follow: index,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function animeDescription(anime: Anime | undefined, malId: string) {
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const score = anime?.score ? ` Rated ${Number(anime.score).toFixed(1)} out of 10.` : "";
  const status = anime?.status ? ` Status: ${displayStatus(anime.status)}.` : "";
  const episodes = count > 0 ? ` Stream ${count} episodes` : " Stream episodes";
  return `${episodes} of ${title === "Untitled" ? `anime ${malId}` : title} on ${SITE_NAME} with fast browsing, watch history, and smooth playback.${score}${status}`;
}

export function animeJsonLd(anime: Anime | undefined, malId: string) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const poster = posterOf(anime);
  const count = episodeCount(anime);
  const id = animeId(anime) || malId;

  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "@id": absoluteUrl(`/anime/${id}`),
    name: title,
    alternateName: anime?.title_jp || anime?.japanese || undefined,
    url: absoluteUrl(`/anime/${id}`),
    image: poster || undefined,
    numberOfEpisodes: count || undefined,
    genre: "Anime",
    inLanguage: ["ja", "en"],
    aggregateRating: anime?.score
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(anime.score).toFixed(2),
          bestRating: "10",
          worstRating: "1",
        }
      : undefined,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function safeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
