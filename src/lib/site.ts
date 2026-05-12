export const SITE_NAME = "animeTv";
export const SITE_DOMAIN = "animetvplus.xyz";
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_DESCRIPTION =
  "Watch anime online with fast browsing, detailed anime pages, episode lists, watch history, and smooth HLS playback on animeTv.";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cleanText(value: string, fallback = "") {
  return value.replace(/\s+/g, " ").trim() || fallback;
}
