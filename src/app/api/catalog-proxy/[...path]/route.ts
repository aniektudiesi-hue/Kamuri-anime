import { NextRequest, NextResponse } from "next/server";
import { catalogOriginPool } from "@/lib/edge-region";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToNearest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToNearest(request, context);
}

async function proxyToNearest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { region, origins } = catalogOriginPool(request.headers);
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const isGet = request.method === "GET";
  // Read the POST body once so it can be replayed across failover attempts.
  const body = isGet ? undefined : await request.text();
  const headers = proxyHeaders(request, region);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  // POSTs only go to the geo-picked region (no duplicate writes across regions).
  const pool = isGet ? origins : origins.slice(0, 1);

  let lastStatus = 502;
  let lastBody = "";
  for (const origin of pool) {
    const target = safeUrl(upstreamPath + search, origin);
    if (!target) continue;
    try {
      const response = await fetch(target, { method: request.method, headers, body: body || undefined, cache: "no-store" });
      if (RETRYABLE_STATUS.has(response.status)) {
        lastStatus = response.status;
        lastBody = await response.text().catch(() => "");
        continue; // region down/cold — try the next
      }
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "Cache-Control": isGet && !RETRYABLE_STATUS.has(response.status) ? "public, max-age=30, stale-while-revalidate=300" : "no-store",
          "Access-Control-Allow-Origin": "*",
          "x-atv-origin": new URL(origin).origin,
          "x-atv-region": region,
        },
      });
    } catch {
      lastStatus = 502;
    }
  }
  return NextResponse.json(
    { error: `all catalog backends failed`, upstream_status: lastStatus, upstream_body: lastBody.slice(0, 200) },
    { status: 502, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
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
