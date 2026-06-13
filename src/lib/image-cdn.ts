const DEFAULT_IMAGE_CDN_BASE = "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev";
const IMAGE_CDN_BASE = (process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || DEFAULT_IMAGE_CDN_BASE).replace(/\/$/, "");
const IMAGE_CDN_ENABLED = process.env.NEXT_PUBLIC_IMAGE_CDN_ENABLED !== "0";
const LOCAL_IMAGE_CACHE_ENABLED = process.env.NEXT_PUBLIC_LOCAL_IMAGE_CACHE === "1";
// Re-proxying every image through the Cloudflare worker added ~400ms/image and
// produced half-painted thumbnails. Images now load STRAIGHT from the source
// CDN (Crunchyroll's imgsrv, AniList, MAL) which are already globally edge-cached
// — the same approach big streaming sites use. Opt back into the worker proxy
// only by setting NEXT_PUBLIC_IMAGE_PROXY=1.
const IMAGE_PROXY_ENABLED = process.env.NEXT_PUBLIC_IMAGE_PROXY === "1";

const CR_IMAGE_HOSTS = ["crunchyroll.com", "imgsrv.crunchyroll.com"];

function isCrImageHost(hostname: string) {
  return CR_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Crunchyroll's imgsrv encodes the render box in the URL path, e.g.
 *   /imgsrv/display/thumbnail/1560x2340/catalog/...
 * Asking its CDN for a smaller box returns an edge-cached, properly resized image
 * (cf=HIT, ~40KB vs ~740KB at full size) with no proxy hop. We rewrite the WxH
 * segment to the requested variant width, preserving the source aspect ratio so
 * posters (2:3) and episode thumbs (16:9) both stay correct.
 */
function crResizedUrl(parsed: URL, width: number): string {
  const match = parsed.pathname.match(/\/(\d+)x(\d+)\//);
  if (!match) return parsed.toString();
  const srcW = Number(match[1]);
  const srcH = Number(match[2]);
  if (!srcW || !srcH) return parsed.toString();
  const targetW = Math.min(width, srcW);
  const targetH = Math.max(1, Math.round((targetW * srcH) / srcW));
  parsed.pathname = parsed.pathname.replace(/\/\d+x\d+\//, `/${targetW}x${targetH}/`);
  return parsed.toString();
}

export type ImageVariant = "poster-xs" | "poster-sm" | "poster-md" | "poster-lg" | "banner-sm" | "banner-lg" | "thumb" | "episode-thumb";

const VARIANT_WIDTH: Record<ImageVariant, number> = {
  "poster-xs": 80,
  "poster-sm": 220,
  "poster-md": 320,
  "poster-lg": 480,
  "banner-sm": 960,
  "banner-lg": 1600,
  thumb: 360,
  "episode-thumb": 320,
};

const VARIANT_QUALITY: Record<ImageVariant, number> = {
  "poster-xs": 66,
  "poster-sm": 76,
  "poster-md": 80,
  "poster-lg": 84,
  "banner-sm": 78,
  "banner-lg": 82,
  thumb: 76,
  "episode-thumb": 58,
};

const ALLOWED_SOURCE_HOSTS = [
  "127.0.0.1",
  "localhost",
  "cdn.myanimelist.net",
  "myanimelist.net",
  "s4.anilist.co",
  "media.kitsu.io",
  "img.youtube.com",
  "anime-search-api-burw.onrender.com",
  "crunchyroll.com",
  "imgsrv.crunchyroll.com",
];

export function imageCdnUrl(src: string | undefined, variant: ImageVariant = "poster-md") {
  if (!src) return "";
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;

  try {
    const parsed = new URL(normalizeImageOrigin(src));
    const normalizedSrc = parsed.toString();

    if (parsed.hostname === "anime-tv-stream-proxy.animetvplus-stream.workers.dev" && parsed.pathname === "/image") {
      const nested = parsed.searchParams.get("url") || parsed.searchParams.get("src");
      if (nested) return imageCdnUrl(nested, variant);
    }
    if (parsed.pathname.startsWith("/api/image-db/")) {
      return normalizedSrc;
    }
    if (parsed.hostname === "cdn.animetvplus.xyz" || parsed.hostname === "anime-tv-stream-proxy.animetvplus-stream.workers.dev") {
      return normalizedSrc;
    }
    if (!ALLOWED_SOURCE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return normalizedSrc;
    }
    const width = VARIANT_WIDTH[variant];
    // Crunchyroll: resize on CR's own edge CDN via the URL path — fastest,
    // globally cached, no proxy hop. This is the primary art source.
    if (isCrImageHost(parsed.hostname)) {
      return crResizedUrl(parsed, width);
    }
    // Optional self-hosted WebP cache (opt-in).
    if (LOCAL_IMAGE_CACHE_ENABLED) {
      return `/api/image-cache?url=${encodeURIComponent(parsed.toString())}&w=${width}&q=${VARIANT_QUALITY[variant]}`;
    }
    // Optional Cloudflare worker proxy (opt-in only — off by default because the
    // re-proxy hop was the cause of slow, half-rendered images).
    if (IMAGE_PROXY_ENABLED && IMAGE_CDN_ENABLED) {
      return `${IMAGE_CDN_BASE}/image?url=${encodeURIComponent(parsed.toString())}&w=${width}&q=${VARIANT_QUALITY[variant]}`;
    }
    // AniList / MAL / others: already on fast, edge-cached CDNs — serve directly.
    return normalizedSrc;
  } catch {
    return src;
  }
}

export function directImageUrl(src: string | undefined) {
  if (!src) return "";
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    return new URL(normalizeImageOrigin(src)).toString();
  } catch {
    return src;
  }
}

export function warmImageCdn(src: string | undefined, variant: ImageVariant = "poster-md") {
  if (typeof window === "undefined" || !src) return;
  const cacheUrl = imageCdnUrl(src, variant);
  const directUrl = directImageUrl(src);
  if (!cacheUrl || cacheUrl === directUrl) return;
  window.requestIdleCallback?.(() => {
    fetch(cacheUrl, { mode: "no-cors", cache: "force-cache" }).catch(() => undefined);
  }) ?? window.setTimeout(() => {
    fetch(cacheUrl, { mode: "no-cors", cache: "force-cache" }).catch(() => undefined);
  }, 250);
}

function normalizeImageOrigin(src: string) {
  try {
    const parsed = new URL(src);
    if (parsed.hostname === "myanimelist.net" && parsed.pathname.startsWith("/images/")) {
      parsed.hostname = "cdn.myanimelist.net";
      return parsed.toString();
    }
  } catch {
    return src;
  }
  return src;
}
