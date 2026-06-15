import { NextRequest, NextResponse } from "next/server";
import { detectServerRegion } from "@/lib/edge-region";

export const dynamic = "force-dynamic";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToNearest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToNearest(request, context);
}

async function proxyToNearest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { region, origin } = detectServerRegion(request.headers);
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const target = safeUrl(upstreamPath + request.nextUrl.search, origin);
  if (!target) {
    return NextResponse.json({ error: "invalid backend url" }, { status: 500 });
  }

  const isGet = request.method === "GET";
  const headers = proxyHeaders(request, region);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: isGet ? undefined : await request.text(),
      cache: "no-store",
    });
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
  } catch (error) {
    return NextResponse.json(
      { error: `${region} backend failed`, upstream_body: error instanceof Error ? error.message : String(error) },
      { status: 502, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  }
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
