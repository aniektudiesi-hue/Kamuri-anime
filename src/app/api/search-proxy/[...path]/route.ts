import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SEARCH_API_BASE =
  process.env.SEARCH_API_BASE ||
  process.env.NEXT_PUBLIC_SEARCH_API_BASE ||
  "https://animetvplus-stream-backup-india.onrender.com";
const SEARCH_DIRECT_API_BASE =
  process.env.SEARCH_DIRECT_API_BASE ||
  process.env.CATALOG_DIRECT_API_BASE ||
  "https://animetvplus-stream-backup-india.onrender.com";
const SEARCH_REMOTE_FALLBACK_API_BASE =
  process.env.SEARCH_REMOTE_FALLBACK_API_BASE ||
  process.env.CATALOG_REMOTE_FALLBACK_API_BASE ||
  "https://animetvplus-stream-backup-india.onrender.com";
const CLOUDFLARE_CATALOG_BASE =
  process.env.CLOUDFLARE_CATALOG_BASE ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_CATALOG_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

// Forwards /api/search-proxy/<path...> → SEARCH_API_BASE/<path...> (query preserved).
// Used for our enriched search/discovery and the cr-card detail payload.
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const direct = new URL(upstreamPath, isWorkerBase(SEARCH_API_BASE) ? SEARCH_DIRECT_API_BASE : SEARCH_API_BASE);
  direct.search = request.nextUrl.search;
  const edge = new URL(upstreamPath, CLOUDFLARE_CATALOG_BASE);
  edge.search = request.nextUrl.search;

  try {
    const headers = proxyHeaders(request);
    const response = await fetch(direct, {
      headers,
      cache: "no-store",
    });
    const text = await response.text();
    warmEdge(edge, headers);
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
        "x-atv-origin": direct.origin,
      },
    });
  } catch (error) {
    for (const base of fallbackBases(direct.origin, SEARCH_API_BASE, SEARCH_REMOTE_FALLBACK_API_BASE)) {
      try {
        const fallback = new URL(upstreamPath, base);
        fallback.search = request.nextUrl.search;
        const response = await fetch(fallback, {
          headers: proxyHeaders(request),
          cache: "no-store",
        });
        const text = await response.text();
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/json",
            "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
            "Access-Control-Allow-Origin": "*",
            "x-atv-origin": base,
          },
        });
      } catch {
        // Try the next fallback origin.
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "search proxy failed", items: [], has_more: false },
      { status: 502 },
    );
  }
}

function fallbackBases(primaryOrigin: string, ...bases: string[]) {
  const seen = new Set([primaryOrigin.replace(/\/$/, "")]);
  const out: string[] = [];
  for (const base of bases) {
    const normalized = base.replace(/\/$/, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function proxyHeaders(request: NextRequest) {
  const headers = new Headers({ Accept: "application/json" });
  const region = request.headers.get("x-atv-catalog-region") || request.cookies.get("atv_catalog_region")?.value;
  if (region) headers.set("x-atv-catalog-region", region);
  return headers;
}

function isWorkerBase(value: string) {
  return value.includes("workers.dev") || value.includes("anime-tv-stream-proxy");
}

function warmEdge(edge: URL, headers: Headers) {
  edge.searchParams.delete("__cf_cache_only");
  edge.searchParams.set("__cf_warm", "1");
  void fetch(edge, { headers, cache: "no-store" }).catch(() => undefined);
}
