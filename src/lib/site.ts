export const SITE_NAME = "animeTv";
export const SITE_DOMAIN = "animetvplus.xyz";
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_DESCRIPTION =
  "Watch free anime online on animeTv with fast HD streaming, subbed and dubbed anime discovery, Hindi anime search, episode lists, weekly schedules, watch history, and smooth HLS playback.";

export const SITE_KEYWORDS = [
  "animeTv",
  "animetvplus",
  "watch anime online",
  "watch free anime online",
  "free anime streaming",
  "anime streaming site",
  "fast anime streaming",
  "HD anime streaming",
  "subbed anime",
  "dubbed anime",
  "Hindi anime",
  "Hindi dubbed anime",
  "anime episodes",
  "new anime releases",
  "currently airing anime",
  "anime schedule",
  "top rated anime",
  "popular anime",
  "anime watchlist",
  "anime watch history",
];

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cleanText(value: string, fallback = "") {
  return value.replace(/\s+/g, " ").trim() || fallback;
}
