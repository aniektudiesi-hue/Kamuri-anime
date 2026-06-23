import { NextRequest, NextResponse } from "next/server";
import { catalogOriginPool } from "@/lib/edge-region";

export const dynamic = "force-dynamic";
// Run at the Vercel edge so requests are handled in the PoP nearest to the
// viewer instead of a single US-East serverless region.  Eliminates the
// cross-continent hop that was the main search latency driver.
export const runtime = "edge";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { region, origins } = catalogOriginPool(request.headers);
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const headers = proxyHeaders(request, region);

  let lastStatus = 502;
  let lastBody = "";
  // The region origins all currently resolve to the same Cloudflare worker, so
  // iterating origins alone gives no real fallback — one transient 502/504 from
  // the worker (cold Turso path) would fail the whole request. Retry each origin
  // a couple of times with a short backoff so those blips self-heal instead of
  // surfacing as "search failed / takes forever then errors".
  const ATTEMPTS_PER_ORIGIN = 3;
  for (const origin of origins) {
    const target = safeUrl(upstreamPath + search, origin);
    if (!target) continue;
    for (let attempt = 0; attempt < ATTEMPTS_PER_ORIGIN; attempt += 1) {
      try {
        const response = await fetch(target, { headers, cache: "no-store" });
        if (RETRYABLE_STATUS.has(response.status)) {
          lastStatus = response.status;
          lastBody = await response.text().catch(() => "");
          if (attempt < ATTEMPTS_PER_ORIGIN - 1) await delay(200 * (attempt + 1));
          continue;
        }
        const text = await response.text();
        return new NextResponse(text, {
          status: response.status,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/json",
            "Cache-Control": !RETRYABLE_STATUS.has(response.status) ? "public, max-age=30, stale-while-revalidate=300" : "no-store",
            "Access-Control-Allow-Origin": "*",
            "x-atv-origin": new URL(origin).origin,
            "x-atv-region": region,
          },
        });
      } catch {
        lastStatus = 502;
        if (attempt < ATTEMPTS_PER_ORIGIN - 1) await delay(200 * (attempt + 1));
      }
    }
  }
  return NextResponse.json(
    { error: "all search backends failed", upstream_status: lastStatus, upstream_body: lastBody.slice(0, 200), items: [], has_more: false },
    { status: 502, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(pathWithSearch: string, base: string): URL | null {
  try {
    return new URL(pathWithSearch, base);
  } catch {
    return null;
  }
}

function proxyHeaders(request: NextRequest, region: string) {
  const headers = new Headers({ Accept: "application/json" });
  headers.set("x-atv-catalog-region", region);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return headers;
}
