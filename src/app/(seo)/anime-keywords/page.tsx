import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { FAMOUS_ANIME, SEO_KEYWORD_PAGES, animeLink, animeWatchLink, keywordPath } from "@/lib/seo-keywords";

export const metadata: Metadata = buildPageMetadata({
  title: `Anime Keywords Index | ${SITE_NAME}`,
  description:
    "A powerful crawlable animeTVplus index for famous anime names, episode watch searches, anime genres, top 10 anime lists, free anime episodes, and new releases.",
  path: "/anime-keywords",
});

export default function AnimeKeywordsPage() {
  const animePages = SEO_KEYWORD_PAGES.filter((page) => page.intent === "anime");
  const episodePages = SEO_KEYWORD_PAGES.filter((page) => page.intent === "episodes");
  const discoveryPages = SEO_KEYWORD_PAGES.filter((page) => page.intent === "genre" || page.intent === "top-list");

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Anime keyword index on ${SITE_NAME}`,
    description: "Famous anime names, episode watch searches, genre indexes, top anime lists, and direct watch-intent paths.",
    url: absoluteUrl("/anime-keywords"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: SEO_KEYWORD_PAGES.slice(0, 100).map((page, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: page.title,
        url: absoluteUrl(keywordPath(page.slug)),
      })),
    },
  };

  return (
    <AppShell>
      <SidebarLayout>
        <main className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }} />
          <header className="max-w-4xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">SEO index</p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">Anime Watch Keyword Index</h1>
            <p className="mt-4 text-sm leading-6 text-white/52 sm:text-base">
              A powerful crawlable map for animeTVplus: famous anime names, episode watch intent, genre searches,
              top anime lists, new anime episodes, and direct watch links. Each route uses readable headings,
              descriptive internal links, canonical metadata, and structured data so search engines can understand the site.
            </p>
            <div className="mt-5 grid gap-2 text-sm font-bold text-white/72 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
                <span className="block text-2xl font-black text-white">{SEO_KEYWORD_PAGES.length}</span>
                crawlable keyword pages
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
                <span className="block text-2xl font-black text-white">{FAMOUS_ANIME.length}</span>
                famous anime titles
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-4">
                <span className="block text-2xl font-black text-white">3</span>
                intent pages per title
              </div>
            </div>
          </header>

          <section className="mt-8">
            <h2 className="text-xl font-black text-white">High-intent anime discovery pages</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {discoveryPages.map((page) => (
                <Link key={page.slug} href={keywordPath(page.slug)} className="rounded-xl border border-white/[0.06] bg-[#0d1020] px-3 py-2 text-sm font-bold text-white/68 hover:border-[#cf2442]/35 hover:text-white">
                  {page.title}
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-black text-white">Episode watch searches</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
              These pages target direct episode intent like watch One Piece episode 1, Naruto episodes list,
              Demon Slayer episode watch, and similar title plus episode searches.
            </p>
            <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {episodePages.map((page) => (
                <Link key={page.slug} href={keywordPath(page.slug)} className="rounded-xl border border-white/[0.06] bg-[#0d1020]/75 px-3 py-2 text-sm font-bold text-white/64 hover:border-[#cf2442]/35 hover:text-white">
                  {page.title}
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-black text-white">Famous anime watch pages</h2>
            <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {animePages.map((page) => (
                <Link key={page.slug} href={keywordPath(page.slug)} className="rounded-xl border border-white/[0.06] bg-[#0d1020]/75 px-3 py-2 text-sm font-bold text-white/64 hover:border-[#cf2442]/35 hover:text-white">
                  {page.title}
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-black text-white">Famous anime title links</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {FAMOUS_ANIME.map((anime) => (
                <article key={anime.mal_id} className="rounded-2xl border border-white/[0.06] bg-[#0d1020]/78 p-4">
                  <h3 className="text-lg font-black text-white">{anime.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/42">{anime.keywords.join(" / ")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={animeLink(anime)} className="rounded-xl bg-[#cf2442] px-3 py-2 text-xs font-black text-white">
                      {anime.title} details
                    </Link>
                    <Link href={animeWatchLink(anime)} className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/70">
                      Watch episode 1
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0d1020]/72 p-5">
            <h2 className="text-xl font-black text-white">What this index helps Google crawl</h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              animeTVplus exposes clean static URLs for title searches, episode searches, and genre searches instead of relying only on
              JavaScript search results. The pages link into real anime detail routes, watch routes, schedule routes, genre pages,
              popular pages, and new release pages. This creates a stronger internal graph for queries like watch anime online,
              One Piece episode watch, top 10 isekai anime, best action anime, romance anime online, and new anime episodes.
            </p>
          </section>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}
