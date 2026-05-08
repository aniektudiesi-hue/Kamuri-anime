"use client";

import { useQueries } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AnimeRow, LazyAnimeRow } from "@/components/anime-row";
import { HeroCarousel } from "@/components/hero-carousel";
import { api } from "@/lib/api";
import type { Anime } from "@/lib/types";
import { animeId, episodeCount, episodeLabel, posterOf, rememberAnime, titleOf } from "@/lib/utils";

export default function Home() {
  const [banners, thumbnails, recent, topRated] = useQueries({
    queries: [
      { queryKey: ["banners"], queryFn: api.banners, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120 },
      { queryKey: ["thumbnails"], queryFn: api.thumbnails, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120 },
      { queryKey: ["recent"], queryFn: api.recentlyAdded, staleTime: 1000 * 60 * 20, gcTime: 1000 * 60 * 90 },
      { queryKey: ["top-rated"], queryFn: api.topRated, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120 },
    ],
  });

  return (
    <AppShell>
      <HeroCarousel items={banners.data} loading={banners.isLoading} />
      <HomeDashboard popular={thumbnails.data} recent={recent.data} loading={thumbnails.isLoading || recent.isLoading} />
      <AnimeRow title="Fast Picks" items={thumbnails.data} loading={thumbnails.isLoading} priorityCards />
      <LazyAnimeRow title="Latest Releases" items={recent.data} loading={recent.isLoading} />
      <LazyAnimeRow title="Top Rated" items={topRated.data} loading={topRated.isLoading} />
    </AppShell>
  );
}

function HomeDashboard({ popular, recent, loading }: { popular?: Anime[]; recent?: Anime[]; loading?: boolean }) {
  const popularItems = (popular ?? []).slice(0, 5);
  const latestItems = (recent ?? []).slice(0, 12);
  const chips = ["Action", "Adventure", "Comedy", "Fantasy", "Romance", "School", "Sci-Fi", "Supernatural", "Drama", "Isekai", "Mystery", "Sports"];

  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-md border border-white/10 bg-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">Popular Today</h2>
          <Link href="/search?q=popular" className="text-sm font-bold text-accent-2 hover:text-white">View more</Link>
        </div>
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded bg-panel-strong" />)}
          </div>
        ) : (
          <div className="grid gap-3">
            {popularItems.map((anime, index) => {
              const id = animeId(anime);
              return (
                <Link key={`${id}-${index}`} href={`/anime/${id}`} onClick={() => rememberAnime(anime)} className="group grid grid-cols-[36px_56px_1fr_auto] items-center gap-3 rounded-md bg-panel-strong p-2 hover:bg-white/10">
                  <span className="text-center text-lg font-black text-accent-2">{index + 1}</span>
                  <span className="relative h-16 overflow-hidden rounded bg-black/30">
                    {posterOf(anime) ? <Image src={posterOf(anime)} alt="" fill sizes="56px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 font-bold group-hover:text-accent-2">{titleOf(anime)}</span>
                    <span className="mt-1 block text-xs text-muted">TV • {episodeLabel(anime)} • Sub</span>
                  </span>
                  <span className="rounded bg-accent/15 px-2 py-1 text-xs font-black text-accent-2">Watch</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <aside className="rounded-md border border-white/10 bg-panel p-4">
        <h2 className="text-xl font-black">Quick Filter</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link key={chip} href={`/search?q=${encodeURIComponent(chip)}`} className="rounded-md bg-panel-strong px-3 py-2 text-sm font-semibold text-muted hover:bg-white/10 hover:text-white">
              {chip}
            </Link>
          ))}
        </div>
      </aside>

      <div className="rounded-md border border-white/10 bg-panel p-4 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">Latest Release</h2>
          <Link href="/search?q=spring 2026" className="text-sm font-bold text-accent-2 hover:text-white">View all</Link>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {loading
            ? Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded bg-panel-strong" />)
            : latestItems.map((anime, index) => {
                const id = animeId(anime);
                const count = episodeCount(anime);
                return (
                  <Link key={`${id}-${index}`} href={count > 0 ? `/watch/${id}/${count}` : `/anime/${id}`} onClick={() => rememberAnime(anime)} className="flex items-center justify-between gap-3 rounded-md bg-panel-strong px-3 py-2 hover:bg-white/10">
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-sm font-bold">{titleOf(anime)}</span>
                      <span className="text-xs text-muted">{count > 0 ? `Episode ${count}` : "Episode TBA"}</span>
                    </span>
                    <span className="rounded bg-black/35 px-2 py-1 text-xs font-bold text-accent-2">Sub</span>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
