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

// US-side proxy for Crunchyroll art. CR's imgsrv geo-redirects/403s some boxes
// outside the US, so non-US viewers load CR images through the worker (which
// fetches from CR and edge-caches the bytes). US / SSR / unknown viewers load
// straight from CR's global CDN — no proxy hop.
const CR_PROXY_BASE = "https://animetvplus-stream-backup.animetvplus-stream.workers.dev/cr-image";
const COUNTRY_KEY = "anime-tv-edge-country";

function viewerCountry(): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(COUNTRY_KEY) || "").toUpperCase();
  } catch {
    return "";
  }
}

function maybeProxyCr(crUrl: string): string {
  // imgsrv.crunchyroll.com is on Cloudflare's global CDN — serves fast in all
  // regions directly. The proxy added 2-3s per image for non-US viewers; direct
  // is faster everywhere. Only proxy if explicitly opted in via env var.
  if (process.env.NEXT_PUBLIC_CR_PROXY === "1") {
    const country = viewerCountry();
    if (country && country !== "US") return `${CR_PROXY_BASE}?u=${encodeURIComponent(crUrl)}`;
  }
  return crUrl;
}

// Crunchyroll's imgsrv only serves a FIXED WHITELIST of render boxes — asking for
// any other WxH returns 403 (e.g. 320x480/220x330 fail, 240x360/480x720 work).
// So we snap the requested width to the nearest allowed CR size (>= target, to
// avoid upscale blur) for the matching aspect family.
const CR_PORTRAIT_SIZES: [number, number][] = [[240, 360], [480, 720], [1560, 2340]];
const CR_LANDSCAPE_SIZES: [number, number][] = [[320, 180], [640, 360], [1200, 675], [1920, 1080]];

/**
 * Crunchyroll's imgsrv encodes the render box in the URL path, e.g.
 *   /imgsrv/display/thumbnail/1560x2340/catalog/...
 * Asking its CDN for a smaller WHITELISTED box returns an edge-cached, resized
 * image (cf=HIT, ~40KB vs ~740KB full size) with no proxy hop. We map the
 * requested variant width to the nearest allowed CR size for the source's aspect
 * (2:3 posters / 16:9 thumbs); unknown aspects fall back to the native URL.
 */
function crResizedUrl(parsed: URL, width: number): string {
  const match = parsed.pathname.match(/\/(\d+)x(\d+)\//);
  if (!match) return parsed.toString();
  const srcW = Number(match[1]);
  const srcH = Number(match[2]);
  if (!srcW || !srcH) return parsed.toString();
  const ratio = srcW / srcH;
  let sizes: [number, number][] | null = null;
  if (Math.abs(ratio - 2 / 3) < 0.06) sizes = CR_PORTRAIT_SIZES;
  else if (Math.abs(ratio - 16 / 9) < 0.12) sizes = CR_LANDSCAPE_SIZES;
  if (!sizes) return parsed.toString(); // unknown aspect — native size already serves 200
  const pick = sizes.find(([w]) => w >= width) ?? sizes[sizes.length - 1];
  if (pick[0] >= srcW) return parsed.toString(); // never upscale past the source
  parsed.pathname = parsed.pathname.replace(/\/\d+x\d+\//, `/${pick[0]}x${pick[1]}/`);
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
    // Crunchyroll: resize on CR's own edge CDN via the URL path — CR pre-generates
    // these whitelisted render boxes, so they're globally edge-cached and load fast
    // on the FIRST view. (We tried the cdn-cgi/image WebP resizer for smaller bytes,
    // but its on-the-fly transform adds ~2-3.5s of cold latency per never-seen image
    // — the "images load after 4s" regression — so the pre-sized box wins for UX.)
    if (isCrImageHost(parsed.hostname)) {
      return maybeProxyCr(crResizedUrl(parsed, width));
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

// Crunchyroll episode thumbnail in WIDE form WITHOUT cropping: use CR's own
// Cloudflare image resizer with fit=contain (letterboxes the frame instead of
// cropping it to fill the box) at the native 640x360 episode-card size. This is a
// pure URL reshape on CR's edge CDN — no proxy hop, served in ~1 render box, so it
// arrives almost instantly. Any CR thumbnail (raw, /imgsrv/display/thumbnail, or
// an existing cdn-cgi URL) is normalized to the same /catalog/crunchyroll/<hash>
// asset. Returns "" for non-CR thumbnails so the caller can fall back.
const CR_EP_THUMB_BASE = "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=contain,format=auto,quality=85,width=640,height=360,blur=0";

export function crEpisodeThumbUrl(src: string | undefined): string {
  if (!src) return "";
  const match = src.match(/\/catalog\/crunchyroll\/[^?]+?\.(?:jpe?g|png|webp)/i);
  if (!match) return "";
  return `${CR_EP_THUMB_BASE}${match[0]}`;
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
