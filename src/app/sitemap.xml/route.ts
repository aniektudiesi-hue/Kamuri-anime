import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

const SITEMAPS = [
  "/site-pages.xml",
  "/anime-sitemap.xml",
  "/watch-sitemap.xml",
  "/video-sitemap.xml",
];

export async function GET() {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAPS.map((path) => `  <sitemap><loc>${SITE_URL}${path}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}
