import { getHomeAnimeCatalog } from "@/lib/server-anime";
import { videoUploadDate } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { animeId, episodeCount, posterOf, titleOf, watchPath } from "@/lib/utils";

export const revalidate = 3600;

const MAX_VIDEOS_PER_ANIME = 24;
const MAX_TOTAL_VIDEOS = 4000;

export async function GET() {
  const catalog = await getHomeAnimeCatalog();
  const urls: string[] = [];

  for (const anime of catalog) {
    if (urls.length >= MAX_TOTAL_VIDEOS) break;
    const id = animeId(anime);
    if (!id) continue;

    const title = titleOf(anime) === "Untitled" ? `Anime ${id}` : titleOf(anime);
    const poster = posterOf(anime) || absoluteUrl("/opengraph-image");
    const knownCount = episodeCount(anime);
    const episodes = Array.from({ length: Math.min(knownCount, MAX_VIDEOS_PER_ANIME) }, (_, index) => ({
      number: index + 1,
      title: `${title} Episode ${index + 1}`,
    }));

    for (const episode of prioritizedVideoEpisodes(episodes, MAX_VIDEOS_PER_ANIME)) {
      if (urls.length >= MAX_TOTAL_VIDEOS) break;
      const watchUrl = absoluteUrl(watchPath(anime, id, episode.number));
      const playerUrl = absoluteUrl(`/embed/${id}/${episode.number}`);
      const videoTitle = `${title} Episode ${episode.number}`;
      const publishedAt = videoUploadDate(anime);
      const description = `Watch ${episode.title || videoTitle} on ${SITE_NAME}. Fast anime streaming with subtitles, episode navigation, server switching, and HD playback.`;
      urls.push(`  <url>
    <loc>${xmlEscape(watchUrl)}</loc>
    <lastmod>${xmlEscape(publishedAt)}</lastmod>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(poster)}</video:thumbnail_loc>
      <video:title>${xmlEscape(videoTitle)}</video:title>
      <video:description>${xmlEscape(description)}</video:description>
      <video:player_loc allow_embed="yes">${xmlEscape(playerUrl)}</video:player_loc>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:publication_date>${xmlEscape(publishedAt)}</video:publication_date>
      <video:uploader info="${xmlEscape(absoluteUrl("/licensing"))}">${xmlEscape(SITE_NAME)}</video:uploader>
      <video:live>no</video:live>
      ${videoTags(title, episode.number).map((tag) => `<video:tag>${xmlEscape(tag)}</video:tag>`).join("\n      ")}
    </video:video>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}

function prioritizedVideoEpisodes<T extends { number: number }>(episodes: T[], limit: number) {
  const normalized = [...episodes]
    .filter((episode) => Number.isFinite(episode.number) && episode.number > 0)
    .sort((a, b) => a.number - b.number);
  if (normalized.length <= limit) return normalized;

  const first = normalized.slice(0, Math.floor(limit * 0.65));
  const latest = normalized.slice(-Math.ceil(limit * 0.35));
  const byNumber = new Map<number, T>();
  for (const episode of [...first, ...latest]) byNumber.set(episode.number, episode);
  return Array.from(byNumber.values()).slice(0, limit);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function videoTags(title: string, episode: number) {
  return [
    "animeTVplus",
    "anime streaming",
    "watch anime online",
    title,
    `${title} episode ${episode}`,
  ];
}
