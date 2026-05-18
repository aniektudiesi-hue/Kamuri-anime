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
    "A crawlable animeTVplus index for famous anime names, watch episode searches, isekai anime, top 10 anime lists, free anime episodes, and new anime releases.",
  path: "/anime-keywords",
});

export default function AnimeKeywordsPage() {
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Anime keyword index on ${SITE_NAME}`,
    description: "Famous anime names, episode watch searches, genre indexes, and top anime search paths.",
    url: absoluteUrl("/anime-keywords"),
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
              Find crawlable animeTVplus pages for famous anime names, episode-watch intent, top anime lists, genre searches,
              new anime episodes, and free anime discovery.
            </p>
          </header>

          <section className="mt-8">
            <h2 className="text-xl font-black text-white">High-intent watch anime pages</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEO_KEYWORD_PAGES.map((page) => (
                <Link key={page.slug} href={keywordPath(page.slug)} className="rounded-xl border border-white/[0.06] bg-[#0d1020] px-3 py-2 text-sm font-bold text-white/68 hover:border-[#cf2442]/35 hover:text-white">
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
                  <p className="mt-2 text-xs leading-5 text-white/42">{anime.keywords.join(" · ")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={animeLink(anime)} className="rounded-xl bg-[#cf2442] px-3 py-2 text-xs font-black text-white">
                      Details
                    </Link>
                    <Link href={animeWatchLink(anime)} className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/70">
                      Episode 1
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}
