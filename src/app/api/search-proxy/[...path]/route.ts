import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SEARCH_API_BASE =
  process.env.SEARCH_API_BASE ||
  process.env.NEXT_PUBLIC_SEARCH_API_BASE ||
  "http://127.0.0.1:5001";

// Forwards /api/search-proxy/<path...> → SEARCH_API_BASE/<path...> (query preserved).
// Used for our enriched search/discovery and the cr-card detail payload.
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstream = new URL(`/${path.join("/")}`, SEARCH_API_BASE);
  upstream.search = request.nextUrl.search;

  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "search proxy failed", items: [], has_more: false },
      { status: 502 },
    );
  }
}
