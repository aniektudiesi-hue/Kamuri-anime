import Image from "next/image";
import Link from "next/link";
import { Play, Star } from "lucide-react";
import type { Anime } from "@/lib/types";
import { animeId, animePath, displayStatus, episodeLabel, posterOf, titleOf } from "@/lib/utils";

export function SeoAnimeCard({ anime, priority = false }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const title = titleOf(anime);
  const poster = posterOf(anime);
  const status = anime.status ? displayStatus(anime.status) : "";

  return (
    <article className="group">
      <Link href={animePath(anime, id)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#141828]">
          {poster ? (
            <Image
              src={poster}
              alt={`${title} anime poster`}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 190px"
              priority={priority}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#171b2d,#080a12)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/10 to-transparent" />
          {anime.score ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-xl bg-black/72 px-2 py-1 text-[11px] font-bold text-[#d8b56a]">
              <Star size={10} className="fill-[#d8b56a]" />
              {Number(anime.score).toFixed(1)}
            </span>
          ) : null}
          <span className="absolute bottom-2 left-2 right-2 inline-flex items-center justify-center gap-1 rounded-xl bg-[#cf2442] py-2 text-xs font-black text-white opacity-0 shadow-lg shadow-[#cf2442]/20 transition-opacity group-hover:opacity-100">
            <Play size={13} fill="currentColor" />
            View Anime
          </span>
        </div>
        <h2 className="mt-3 line-clamp-2 text-[13px] font-bold leading-5 text-white/88 group-hover:text-white">
          {title}
        </h2>
        <p className="mt-1 text-[11px] text-white/68">
          {episodeLabel(anime)}
          {status ? ` · ${status}` : ""}
        </p>
      </Link>
    </article>
  );
}
