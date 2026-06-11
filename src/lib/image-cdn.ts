const DEFAULT_IMAGE_CDN_BASE = "https://anime-tv-stream-proxy.kamuri-anime.workers.dev";
const IMAGE_CDN_BASE = (process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || DEFAULT_IMAGE_CDN_BASE).replace(/\/$/, "");
const IMAGE_CDN_ENABLED = process.env.NEXT_PUBLIC_IMAGE_CDN_ENABLED === "1";
const LOCAL_IMAGE_CACHE_ENABLED = process.env.NEXT_PUBLIC_LOCAL_IMAGE_CACHE !== "0";

export type ImageVariant = "poster-xs" | "poster-sm" | "poster-md" | "poster-lg" | "banner-sm" | "banner-lg" | "thumb";

const VARIANT_WIDTH: Record<ImageVariant, number> = {
  "poster-xs": 96,
  "poster-sm": 260,
  "poster-md": 420,
  "poster-lg": 720,
  "banner-sm": 1280,
  "banner-lg": 2400,
  thumb: 480,
};

const VARIANT_QUALITY: Record<ImageVariant, number> = {
  "poster-xs": 74,
  "poster-sm": 84,
  "poster-md": 88,
  "poster-lg": 92,
  "banner-sm": 88,
  "banner-lg": 92,
  thumb: 82,
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

    if (parsed.pathname.startsWith("/api/image-db/")) {
      return normalizedSrc;
    }
    if (parsed.hostname === "cdn.animetvplus.xyz" || parsed.hostname === "anime-tv-stream-proxy.kamuri-anime.workers.dev") {
      return normalizedSrc;
    }
    if (!ALLOWED_SOURCE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return normalizedSrc;
    }
    const width = VARIANT_WIDTH[variant];
    if (LOCAL_IMAGE_CACHE_ENABLED) {
      return `/api/image-cache?url=${encodeURIComponent(parsed.toString())}&w=${width}&q=${VARIANT_QUALITY[variant]}`;
    }
    if (!IMAGE_CDN_ENABLED) {
      return normalizedSrc;
    }
    return `${IMAGE_CDN_BASE}/image?url=${encodeURIComponent(parsed.toString())}&w=${width}&q=${VARIANT_QUALITY[variant]}`;
  } catch {
    return src;
  }
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
