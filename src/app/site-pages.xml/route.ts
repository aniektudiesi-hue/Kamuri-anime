import { staticSitemapRoutes } from "@/lib/sitemap-data";

export const revalidate = 3600;

export async function GET() {
  const routes = staticSitemapRoutes();

  return new Response(toXml(routes), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function toXml(routes: ReturnType<typeof staticSitemapRoutes>) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((route) => {
      const lastModified =
        route.lastModified instanceof Date ? route.lastModified.toISOString() : new Date().toISOString();
      return `  <url><loc>${escapeXml(route.url)}</loc><lastmod>${lastModified}</lastmod><changefreq>${route.changeFrequency ?? "daily"}</changefreq><priority>${route.priority ?? 0.7}</priority></url>`;
    })
    .join("\n")}\n</urlset>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
