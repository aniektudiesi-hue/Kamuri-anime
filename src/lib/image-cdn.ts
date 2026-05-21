const DEFAULT_IMAGE_CDN_BASE = "https://anime-tv-stream-proxy.kamuri-anime.workers.dev";
const IMAGE_CDN_BASE = (process.env.NEXT_PUBLIC_IMAGE_CDN_BASE || DEFAULT_IMAGE_CDN_BASE).replace(/\/$/, "");
const IMAGE_CDN_ENABLED = process.env.NEXT_PUBLIC_IMAGE_CDN_ENABLED !== "0";

export type ImageVariant = "poster-xs" | "poster-sm" | "poster-md" | "poster-lg" | "banner-sm" | "banner-lg" | "thumb";

const VARIANT_WIDTH: Record<ImageVariant, number> = {
  "poster-xs": 64,
  "poster-sm": 184,
  "poster-md": 260,
  "poster-lg": 420,
  "banner-sm": 768,
  "banner-lg": 1600,
  thumb: 320,
};

const VARIANT_QUALITY: Record<ImageVariant, number> = {
  "poster-xs": 58,
  "poster-sm": 74,
  "poster-md": 80,
  "poster-lg": 86,
  "banner-sm": 76,
  "banner-lg": 80,
  thumb: 66,
};

const ALLOWED_SOURCE_HOSTS = [
  "cdn.myanimelist.net",
  "myanimelist.net",
  "s4.anilist.co",
  "media.kitsu.io",
  "img.youtube.com",
  "anime-search-api-burw.onrender.com",
];

export function imageCdnUrl(src: string | undefined, variant: ImageVariant = "poster-md") {
  if (!src) return "";
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;

  try {
    const parsed = new URL(normalizeImageOrigin(src));
    const normalizedSrc = parsed.toString();

    if (!IMAGE_CDN_ENABLED) {
      return normalizedSrc;
    }

    if (parsed.hostname === "cdn.animetvplus.xyz" || parsed.hostname === "anime-tv-stream-proxy.kamuri-anime.workers.dev") {
      return normalizedSrc;
    }
    if (!ALLOWED_SOURCE_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return normalizedSrc;
    }
    const width = VARIANT_WIDTH[variant];
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
