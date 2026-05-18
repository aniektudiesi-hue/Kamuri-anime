import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: `animetvplus Official Website - animeTVplus Anime Streaming`,
  description:
    "animetvplus official website for animeTVplus. Find anime search, popular anime, new releases, top rated anime, schedules, watch history, watchlists, and secure anime streaming pages.",
  path: "/animetvplus",
});

const links = [
  { label: "Search Anime", href: "/search", description: "Search anime titles, episodes, ratings, genres, and direct watch pages." },
  { label: "Popular Anime", href: "/popular", description: "Browse popular anime pages and fast anime discovery rows." },
  { label: "New Anime Releases", href: "/new-releases", description: "Find new anime episodes and fresh seasonal releases." },
  { label: "Top Rated Anime", href: "/top-rated", description: "Open top rated anime pages and highly rated title lists." },
  { label: "Anime Schedule", href: "/schedule", description: "Track monthly anime release schedule and airing times." },
  { label: "Anime Keyword Index", href: "/anime-keywords", description: "Explore crawlable anime keywords, famous titles, and episode pages." },
  { label: "Watch Free Anime", href: "/free-anime", description: "Find free anime discovery pages and direct watch routes." },
  { label: "animeTVplus Licensing", href: "/licensing", description: "Read animeTVplus access, policy, and licensing information." },
];

export default function AnimeTvPlusOfficialPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "animetvplus official website",
    alternateName: ["animeTVplus", "anime tv plus", "animetv plus", "anime tvplus"],
    url: absoluteUrl("/animetvplus"),
    description: SITE_DESCRIPTION,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      name: "animeTVplus official pages",
      itemListElement: links.map((link, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: link.label,
        url: absoluteUrl(link.href),
      })),
    },
  };

  return (
    <AppShell>
      <SidebarLayout>
        <main className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
          <header className="max-w-4xl rounded-3xl border border-white/[0.06] bg-[#0d1020]/72 p-5 sm:p-7">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">Official brand page</p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">
              animetvplus Official Website
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
              animeTVplus, also searched as animetvplus, animetv plus, anime tv plus, and anime tvplus, is the official
              anime streaming and discovery site at animetvplus.xyz. Use this page to reach search, popular anime,
              schedules, top rated anime, new releases, watch history, watchlists, and anime keyword pages.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className="rounded-2xl bg-[#cf2442] px-5 py-3 text-sm font-black text-white">
                Open animeTVplus
              </Link>
              <Link href="/search" className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/74">
                Search anime
              </Link>
            </div>
          </header>

          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-2xl border border-white/[0.06] bg-[#0d1020] p-4 hover:border-[#cf2442]/35">
                <h2 className="text-lg font-black text-white">{link.label}</h2>
                <p className="mt-2 text-sm leading-6 text-white/48">{link.description}</p>
              </Link>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-white/[0.06] bg-[#0d1020]/72 p-5">
            <h2 className="text-xl font-black text-white">Search names for animeTVplus</h2>
            <p className="mt-3 text-sm leading-6 text-white/52">
              This page helps search engines connect the brand names animetvplus, animeTVplus, anime tv plus, animetv plus,
              anime tvplus, and animetvplus.xyz with the official homepage and important internal pages.
            </p>
          </section>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}
