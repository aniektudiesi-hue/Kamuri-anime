import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildPageMetadata, breadcrumbJsonLd, genreDescription, genreKeywords, genreTitle, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, cleanText } from "@/lib/site";

type GenreLayoutProps = {
  children: ReactNode;
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const genre = cleanText(decodeURIComponent(name), "Anime");

  return {
    ...buildPageMetadata({
      title: genreTitle(genre),
      description: genreDescription(genre),
      path: `/genre/${encodeURIComponent(genre)}`,
    }),
    keywords: genreKeywords(genre),
    openGraph: {
      ...buildPageMetadata({
        title: genreTitle(genre),
        description: genreDescription(genre),
        path: `/genre/${encodeURIComponent(genre)}`,
      }).openGraph,
      type: "website",
    },
  };
}

export default async function GenreLayout({ children, params }: GenreLayoutProps) {
  const { name } = await params;
  const genre = cleanText(decodeURIComponent(name), "Anime");
  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Genres", path: "/free-anime" },
      { name: genre, path: `/genre/${encodeURIComponent(genre)}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: genreTitle(genre),
      description: genreDescription(genre),
      url: absoluteUrl(`/genre/${encodeURIComponent(genre)}`),
      about: `${genre} anime`,
      isPartOf: {
        "@type": "WebSite",
        name: "animeTVplus",
        url: absoluteUrl("/"),
      },
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {children}
    </>
  );
}
