import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import {
  FAMOUS_ANIME,
  animeLink,
  animeWatchLink,
  episodeKeywordPath,
  famousAnimeBySlug,
  parseEpisodeKeywordSlug,
} from "@/lib/seo-keywords";

type PageProps = { params: Promise<{ slug: string; episode: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: animeSlug, episode: episodeSlug } = await params;
  const anime = famousAnimeBySlug(animeSlug);
  const episode = parseEpisodeKeywordSlug(episodeSlug);
  if (!anime || !episode) return {};

  return buildPageMetadata({
    title: `Watch ${anime.title} Episode ${episode} Free Online | ${SITE_NAME}`,
    description: `Watch ${anime.title} episode ${episode} free online on animeTVplus. Open the ${anime.title} episode ${episode} watch page, anime details, episode list, and related anime searches.`,
    path: episodeKeywordPath(anime, episode),
  });
}

export default async function EpisodeKeywordPage({ params }: PageProps) {
  const { slug: animeSlug, episode: episodeSlug } = await params;
  const anime = famousAnimeBySlug(animeSlug);
  const episode = parseEpisodeKeywordSlug(episodeSlug);
  if (!anime || !episode || (anime.episodes && episode > anime.episodes)) notFound();

  const related = FAMOUS_ANIME.filter((item) => item.mal_id !== anime.mal_id).slice(0, 8);
  const keywords = episodeKeywords(anime.title, episode);
  const pageUrl = absoluteUrl(episodeKeywordPath(anime, episode));

  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${anime.title} Episode ${episode}`,
    description: `Watch ${anime.title} episode ${episode} on animeTVplus with direct episode navigation and anime discovery.`,
    thumbnailUrl: anime.image_url || anime.poster || anime.banner || absoluteUrl("/opengraph-image"),
    uploadDate: new Date().toISOString(),
    embedUrl: absoluteUrl(animeWatchLink(anime, episode)),
    url: pageUrl,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Anime Keywords", item: absoluteUrl("/anime-keywords") },
      { "@type": "ListItem", position: 3, name: anime.title, item: absoluteUrl(animeLink(anime)) },
      { "@type": "ListItem", position: 4, name: `Episode ${episode}`, item: pageUrl },
    ],
  };

  return (
    <AppShell>
      <SidebarLayout>
        <main className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(videoJsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

          <header className="max-w-4xl rounded-3xl border border-white/[0.06] bg-[#0d1020]/72 p-5 sm:p-7">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">Episode search page</p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">
              Watch {anime.title} Episode {episode} Free Online
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55 sm:text-base">
              Open {anime.title} episode {episode} on animeTVplus, or jump to the full anime page for the episode list,
              related titles, watch history, and fast anime discovery.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-white/[0.07] bg-white/[0.045] px-3 py-1 text-xs font-bold text-white/64">
                  {keyword}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={animeWatchLink(anime, episode)} className="rounded-2xl bg-[#cf2442] px-5 py-3 text-sm font-black text-white">
                Watch {anime.title} Episode {episode}
              </Link>
              <Link href={animeLink(anime)} className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/74">
                {anime.title} episode list
              </Link>
            </div>
          </header>

          <section className="mt-8 grid gap-3 md:grid-cols-3">
            {[episode - 1, episode + 1, 1]
              .filter((item, index, list) => item > 0 && (!anime.episodes || item <= anime.episodes) && list.indexOf(item) === index)
              .map((nextEpisode) => (
                <Link key={nextEpisode} href={episodeKeywordPath(anime, nextEpisode)} className="rounded-2xl border border-white/[0.06] bg-[#0d1020] p-4 hover:border-[#cf2442]/35">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#cf2442]">Episode keyword</p>
                  <h2 className="mt-2 text-lg font-black text-white">
                    Watch {anime.title} Episode {nextEpisode}
                  </h2>
                  <p className="mt-2 text-sm text-white/45">Crawlable page and direct watch link.</p>
                </Link>
              ))}
          </section>

          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0d1020]/72 p-5">
            <h2 className="text-xl font-black text-white">Related anime people also search</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <Link key={item.mal_id} href={episodeKeywordPath(item, 1)} className="rounded-xl bg-white/[0.05] px-3 py-2 text-sm font-bold text-white/68 hover:text-white">
                  Watch {item.title} Episode 1
                </Link>
              ))}
            </div>
          </section>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}

function episodeKeywords(title: string, episode: number) {
  const base = [
    `watch ${title} episode ${episode} free`,
    `${title} episode ${episode}`,
    `${title} ep ${episode}`,
    `${title} episode ${episode} online`,
    `free watch ${title} episode ${episode}`,
  ];

  if (title === "One Piece") {
    return [...base, `one peice episode ${episode}`, `watch one peice episode ${episode} free`];
  }

  return base;
}
