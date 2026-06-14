import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_RENDER_CATALOG_BASE = "https://animetvplus-stream-backup-india.onrender.com";
const CATALOG_API_BASE = process.env.CATALOG_API_BASE || DEFAULT_RENDER_CATALOG_BASE;
const CATALOG_DIRECT_API_BASE = process.env.CATALOG_DIRECT_API_BASE || DEFAULT_RENDER_CATALOG_BASE;
const CATALOG_REMOTE_FALLBACK_API_BASE =
  process.env.CATALOG_REMOTE_FALLBACK_API_BASE || DEFAULT_RENDER_CATALOG_BASE;
const CLOUDFLARE_CATALOG_BASE =
  process.env.CLOUDFLARE_CATALOG_BASE ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_CATALOG_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

// Origin answered but the response is unusable — try the next candidate. Stops a
// single crashed/cold origin (e.g. India render 500ing) from taking the site down.
const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

// Banned origins — skipped entirely. India's Turso is over quota and 500s on
// every query, so don't even attempt it.
const DISABLED_ORIGIN_HOSTS = new Set(["animetvplus-stream-backup-india.onrender.com"]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

async function proxyCatalog(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const isGet = request.method === "GET";
  const body = isGet ? undefined : await request.text();

  const headers = proxyHeaders(request);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  // Fast direct origin first, then the reliable worker (geo-routes + fails over),
  // then extra fallbacks. POSTs only go to the direct origin + worker (no blind
  // duplicate writes across many origins).
  const primary = isWorkerBase(CATALOG_API_BASE) ? CATALOG_DIRECT_API_BASE : CATALOG_API_BASE;
  const candidates = dedupeBases(
    isGet
      ? [primary, CLOUDFLARE_CATALOG_BASE, CATALOG_REMOTE_FALLBACK_API_BASE, CATALOG_API_BASE]
      : [primary, CLOUDFLARE_CATALOG_BASE],
  );

  let lastStatus = 502;
  let lastBody = "";
  let warmed = false;
  for (const base of candidates) {
    const target = safeUrl(upstreamPath + search, base);
    if (!target) continue;
    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      if (isGet && !warmed && !isWorkerBase(base)) {
        warmed = true;
        warmEdge(safeUrl(upstreamPath + search, CLOUDFLARE_CATALOG_BASE), headers);
      }
      if (RETRYABLE_STATUS.has(response.status)) {
        lastStatus = response.status;
        lastBody = await response.text().catch(() => "");
        continue;
      }
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "Cache-Control": isGet ? "public, max-age=30, stale-while-revalidate=300" : "no-store",
          "Access-Control-Allow-Origin": "*",
          "x-atv-origin": new URL(base).origin,
        },
      });
    } catch {
      lastStatus = 502;
    }
  }

  return NextResponse.json(
    { error: "all catalog origins failed", upstream_status: lastStatus, upstream_body: lastBody.slice(0, 200) },
    { status: 502, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

function dedupeBases(bases: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bases) {
    const base = normalizeBase(raw);
    if (!base || seen.has(base)) continue;
    try {
      if (DISABLED_ORIGIN_HOSTS.has(new URL(base).host)) continue;
    } catch {
      continue;
    }
    seen.add(base);
    out.push(base);
  }
  return out;
}

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
