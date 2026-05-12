import type { Metadata } from "next";
import { breadcrumbJsonLd, buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

type GenreLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const genre = decodeURIComponent(name);

  return buildPageMetadata({
    title: `${genre} Anime - Browse and Watch Online`,
    description: `Browse popular ${genre} anime on ${SITE_NAME}. Find episodes, ratings, watch history, and fast streaming pages.`,
    path: `/genre/${encodeURIComponent(genre)}`,
  });
}

export default async function GenreLayout({ children, params }: GenreLayoutProps) {
  const { name } = await params;
  const genre = decodeURIComponent(name);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: genre, path: `/genre/${encodeURIComponent(genre)}` },
            ]),
          ),
        }}
      />
      {children}
    </>
  );
}
