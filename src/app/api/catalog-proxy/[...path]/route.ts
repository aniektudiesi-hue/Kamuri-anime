import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Single backend = the 5001 season-mapping gateway. It serves the authoritative
// season mapping natively and proxies stream/sections internally — the UI never
// talks to 3058 directly.
const DEFAULT_RENDER_CATALOG_BASE = "https://animetvplus-stream-backup-india.onrender.com";
const CATALOG_API_BASE = process.env.CATALOG_API_BASE || DEFAULT_RENDER_CATALOG_BASE;
const CATALOG_DIRECT_API_BASE =
  process.env.CATALOG_DIRECT_API_BASE ||
  DEFAULT_RENDER_CATALOG_BASE;
const CLOUDFLARE_CATALOG_BASE =
  process.env.CLOUDFLARE_CATALOG_BASE ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_CATALOG_BASE ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

async function proxyCatalog(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const direct = new URL(upstreamPath, isWorkerBase(CATALOG_API_BASE) ? CATALOG_DIRECT_API_BASE : CATALOG_API_BASE);
  direct.search = request.nextUrl.search;
  const edge = new URL(upstreamPath, CLOUDFLARE_CATALOG_BASE);
  edge.search = request.nextUrl.search;

  try {
    const body = request.method === "GET" ? undefined : await request.text();
    const headers = proxyHeaders(request);
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);

    const response = await fetch(direct, {
      method: request.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
    const text = await response.text();
    if (request.method === "GET") warmEdge(edge, headers);
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": request.method === "GET"
          ? "public, max-age=30, stale-while-revalidate=300"
          : "no-store",
        "x-atv-origin": direct.origin,
      },
    });
  } catch (error) {
    try {
      const fallback = new URL(upstreamPath, CATALOG_API_BASE);
      fallback.search = request.nextUrl.search;
      const response = await fetch(fallback, {
        method: request.method,
        headers: proxyHeaders(request),
        cache: "no-store",
      });
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "Cache-Control": request.method === "GET" ? "public, max-age=30, stale-while-revalidate=300" : "no-store",
          "x-atv-origin": "fallback",
        },
      });
    } catch {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "catalog proxy failed" },
        { status: 502 },
      );
    }
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

function warmEdge(edge: URL, headers: Headers) {
  edge.searchParams.delete("__cf_cache_only");
  edge.searchParams.set("__cf_warm", "1");
  void fetch(edge, { headers, cache: "no-store" }).catch(() => undefined);
}
