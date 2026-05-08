"use client";

import { useQueries } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AnimeRow, LazyAnimeRow } from "@/components/anime-row";
import { HeroCarousel } from "@/components/hero-carousel";
import { api } from "@/lib/api";

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
      <AnimeRow title="Fast Picks" items={thumbnails.data} loading={thumbnails.isLoading} priorityCards />
      <LazyAnimeRow title="Recently Added" items={recent.data} loading={recent.isLoading} />
      <LazyAnimeRow title="Top Rated" items={topRated.data} loading={topRated.isLoading} />
    </AppShell>
  );
}
