import type { Metadata } from "next";
import { VideoEmbedPage } from "@/components/video-embed-page";
import { getKnownAnimeById } from "@/lib/server-anime";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { posterOf, titleOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mal_id: string; episode: string }>;
}): Promise<Metadata> {
  const { mal_id: malId, episode } = await params;
  const anime = await getKnownAnimeById(malId);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const poster = posterOf(anime);

  return {
    title: `${title} Episode ${episode} Player - ${SITE_NAME}`,
    description: `Embedded anime player for ${title} Episode ${episode} on ${SITE_NAME}.`,
    alternates: {
      canonical: absoluteUrl(`/watch/${malId}/${episode}`),
    },
    openGraph: {
      title: `${title} Episode ${episode}`,
      description: `Watch ${title} Episode ${episode} on ${SITE_NAME}.`,
      images: poster ? [{ url: poster }] : undefined,
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ mal_id: string; episode: string }>;
}) {
  const { mal_id: malId, episode } = await params;
  const anime = await getKnownAnimeById(malId);

  return <VideoEmbedPage malId={malId} episode={episode} anime={anime} />;
}

