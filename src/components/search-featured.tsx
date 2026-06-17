"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import { ProgressiveImage } from "@/components/progressive-image";
import { crEpisodeThumbUrl, imageCdnUrl } from "@/lib/image-cdn";
import type { Anime } from "@/lib/types";
import { animePath, episodeLabel, posterOf, titleOf } from "@/lib/utils";

// The featured top-3 image: Crunchyroll's WIDE catalog thumbnail (cr_wide, the
// native 16:9 promo image), then the CR vertical thumbnail, then a genuine AniList
// banner. Returned as the raw source; the card resizes a CR thumbnail to 640x360.
export function wideImageOf(anime: Anime): string {
  if (anime.cr_wide) return anime.cr_wide;
  if (anime.cr_poster) return anime.cr_poster;
  const banner = anime.banner || "";
  if (/anilist|anili\.st/i.test(banner)) return banner;
  return "";
}

function FeaturedCard({ anime, rank, priority }: { anime: Anime; rank: number; priority: boolean }) {
  const wide = wideImageOf(anime);
  const poster = posterOf(anime, "poster-lg");
  // A CR catalog thumbnail (cr_wide / cr_poster) is resized to the native card box
  // 640x360 on CR's own edge (fit=contain, webp) — tiny + instant. An AniList
  // banner is already wide, so use a small banner box.
  const cr640 = crEpisodeThumbUrl(wide);
  const highSrc = cr640 || imageCdnUrl(wide || poster, "banner-sm");
  const fallbackSrc = imageCdnUrl(poster, "poster-lg");
  const titleLogo = anime.title_logo;
  const score = Number(anime.score || 0);

  return (
    <Link
      href={animePath(anime, undefined)}
      prefetch={false}
      className="group relative block aspect-[16/9] overflow-hidden rounded-xl border border-white/[0.07] bg-[#111217] ring-0 transition-[border-color,transform] duration-200 hover:border-[#c4182a]/45"
    >
      <ProgressiveImage
        highSrc={highSrc}
        fallbackSrc={fallbackSrc}
        alt={titleOf(anime)}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        priority={priority}
        imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
      />
      {/* Bottom-up gradient so the title/meta stays legible over any art. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <span className="absolute left-3 top-3 grid h-6 min-w-6 place-items-center rounded-md bg-[#c4182a] px-1.5 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
        {rank}
      </span>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          {titleLogo ? (
            <span className="relative block h-9 w-auto max-w-[78%]">
              <Image src={titleLogo} alt={titleOf(anime)} fill unoptimized sizes="240px" className="object-contain object-left-bottom drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
            </span>
          ) : (
            <p className="line-clamp-2 text-[15px] font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
              {titleOf(anime)}
            </p>
          )}
          <p className="mt-1.5 flex items-center gap-2 text-[11px] font-medium text-white/65">
            <span>{episodeLabel(anime)}</span>
            {score > 0 ? (
              <span className="flex items-center gap-1 text-[#f5c451]">
                <Star size={11} className="fill-current" />
                {score.toFixed(1)}
              </span>
            ) : null}
          </p>
        </div>
        <span className="grid h-9 w-9 shrink-0 translate-y-1 place-items-center rounded-full bg-white/12 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:bg-[#c4182a] group-hover:opacity-100">
          <Play size={15} className="translate-x-[1px] fill-current" />
        </span>
      </div>
    </Link>
  );
}

export function SearchFeatured({ items }: { items: Anime[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-10">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#c4182a]">Top matches</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 3).map((anime, i) => (
          <FeaturedCard key={`${anime.mal_id}-${i}`} anime={anime} rank={i + 1} priority={i < 3} />
        ))}
      </div>
    </div>
  );
}

// Same footprint as SearchFeatured so reserving its space during load prevents
// the results layout from jumping while the user types.
export function SearchFeaturedSkeleton() {
  return (
    <div className="mb-10">
      <div className="mb-2.5 h-3 w-24 animate-pulse rounded bg-[#1b1b1f]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[16/9] animate-pulse rounded-xl bg-[#1b1b1f]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
