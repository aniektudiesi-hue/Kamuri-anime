import type { Metadata } from "next";
import type { Anime } from "@/lib/types";
import { absoluteUrl, cleanText, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from "@/lib/site";
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
    keywords: SITE_KEYWORDS,
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
  return `${episodes} of ${title === "Untitled" ? `anime ${malId}` : title} on ${SITE_NAME} with free anime discovery, fast browsing, watch history, subtitles, and smooth HD playback.${score}${status}`;
}

export function animePageTitle(anime: Anime | undefined, malId: string) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const count = episodeCount(anime);
  const episodeText = count > 0 ? `${count} Episodes` : "Episodes";
  return `${title} ${episodeText} - Watch Online on ${SITE_NAME}`;
}

export function animeKeywords(anime: Anime | undefined, malId: string) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const cleanTitle = cleanText(title, `Anime ${malId}`);
  return [
    ...SITE_KEYWORDS,
    cleanTitle,
    `${cleanTitle} anime`,
    `watch ${cleanTitle} online`,
    `watch ${cleanTitle} free`,
    `${cleanTitle} episodes`,
    `${cleanTitle} episode list`,
    `${cleanTitle} streaming`,
    `${cleanTitle} subbed`,
    `${cleanTitle} dubbed`,
    `${cleanTitle} animeTv`,
    `${cleanTitle} animetvplus`,
  ];
}

export function watchPageTitle(anime: Anime | undefined, malId: string, episode: string | number) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  return `Watch ${title} Episode ${episode} Online - ${SITE_NAME}`;
}

export function watchDescription(anime: Anime | undefined, malId: string, episode: string | number, episodeTitle?: string) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const label = episodeTitle && !episodeTitle.toLowerCase().includes("episode")
    ? `${title} Episode ${episode}: ${episodeTitle}`
    : `${title} Episode ${episode}`;
  return `Watch ${label} online on ${SITE_NAME}. Stream the episode with fast loading, subtitles, server switching, watch history, and smooth HD HLS playback.`;
}

export function genreTitle(name: string) {
  const genre = cleanText(decodeURIComponent(name), "Anime");
  return `${genre} Anime - Watch Popular ${genre} Shows on ${SITE_NAME}`;
}

export function genreDescription(name: string) {
  const genre = cleanText(decodeURIComponent(name), "anime");
  return `Explore popular ${genre} anime on ${SITE_NAME}. Find currently airing titles, new episodes, top rated shows, episode lists, and fast anime streaming pages in one clean catalog.`;
}

export function genreKeywords(name: string) {
  const genre = cleanText(decodeURIComponent(name), "anime");
  return [
    ...SITE_KEYWORDS,
    `${genre} anime`,
    `best ${genre} anime`,
    `watch ${genre} anime online`,
    `popular ${genre} anime`,
    `${genre} anime episodes`,
    `${genre} anime streaming`,
    `new ${genre} anime`,
    `top rated ${genre} anime`,
  ];
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
    potentialAction: {
      "@type": "WatchAction",
      target: absoluteUrl(count > 0 ? `/watch/${id}/1` : `/anime/${id}`),
      name: `Watch ${title} online`,
    },
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

export function episodeJsonLd({
  anime,
  malId,
  episode,
  episodeTitle,
  uploadDate,
}: {
  anime: Anime | undefined;
  malId: string;
  episode: string | number;
  episodeTitle: string;
  uploadDate: string;
}) {
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const poster = posterOf(anime);
  const path = `/watch/${malId}/${episode}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: episodeTitle,
      description: watchDescription(anime, malId, episode, episodeTitle),
      thumbnailUrl: poster ? [poster] : [absoluteUrl("/opengraph-image")],
      uploadDate,
      url: absoluteUrl(path),
      embedUrl: absoluteUrl(path),
      isFamilyFriendly: true,
      inLanguage: ["ja", "en"],
      potentialAction: [
        {
          "@type": "WatchAction",
          target: absoluteUrl(path),
          name: `Watch ${episodeTitle}`,
        },
        {
          "@type": "SeekToAction",
          target: `${absoluteUrl(path)}?t={seek_to_second_number}`,
          "startOffset-input": "required name=seek_to_second_number",
        },
      ],
      isPartOf: {
        "@type": "TVSeries",
        name: title,
        url: absoluteUrl(`/anime/${malId}`),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "TVEpisode",
      name: episodeTitle,
      episodeNumber: Number(episode) || undefined,
      url: absoluteUrl(path),
      image: poster || undefined,
      partOfSeries: {
        "@type": "TVSeries",
        name: title,
        url: absoluteUrl(`/anime/${malId}`),
      },
      potentialAction: {
        "@type": "WatchAction",
        target: absoluteUrl(path),
      },
    },
  ];
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
