import { getEpisodeMetadata, getHomeAnimeCatalog } from "@/lib/server-anime";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { animeId, episodeCount, posterOf, titleOf } from "@/lib/utils";

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
    const episodeMetadata = await getEpisodeMetadata(id, knownCount);
    const episodes = episodeMetadata?.episodes?.length
      ? episodeMetadata.episodes.map((episode) => ({
          number: episode.episode_number,
          title: episode.title || `${title} Episode ${episode.episode_number}`,
        }))
      : Array.from({ length: Math.min(knownCount, MAX_VIDEOS_PER_ANIME) }, (_, index) => ({
          number: index + 1,
          title: `${title} Episode ${index + 1}`,
        }));

    for (const episode of prioritizedVideoEpisodes(episodes, MAX_VIDEOS_PER_ANIME)) {
      if (urls.length >= MAX_TOTAL_VIDEOS) break;
      const watchUrl = absoluteUrl(`/watch/${id}/${episode.number}`);
      const playerUrl = absoluteUrl(`/embed/${id}/${episode.number}`);
      const videoTitle = `${title} Episode ${episode.number}`;
      urls.push(`  <url>
    <loc>${xmlEscape(watchUrl)}</loc>
    <video:video>
      <video:thumbnail_loc>${xmlEscape(poster)}</video:thumbnail_loc>
      <video:title>${xmlEscape(videoTitle)}</video:title>
      <video:description>${xmlEscape(`Watch ${episode.title || videoTitle} on ${SITE_NAME}. Fast anime streaming with subtitles, episode navigation, and server switching.`)}</video:description>
      <video:player_loc allow_embed="yes">${xmlEscape(playerUrl)}</video:player_loc>
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:publication_date>${new Date().toISOString()}</video:publication_date>
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
