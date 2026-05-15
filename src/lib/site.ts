export const SITE_NAME = "animeTv";
export const SITE_DOMAIN = "animetvplus.xyz";
export const SITE_URL = `https://${SITE_DOMAIN}`;
export const SITE_DESCRIPTION =
  "Watch free anime online on animeTv with fast HD streaming, subbed and dubbed anime discovery, episode lists, monthly schedules, watch history, and smooth HLS playback.";

export const SITE_KEYWORDS = [
  "animeTv",
  "animetvplus",
  "animetvplus.xyz",
  "animeTv Plus",
  "watch anime online",
  "watch anime online free",
  "watch anime free",
  "watch anime episodes online",
  "watch anime series online",
  "anime online",
  "watch free anime online",
  "licensed anime streaming",
  "licensed anime platform",
  "safe anime streaming",
  "secure anime streaming",
  "free anime streaming",
  "free anime site",
  "free anime episodes",
  "anime streaming site",
  "anime streaming website",
  "anime streaming platform",
  "anime watch online",
  "fast anime streaming",
  "fast anime player",
  "HD anime streaming",
  "HLS anime streaming",
  "anime with subtitles",
  "subbed anime",
  "dubbed anime",
  "english sub anime",
  "english dub anime",
  "anime episodes",
  "latest anime episodes",
  "new anime episodes",
  "new anime releases",
  "recent anime releases",
  "currently airing anime",
  "ongoing anime",
  "seasonal anime",
  "anime schedule",
  "monthly anime schedule",
  "anime release schedule",
  "top rated anime",
  "popular anime",
  "trending anime",
  "anime genres",
  "action anime",
  "adventure anime",
  "fantasy anime",
  "isekai anime",
  "romance anime",
  "comedy anime",
  "drama anime",
  "school anime",
  "slice of life anime",
  "sports anime",
  "sci-fi anime",
  "supernatural anime",
  "mecha anime",
  "mystery anime",
  "horror anime",
  "anime watchlist",
  "anime watch history",
  "continue watching anime",
];

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function cleanText(value: string, fallback = "") {
  return value.replace(/\s+/g, " ").trim() || fallback;
}
