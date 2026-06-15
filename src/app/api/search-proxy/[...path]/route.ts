import { NextRequest, NextResponse } from "next/server";
import { catalogOriginPool } from "@/lib/edge-region";

export const dynamic = "force-dynamic";

const RETRYABLE_STATUS = new Set([500, 502, 503, 504, 521, 522, 523, 524, 525, 526]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { region, origins } = catalogOriginPool(request.headers);
  const { path } = await context.params;
  const upstreamPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const headers = proxyHeaders(request, region);

  let lastStatus = 502;
  let lastBody = "";
  for (const origin of origins) {
    const target = safeUrl(upstreamPath + search, origin);
    if (!target) continue;
    try {
      const response = await fetch(target, { headers, cache: "no-store" });
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
          "Cache-Control": !RETRYABLE_STATUS.has(response.status) ? "public, max-age=30, stale-while-revalidate=300" : "no-store",
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
    { error: "all search backends failed", upstream_status: lastStatus, upstream_body: lastBody.slice(0, 200), items: [], has_more: false },
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
