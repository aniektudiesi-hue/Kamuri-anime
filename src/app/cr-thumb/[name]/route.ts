import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

// Serve pre-converted Crunchyroll WebP images via a dynamic route (reads disk per
// request) so files added AFTER server start (by the live crawler) serve instantly
// — unlike public/ static files, which next start caches at startup.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "public", "cr-img");

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^([a-f0-9]{16,40}|mal_\d+_ep_\d+)\.webp$/.test(name)) {
    return new NextResponse("bad request", { status: 400 });
  }
  try {
    const buf = await readFile(path.join(DIR, name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
