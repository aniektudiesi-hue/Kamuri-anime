"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Anime } from "@/lib/types";
import { useResumeHistory } from "@/lib/use-resume-history";
import { animeId, animePath, episodeCount, episodeLabel, posterOf, rememberAnime, titleOf, watchPath } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  currently_airing: "bg-[#c8ced8]",
  not_yet_aired: "bg-white/45",
  finished_airing: "bg-white/30",
};

export function AnimeCard({ anime, priority = false, className }: { anime: Anime; priority?: boolean; className?: string }) {
  const queryClient = useQueryClient();
  const id = animeId(anime);
  const episodes = episodeCount(anime);
  const poster = posterOf(anime);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const title = titleOf(anime);
  const statusKey = (anime.status || "").toLowerCase();
  const resume = useResumeHistory(id);
  const href = resume.hasResume
    ? `${watchPath(anime, id, resume.episode)}${resume.progress > 1 ? `?t=${Math.floor(resume.progress)}` : ""}`
    : animePath(anime, id);

  function prefetch() {
    if (!id) return;
    queryClient.prefetchQuery({
      queryKey: ["episodes", id, episodes],
      queryFn: () => api.episodes(id, episodes),
      staleTime: 1000 * 60 * 20,
    });
  }

  return (
    <article
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={`card-lift scroll-card group ${className ?? "w-[160px] shrink-0 sm:w-[180px]"}`}
    >
      <Link href={href} onClick={() => rememberAnime(anime)} className="block">

        {/* Poster container */}
        <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#141828]" data-loaded={imageLoaded || imageFailed}>
          {poster && !imageFailed ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="190px"
              priority={priority}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              className={`object-cover transition duration-700 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <PosterFallback title={title} />
          )}

          {/* Always-present bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Score badge — top left */}
          {anime.score ? (
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-xl bg-black/70 px-2 py-1 text-[11px] font-bold backdrop-blur-sm">
              <Star size={10} className="fill-[#d8b56a] text-[#d8b56a]" />
              <span className="text-[#d8b56a]">{Number(anime.score).toFixed(1)}</span>
            </div>
          ) : null}

          {/* Status dot — top right */}
          {statusKey ? (
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-xl bg-black/70 px-2 py-1 backdrop-blur-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[statusKey] || "bg-white/30"} ${statusKey === "currently_airing" ? "animate-pulse" : ""}`} />
            </div>
          ) : null}

          {/* Hover overlay */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/60 to-black/20 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="mb-2 text-[11px] font-semibold text-white/60">
              {resume.hasResume ? `Episode ${resume.episode}` : episodeLabel(anime)}
            </p>
            {/* Play button */}
            <div className="flex items-center justify-center rounded-xl bg-[#cf2442] py-2.5 text-sm font-bold text-white shadow-lg shadow-[#cf2442]/24 transition hover:bg-[#dc2d4b]">
              <Play size={14} fill="currentColor" className="mr-1.5" />
              {resume.hasResume ? "Continue" : "Watch Now"}
            </div>
          </div>
        </div>

        {/* Title + meta */}
        <div className="mt-3 px-0.5">
          <h2 className="line-clamp-2 text-[13px] font-semibold leading-5 text-white/85 transition-colors group-hover:text-white">
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
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.06] text-xl font-black text-white/70 shadow-2xl shadow-black/35">
        {initials || "AT"}
      </div>
    </div>
  );
}
