"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressiveImage } from "@/components/progressive-image";
import { fetchCrCard } from "@/lib/catalog-api";
import type { Anime } from "@/lib/types";
import { animeId, animePath, posterOf, rememberAnime, titleOf } from "@/lib/utils";

const loadedPosterUrls = new Set<string>();
// Opening a title navigates full-page (cache wiped), so an in-memory prefetch is
// useless. Instead, on hover/focus we fire the cr-card request early — it warms
// the worker + browser HTTP cache, so the detail page's own fetch returns from
// cache and the page paints fast. One warm per id per session.
const warmedDetailIds = new Set<string>();

const STATUS_DOT: Record<string, string> = {
  currently_airing: "bg-[#c8ced8]",
  not_yet_aired: "bg-white/45",
  finished_airing: "bg-white/30",
};

const FORMAT_LABEL: Record<string, string> = {
  TV: "TV",
  MOVIE: "MOVIE",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "SPECIAL",
  MUSIC: "MUSIC",
};

function statusLabel(statusKey: string) {
  if (statusKey === "currently_airing") return "Airing";
  if (statusKey === "finished_airing") return "Completed";
  if (statusKey === "not_yet_aired") return "Coming soon";
  return "";
}

export function AnimeCard({
  anime,
  priority = false,
  className,
  fastImage = false,
  posterOverride,
}: {
  anime: Anime;
  priority?: boolean;
  className?: string;
  fastImage?: boolean;
  posterOverride?: string;
}) {
  void fastImage;
  const id = animeId(anime);
  const poster = posterOverride || posterOf(anime, "poster-sm");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => Boolean(poster && loadedPosterUrls.has(poster)));
  const title = titleOf(anime);
  const statusKey = (anime.status || "").toLowerCase();
  const statusText = statusLabel(statusKey);
  const formatLabel = FORMAT_LABEL[(anime.format || "").toUpperCase()] || "";
  const seasonCount = Number(anime.season_count || 0);
  const synopsis = (anime.overview || "").trim();
  const href = animePath(anime, id);

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(Boolean(poster && loadedPosterUrls.has(poster)));
  }, [poster]);

  function warmDetail() {
    if (!id || warmedDetailIds.has(id)) return;
    warmedDetailIds.add(id);
    fetchCrCard(id, 1).catch(() => undefined);
  }

  function openAnime(event: MouseEvent<HTMLAnchorElement>) {
    rememberAnime(anime);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    window.location.assign(href);
  }

  return (
    <article
      onPointerEnter={warmDetail}
      onFocus={warmDetail}
      className={`card-lift scroll-card group ${className ?? "w-[160px] shrink-0 sm:w-[180px]"}`}
    >
      <Link href={href} prefetch={false} onClick={openAnime} className="block">
        <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-lg bg-[#141828]" data-loaded={imageLoaded || imageFailed}>
          {poster && !imageFailed ? (
            <ProgressiveImage
              highSrc={poster}
              alt={title}
              sizes="(max-width:640px) 33vw, (max-width:1024px) 25vw, 180px"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              imgClassName="transition-transform duration-200 group-hover:scale-[1.025]"
              onFail={() => setImageFailed(true)}
              onLoad={() => {
                loadedPosterUrls.add(poster);
                setImageLoaded(true);
              }}
            />
          ) : (
            <PosterFallback title={title} />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {anime.score ? (
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
              <Star size={10} className="fill-[#d8b56a] text-[#d8b56a]" />
              <span className="text-[#d8b56a]">{Number(anime.score).toFixed(1)}</span>
            </div>
          ) : null}

          <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
            {formatLabel ? (
              <span className="rounded-md bg-[#cf2442]/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                {formatLabel}
              </span>
            ) : null}
            {statusKey ? (
              <span className="flex items-center rounded-md bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[statusKey] || "bg-white/30"} ${statusKey === "currently_airing" ? "animate-pulse" : ""}`} />
              </span>
            ) : null}
          </div>

          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-black/25 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {synopsis ? <p className="mb-2 line-clamp-4 text-[10.5px] leading-[1.45] text-white/72">{synopsis}</p> : null}
            <div className="mb-2 flex items-center gap-2 text-[11px] font-normal text-white/60">
              {statusText ? <span>{statusText}</span> : null}
              {seasonCount > 1 ? (
                <span className="rounded bg-white/12 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                  {seasonCount} seasons
                </span>
              ) : null}
            </div>
            <div className="flex items-center justify-center rounded-md bg-[#cf2442] py-2.5 text-sm font-medium text-white shadow-lg shadow-[#cf2442]/24 transition hover:bg-[#dc2d4b]">
              <Play size={14} fill="currentColor" className="mr-1.5" />
              Watch Now
            </div>
          </div>
        </div>

        <div className="mt-3 px-0.5">
          <h2 className="line-clamp-2 text-[13px] font-medium leading-5 text-white/82 transition-colors group-hover:text-white">
            {title}
          </h2>
          {statusText ? <p className="mt-1 text-[11px] text-white/68">{statusText}</p> : null}
        </div>
      </Link>
    </article>
  );
}

function PosterFallback({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_28%_18%,rgba(207,36,66,0.25),transparent_34%),linear-gradient(145deg,#171b2d,#080a12)]">
      <div className="grid h-16 w-16 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.06] text-xl font-semibold text-white/70 shadow-2xl shadow-black/35">
        {initials || "AT"}
      </div>
    </div>
  );
}
