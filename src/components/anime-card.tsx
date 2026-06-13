"use client";

import Link from "next/link";
import { Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProgressiveImage } from "@/components/progressive-image";
import { startRouteBuffer } from "@/lib/route-buffer";
import { fetchCrCard } from "@/lib/catalog-api";
import type { Anime } from "@/lib/types";
import { useResumeHistory } from "@/lib/use-resume-history";
import { animeId, animePath, episodeLabel, posterOf, rememberAnime, titleOf } from "@/lib/utils";

const loadedPosterUrls = new Set<string>();
// Detail data (cr-card) is the slow part of opening a title — on a cold backend
// it takes 1-3s. Warm it the instant a card is hovered/pressed so the detail
// page reads from cache and opens instantly. One prefetch per id per session.
const prefetchedDetailIds = new Set<string>();

const STATUS_DOT: Record<string, string> = {
  currently_airing: "bg-[#c8ced8]",
  not_yet_aired: "bg-white/45",
  finished_airing: "bg-white/30",
};

const FORMAT_LABEL: Record<string, string> = {
  TV: "TV", MOVIE: "MOVIE", OVA: "OVA", ONA: "ONA", SPECIAL: "SPECIAL", MUSIC: "MUSIC",
};

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
  const id = animeId(anime);
  const poster = posterOverride || posterOf(anime, priority ? "poster-md" : "poster-sm");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() => Boolean(poster && loadedPosterUrls.has(poster)));
  const title = titleOf(anime);
  const statusKey = (anime.status || "").toLowerCase();
  const formatLabel = FORMAT_LABEL[(anime.format || "").toUpperCase()] || "";
  const seasonCount = Number(anime.season_count || 0);
  const synopsis = (anime.overview || "").trim();
  const resume = useResumeHistory(id);
  const href = animePath(anime, id);
  const queryClient = useQueryClient();

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(Boolean(poster && loadedPosterUrls.has(poster)));
  }, [poster]);

  function prefetchDetail() {
    if (!id || prefetchedDetailIds.has(id)) return;
    prefetchedDetailIds.add(id);
    queryClient.prefetchQuery({
      queryKey: ["cr-card", "canonical-v8", id, 1],
      queryFn: () => fetchCrCard(id, 1),
      staleTime: 1000 * 60 * 30,
    });
  }

  function pressAnime() {
    startRouteBuffer();
    prefetchDetail();
  }

  return (
    <article
      onPointerEnter={prefetchDetail}
      onPointerDown={pressAnime}
      onTouchStart={pressAnime}
      className={`card-lift scroll-card group ${className ?? "w-[160px] shrink-0 sm:w-[180px]"}`}
    >
      <Link href={href} onClick={() => { startRouteBuffer(); rememberAnime(anime); }} className="block">

        {/* Poster container */}
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

          {/* Always-present bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Score badge — top left */}
          {anime.score ? (
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
              <Star size={10} className="fill-[#d8b56a] text-[#d8b56a]" />
              <span className="text-[#d8b56a]">{Number(anime.score).toFixed(1)}</span>
            </div>
          ) : null}

          {/* Status dot + format badge — top right */}
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

          {/* Hover overlay — Crunchyroll-style: synopsis + seasons + play */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-black/25 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {synopsis ? (
              <p className="mb-2 line-clamp-4 text-[10.5px] leading-[1.45] text-white/72">{synopsis}</p>
            ) : null}
            <div className="mb-2 flex items-center gap-2 text-[11px] font-normal text-white/60">
              <span>{resume.hasResume ? `Episode ${resume.episode}` : episodeLabel(anime)}</span>
              {seasonCount > 1 ? (
                <span className="rounded bg-white/12 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
                  {seasonCount} seasons
                </span>
              ) : null}
            </div>
            {/* Play button */}
            <div className="flex items-center justify-center rounded-md bg-[#cf2442] py-2.5 text-sm font-medium text-white shadow-lg shadow-[#cf2442]/24 transition hover:bg-[#dc2d4b]">
              <Play size={14} fill="currentColor" className="mr-1.5" />
              {resume.hasResume ? "Continue" : "Watch Now"}
            </div>
          </div>
        </div>

        {/* Title + meta */}
        <div className="mt-3 px-0.5">
          <h2 className="line-clamp-2 text-[13px] font-medium leading-5 text-white/82 transition-colors group-hover:text-white">
            {title}
          </h2>
          <p className="mt-1 text-[11px] text-white/68">
            {resume.hasResume ? `Continue Ep ${resume.episode}` : episodeLabel(anime)}
            {statusKey === "currently_airing" ? " · Airing" : statusKey === "finished_airing" ? " · Completed" : ""}
          </p>
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
