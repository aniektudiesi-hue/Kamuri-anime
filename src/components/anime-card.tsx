"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Anime } from "@/lib/types";
import { animeId, episodeCount, episodeLabel, posterOf, rememberAnime, titleOf } from "@/lib/utils";

export function AnimeCard({ anime, priority = false }: { anime: Anime; priority?: boolean }) {
  const queryClient = useQueryClient();
  const id = animeId(anime);
  const episodes = episodeCount(anime);

  function prefetch() {
    if (!id) return;
    queryClient.prefetchQuery({
      queryKey: ["episodes", id, episodes],
      queryFn: () => api.episodes(id, episodes),
      staleTime: 1000 * 60 * 20,
    });
  }

  return (
    <article onMouseEnter={prefetch} onFocus={prefetch} className="group w-[150px] shrink-0 sm:w-[170px]">
      <Link href={`/anime/${id}`} onClick={() => rememberAnime(anime)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-panel-strong">
          {posterOf(anime) ? (
            <Image src={posterOf(anime)} alt={titleOf(anime)} fill sizes="180px" priority={priority} className="object-cover transition duration-300 group-hover:scale-105" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90" />
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-bold">
            <Star size={12} className="fill-accent-2 text-accent-2" />
            {anime.score ? anime.score.toFixed(1) : "NA"}
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
            <span className="rounded bg-white/12 px-2 py-1 text-xs font-semibold backdrop-blur">{episodeLabel(anime)}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white shadow-lg transition group-hover:scale-110">
              <Play size={15} fill="currentColor" />
            </span>
          </div>
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5">{titleOf(anime)}</h3>
      </Link>
    </article>
  );
}
