import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SeoAnimeCard } from "@/components/seo-anime-card";
import { SidebarLayout } from "@/components/sidebar";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { getSeoCategory, getSeoCategoryAnime, type SeoCategorySlug } from "@/lib/seo-categories";
import { animeId, titleOf } from "@/lib/utils";
import { safeJsonLd } from "@/lib/seo";

export async function SeoCategoryPage({ slug }: { slug: SeoCategorySlug }) {
  const category = getSeoCategory(slug);
  const anime = await getSeoCategoryAnime(slug);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.title} on ${SITE_NAME}`,
    description: category.description,
    url: absoluteUrl(category.path),
    numberOfItems: anime.length,
    itemListElement: anime.slice(0, 24).map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: titleOf(item),
      url: absoluteUrl(`/anime/${animeId(item)}`),
    })),
  };

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-7">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
          />

          <header className="mb-7 max-w-3xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#c8223d]">
              {category.eyebrow}
            </p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              {category.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/46 sm:text-base">
              {category.intro}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Currently Airing", href: "/airing" },
                { label: "New Releases", href: "/new-releases" },
                { label: "Popular", href: "/popular" },
                { label: "Top Rated", href: "/top-rated" },
                { label: "Schedule", href: "/schedule" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    link.href === category.path
                      ? "border-[#c8223d]/45 bg-[#c8223d]/14 text-white"
                      : "border-white/[0.08] bg-[#0d1020] text-white/45 hover:border-white/[0.16] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </header>

          <section aria-label={category.sourceLabel}>
            {anime.length ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {anime.map((item, index) => (
                  <SeoAnimeCard key={`${animeId(item)}-${index}`} anime={item} priority={index < 8} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0d1020] p-8 text-center text-white/40">
                This list is being refreshed. Try again in a moment.
              </div>
            )}
          </section>

          <section className="mt-10 rounded-2xl border border-white/[0.06] bg-[#0d1020]/72 p-5">
            <h2 className="text-lg font-black text-white">Browse anime legally for search engines</h2>
            <p className="mt-2 text-sm leading-6 text-white/42">
              This page gives search engines a clear, crawlable list of anime categories, titles, posters, and internal links.
              It helps discovery without using paid backlinks, link farms, cloaking, or keyword spam.
            </p>
          </section>
        </div>
      </SidebarLayout>
    </AppShell>
  );
}
