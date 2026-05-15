import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET() {
  const now = new Date().toISOString();
  const sitemaps = [
    absoluteUrl("/site-pages.xml"),
    absoluteUrl("/anime-sitemap.xml"),
    absoluteUrl("/watch-sitemap.xml"),
    absoluteUrl("/video-sitemap.xml"),
  ];

  return new Response(toSitemapIndex(sitemaps, now), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function toSitemapIndex(urls: string[], lastModified: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <sitemap><loc>${escapeXml(url)}</loc><lastmod>${lastModified}</lastmod></sitemap>`)
    .join("\n")}\n</sitemapindex>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
