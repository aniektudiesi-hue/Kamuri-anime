import { episodeKeywordRoutesForSitemapPart } from "@/lib/seo-keywords";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function GET() {
  const now = new Date().toISOString();
  const urls = episodeKeywordRoutesForSitemapPart(2).map((route) => absoluteUrl(route.path));

  return new Response(toXml(urls, now), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow",
    },
  });
}

function toXml(urls: string[], lastModified: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastModified}</lastmod><changefreq>weekly</changefreq><priority>0.68</priority></url>`)
    .join("\n")}\n</urlset>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
