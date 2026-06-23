import type { Anime } from "./types";
import { bannerOf, posterOf } from "./utils";
import { imageCdnUrl } from "./image-cdn";

// The exact image the mobile hero paints for a given item. Pure + server-safe so
// the home route can emit a matching <link rel="preload"> for the LCP image and
// the client hero can render the identical URL (no swap, no double download).
export function mobileHeroBgSrc(anime: Anime, crDetailBanner?: string): string {
  const raw = crDetailBanner
    || anime.detail_banner
    || anime.cr_hero
    || bannerOf(anime, "banner-md")
    || posterOf(anime, "poster-md");
  return imageCdnUrl(raw, "banner-md");
}
