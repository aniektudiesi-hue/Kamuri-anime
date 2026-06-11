import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Single backend = the 5001 season-mapping gateway. It serves the authoritative
// season mapping natively and proxies stream/sections internally — the UI never
// talks to 3058 directly.
const CATALOG_API_BASE = process.env.CATALOG_API_BASE || "http://127.0.0.1:5001";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyCatalog(request, context);
}

async function proxyCatalog(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstream = new URL(`/${path.join("/")}`, CATALOG_API_BASE);
  upstream.search = request.nextUrl.search;

  try {
    const body = request.method === "GET" ? undefined : await request.text();
    const headers = new Headers({ Accept: "application/json" });
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": request.method === "GET"
          ? "public, max-age=30, stale-while-revalidate=300"
          : "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "catalog proxy failed" },
      { status: 502 },
    );
  }
}
