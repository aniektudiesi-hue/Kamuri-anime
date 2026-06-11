import { createHash } from "crypto";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_DIR = path.join(process.cwd(), "public", "image-cache");
const CACHE_URL_PREFIX = "/image-cache";
const MAX_WIDTH = 3840;
const MIN_WIDTH = 80;
const MAX_BYTES = 18 * 1024 * 1024;
const ALLOWED_HOSTS = [
  "cdn.myanimelist.net",
  "myanimelist.net",
  "s4.anilist.co",
  "media.kitsu.io",
  "img.youtube.com",
  "anime-search-api-burw.onrender.com",
  "crunchyroll.com",
  "imgsrv.crunchyroll.com",
];

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("url") || "";
  const width = clampInt(request.nextUrl.searchParams.get("w"), 720, MIN_WIDTH, MAX_WIDTH);
  const quality = clampInt(request.nextUrl.searchParams.get("q"), 90, 70, 96);

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return NextResponse.json({ error: "invalid image url" }, { status: 400 });
  }

  if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) {
    return NextResponse.json({ error: "image host not allowed" }, { status: 400 });
  }

  const key = createHash("sha256").update(`${url.toString()}|${width}|${quality}|webp`).digest("hex").slice(0, 32);
  const filename = `${key}.webp`;
  const filePath = path.join(CACHE_DIR, filename);
  const publicUrl = `${CACHE_URL_PREFIX}/${filename}`;

  // If we've already cached this exact variant, send the browser straight to the
  // STATIC file (308, immutable) instead of streaming bytes back through this
  // Node route. The static server is far faster and the redirect itself is cached,
  // so a deep scroll never re-invokes this handler for images it has seen.
  if (await fileExists(filePath)) {
    return staticRedirect(publicUrl);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const response = await fetch(url, {
    headers: { Accept: "image/avif,image/webp,image/*,*/*" },
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.redirect(url.toString(), 302);
  }

  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.redirect(url.toString(), 302);
  }

  const input = Buffer.from(await response.arrayBuffer());
  if (input.byteLength > MAX_BYTES) {
    return NextResponse.redirect(url.toString(), 302);
  }

  const output = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 3 })
    .toBuffer();

  await writeFile(filePath, output);
  // Redirect to the freshly-written static file so this is the ONLY time the
  // request passes through Node for this image.
  return staticRedirect(publicUrl);
}

function staticRedirect(publicUrl: string) {
  return new NextResponse(null, {
    status: 308,
    headers: {
      Location: publicUrl,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

async function fileExists(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const value = Number(raw || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isAllowedHost(hostname: string) {
  return ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
