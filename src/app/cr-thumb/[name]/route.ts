import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REMOTE_THUMB_BASE =
  process.env.CATALOG_DIRECT_API_BASE ||
  process.env.SEARCH_DIRECT_API_BASE ||
  "https://animetvplus-stream-backup-india.onrender.com";

const IMAGE_HEADERS = {
  "Content-Type": "image/webp",
  "Cache-Control": "public, max-age=31536000, immutable",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^([a-f0-9]{16,40}|mal_\d+_ep_\d+)\.webp$/.test(name)) {
    return new NextResponse("bad request", { status: 400 });
  }

  try {
    const remoteUrl = new URL(`/cr-thumb/${encodeURIComponent(name)}`, REMOTE_THUMB_BASE);
    const remote = await fetch(remoteUrl, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!remote.ok) return missingThumb(name);
    return new NextResponse(new Uint8Array(await remote.arrayBuffer()), {
      headers: {
        ...IMAGE_HEADERS,
        "Content-Type": remote.headers.get("Content-Type") || IMAGE_HEADERS["Content-Type"],
      },
    });
  } catch {
    return missingThumb(name);
  }
}

function missingThumb(name: string) {
  const ep = name.match(/_ep_(\d+)\.webp$/)?.[1] || "";
  const label = ep ? `EP ${ep}` : "EP";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#15161c"/><stop offset="1" stop-color="#07080b"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="254" y="151" width="132" height="58" rx="4" fill="#0b0c10" stroke="#2a2d36"/><text x="320" y="188" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#aeb6c5">${label}</text></svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
