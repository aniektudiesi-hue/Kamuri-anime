import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import {
  FAMOUS_ANIME,
  SEO_KEYWORD_PAGES,
  animeLink,
  animeWatchLink,
  famousAnimeByTitle,
  keywordPageBySlug,
  keywordPath,
} from "@/lib/seo-keywords";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SEO_KEYWORD_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = keywordPageBySlug(slug);
  if (!page) return {};
  return buildPageMetadata({
    title: `${page.title} | ${SITE_NAME}`,
    description: page.description,
    path: keywordPath(page.slug),
  });
}

export default async function WatchAnimeKeywordPage({ params }: PageProps) {
  const { slug } = await params;
  const page = keywordPageBySlug(slug);
  if (!page) notFound();

  const featured = page.animeTitles
    .map((title) => famousAnimeByTitle(title))
    .filter(Boolean);
  const related = FAMOUS_ANIME.filter((anime) => !featured.some((item) => item?.mal_id === anime.mal_id)).slice(0, 10);
  const allAnime = [...featured, ...related].slice(0, page.intent === "top-list" ? 12 : 8);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${page.h1} on ${SITE_NAME}`,
    description: page.description,
    url: absoluteUrl(keywordPath(page.slug)),
    itemListElement: allAnime.map((anime, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: anime?.title,
      url: anime ? absoluteUrl(animeLink(anime)) : undefined,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Anime Keywords", item: absoluteUrl("/anime-keywords") },
      { "@type": "ListItem", position: 3, name: page.h1, item: absoluteUrl(keywordPath(page.slug)) },
    ],
  };

  return (
    <AppShell>
      <SidebarLayout>
        <main className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

          <header className="max-w-4xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">
              Anime search index
            </p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">{page.h1}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55 sm:text-base">{page.intro}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {page.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-white/[0.07] bg-white/[0.045] px-3 py-1 text-xs font-bold text-white/62">
                  {keyword}
                </span>
              ))}
            </div>
          </header>

          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Direct anime watch links">
            {allAnime.map((anime, index) => anime ? (
              <article key={`${anime.mal_id}-${index}`} className="rounded-2xl border border-white/[0.07] bg-[#0d1020] p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#cf2442]">Anime page</p>
                <h2 className="mt-2 text-xl font-black text-white">{anime.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  Open the {anime.title} anime page, episode list, and direct episode watch route on animeTVplus.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={animeLink(anime)} className="rounded-xl bg-[#cf2442] px-3 py-2 text-xs font-black text-white">
                    {anime.title} details
                  </Link>
                  <Link href={animeWatchLink(anime)} className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/75 hover:text-white">
                    Watch episode 1
                  </Link>
                </div>
              </article>
            ) : null)}
          </section>

          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0d1020]/72 p-5">
            <h2 className="text-lg font-black text-white">Related anime searches</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(page.genreLinks ?? []).map((genre) => (
                <Link key={genre} href={`/genre/${encodeURIComponent(genre)}`} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/68 hover:text-white">
                  Watch {genre} anime
                </Link>
              ))}
              {(page.categoryLinks ?? [
                { label: "Popular Anime", href: "/popular" },
                { label: "Top Rated Anime", href: "/top-rated" },
                { label: "New Episodes", href: "/new-releases" },
                { label: "Airing Anime", href: "/airing" },
              ]).map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white/68 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/42">
              These pages are built as readable anime discovery indexes with clear internal links, canonical metadata,
              structured data, and crawlable title routes for search engines.
            </p>
          </section>

          <nav className="mt-8" aria-label="More anime keyword pages">
            <h2 className="text-lg font-black text-white">More keyword indexes</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SEO_KEYWORD_PAGES.filter((item) => item.slug !== page.slug).slice(0, 12).map((item) => (
                <Link key={item.slug} href={keywordPath(item.slug)} className="rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-sm font-bold text-white/62 hover:border-[#cf2442]/35 hover:text-white">
                  {item.title}
                </Link>
              ))}
            </div>
          </nav>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}
