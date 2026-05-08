"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Star, ChevronRight, Flame, Radio, Trophy } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { HeroCarousel } from "@/components/hero-carousel";
import { SidebarLayout } from "@/components/sidebar";
import { api } from "@/lib/api";
import type { Anime } from "@/lib/types";
import { animeId, episodeCount, episodeLabel, posterOf, rememberAnime, titleOf } from "@/lib/utils";

async function fetchCurrentlyAiring(): Promise<Anime[]> {
  const gql = `
    query Airing {
      Page(page: 1, perPage: 50) {
        media(status: RELEASING, type: ANIME, sort: POPULARITY_DESC) {
          idMal id
          title { romaji english }
          coverImage { large }
          averageScore episodes status
        }
      }
    }
  `;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql }),
    });
    if (!res.ok) return [];
    type M = { idMal: number | null; id: number; title: { romaji: string; english: string | null }; coverImage: { large: string }; averageScore: number | null; episodes: number | null };
    const json = await res.json() as { data?: { Page?: { media: M[] } } };
    return (json.data?.Page?.media ?? []).map((m) => ({
      mal_id: m.idMal ? String(m.idMal) : String(m.id),
      title: m.title.english || m.title.romaji,
      image_url: m.coverImage.large,
      score: m.averageScore ? m.averageScore / 10 : undefined,
      episodes: m.episodes ?? undefined,
      status: "currently_airing",
    }));
  } catch {
    return [];
  }
}

export default function Home() {
  const [banners, thumbnails, airing, topRated] = useQueries({
    queries: [
      { queryKey: ["banners"], queryFn: api.banners, staleTime: 1000 * 60 * 60 },
      { queryKey: ["thumbnails"], queryFn: api.thumbnails, staleTime: 1000 * 60 * 60 },
      { queryKey: ["anilist-airing"], queryFn: fetchCurrentlyAiring, staleTime: 1000 * 60 * 20 },
      { queryKey: ["top-rated"], queryFn: api.topRated, staleTime: 1000 * 60 * 60 },
    ],
  });

  return (
    <AppShell>
      <div className="hidden sm:block">
        <HeroCarousel items={banners.data} loading={banners.isLoading} />
      </div>

      <SidebarLayout>
        {/* Popular Today — full grid, all items */}
        <BigSection
          title="Popular Today"
          icon={<Flame size={14} className="text-[#e8336a]" />}
          items={thumbnails.data}
          loading={thumbnails.isLoading}
          viewAllHref="/search?q=popular"
        />

        {/* Currently Airing — sourced from AniList RELEASING status */}
        <BigSection
          title="Currently Airing"
          icon={<Radio size={14} className="text-emerald-400" />}
          items={airing.data}
          loading={airing.isLoading}
          viewAllHref="/genre/Action"
        />

        {/* Top Rated — full grid, all items */}
        <BigSection
          title="Top Rated All Time"
          icon={<Trophy size={14} className="text-[#f0b429]" />}
          items={topRated.data}
          loading={topRated.isLoading}
          viewAllHref="/search?q=top+rated"
        />
      </SidebarLayout>
    </AppShell>
  );
}

/* ── Section Header ──────────────────────────────────────── */

function SectionHeader({
  title,
  icon,
  count,
  viewAllHref,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-gradient-to-b from-[#e8336a] to-[#7c4dff]" />
        {icon}
        <h2 className="text-base font-black text-white">{title}</h2>
        {count ? (
          <span className="rounded-lg bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-white/30">
            {count}
          </span>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-xs font-semibold text-white/35 transition-colors hover:text-white"
        >
          View All <ChevronRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}

/* ── Big grid section — shows ALL items as cards ─────────── */

function BigSection({
  title,
  icon,
  items,
  loading,
  viewAllHref,
}: {
  title: string;
  icon?: React.ReactNode;
  items?: Anime[];
  loading?: boolean;
  viewAllHref?: string;
}) {
  const allItems = items ?? [];

  return (
    <section className="border-t border-white/[0.05] py-6 first:border-t-0">
      <SectionHeader
        title={title}
        icon={icon}
        count={!loading && allItems.length > 0 ? allItems.length : undefined}
        viewAllHref={viewAllHref}
      />

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {loading
          ? Array.from({ length: 24 }).map((_, i) => (
              <div key={i}>
                <div
                  className="aspect-[2/3] animate-pulse rounded-xl bg-[#141828]"
                  style={{ animationDelay: `${i * 20}ms` }}
                />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" style={{ animationDelay: `${i * 20 + 60}ms` }} />
                <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#0d1020]" style={{ animationDelay: `${i * 20 + 100}ms` }} />
              </div>
            ))
          : allItems.map((anime, i) => (
              <AnimeGridCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i < 12} />
            ))}
      </div>
    </section>
  );
}

/* ── Anime card ──────────────────────────────────────────── */

function AnimeGridCard({ anime, priority }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const poster = posterOf(anime);
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const statusKey = (anime.status || "").toLowerCase();

  return (
    <article className="card-lift group">
      <Link href={`/anime/${id}`} onClick={() => rememberAnime(anime)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width:640px) 33vw, (max-width:1024px) 25vw, 20vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#141828] to-[#0d1020]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Airing badge */}
          {statusKey === "currently_airing" && (
            <span className="absolute right-1.5 top-1.5 flex h-4 items-center gap-1 rounded bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
              AIRING
            </span>
          )}

          {/* Episode badge */}
          {count > 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-white/80">
              EP {count}
            </span>
          )}

          {/* Score badge */}
          {anime.score ? (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-[#f0b429]">
              <Star size={7} className="fill-[#f0b429]" />
              {Number(anime.score).toFixed(1)}
            </span>
          ) : null}

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e8336a] shadow-lg shadow-[#e8336a]/40">
              <Play size={14} fill="white" className="text-white" />
            </span>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-[11px] font-semibold leading-4 text-white/80">{title}</h3>
          <p className="mt-1 text-[10px] text-white/30">{episodeLabel(anime)}</p>
        </div>
      </Link>
    </article>
  );
}
