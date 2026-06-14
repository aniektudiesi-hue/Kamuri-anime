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

// Origin returned a response but it's unusable — move on to the next candidate.
// (A single crashed/cold origin — e.g. the India render service 500ing — must
// never take the site down when a healthy origin/worker is available.)
const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

// Forwards /api/search-proxy/<path...> → upstream/<path...> (query preserved).
// Used for our enriched search/discovery and the cr-card detail payload.
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const headers = proxyHeaders(request);

  // Try the fast direct origin first, then the reliable Cloudflare worker (which
  // geo-routes + fails over across all regional origins), then any extra
  // fallbacks. The worker is ALWAYS in the list, so one bad origin can't 500 the
  // whole site.
  const primary = isWorkerBase(SEARCH_API_BASE) ? SEARCH_DIRECT_API_BASE : SEARCH_API_BASE;
  const candidates = dedupeBases([primary, CLOUDFLARE_CATALOG_BASE, SEARCH_REMOTE_FALLBACK_API_BASE, SEARCH_API_BASE]);

  let lastStatus = 502;
  let lastBody = "";
  let warmed = false;
  for (const base of candidates) {
    const target = safeUrl(upstreamPath + search, base);
    if (!target) continue;
    try {
      const response = await fetch(target, { headers, cache: "no-store" });
      // Warm the worker edge cache once (async, non-blocking) for next time.
      if (!warmed && !isWorkerBase(base)) {
        warmed = true;
        warmEdge(safeUrl(upstreamPath + search, CLOUDFLARE_CATALOG_BASE), headers);
      }
      if (RETRYABLE_STATUS.has(response.status)) {
        lastStatus = response.status;
        lastBody = await response.text().catch(() => "");
        continue; // crashed/cold origin — try the next candidate
      }
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
          "Access-Control-Allow-Origin": "*",
          "x-atv-origin": new URL(base).origin,
        },
      });
    } catch {
      lastStatus = 502;
      // network/abort — try the next candidate
    }
  }

  return NextResponse.json(
    { error: "all search origins failed", upstream_status: lastStatus, upstream_body: lastBody.slice(0, 200), items: [], has_more: false },
    { status: 502, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

function dedupeBases(bases: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bases) {
    const base = normalizeBase(raw);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}

// Ensure a base is an absolute https URL so `new URL(path, base)` never throws.
function normalizeBase(value: string | undefined) {
  if (!value) return "";
  let v = value.trim().replace(/\/$/, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    return new URL(v).origin;
  } catch {
    return "";
  }
}

function safeUrl(pathWithSearch: string, base: string): URL | null {
  try {
    return new URL(pathWithSearch, base);
  } catch {
    return null;
  }
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

function warmEdge(edge: URL | null, headers: Headers) {
  if (!edge) return;
  edge.searchParams.delete("__cf_cache_only");
  edge.searchParams.set("__cf_warm", "1");
  void fetch(edge, { headers, cache: "no-store" }).catch(() => undefined);
}
