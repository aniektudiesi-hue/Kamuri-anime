"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, Loader2, RefreshCw, Search, WifiOff } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { SearchBox } from "@/components/search-box";
import { SidebarLayout } from "@/components/sidebar";
import { api } from "@/lib/api";
import {
  DISCOVERY_CHIPS,
  fetchAniListDiscovery,
  fetchJikanDiscovery,
  mergeAnimeSources,
  resolveDiscoveryIntent,
} from "@/lib/anime-discovery";
import type { Anime } from "@/lib/types";
import { animeId, rankAnimeForSearch } from "@/lib/utils";

const GENRE_LINKS = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Isekai",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
]);

export function SearchPageClient() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  );
}

function GridSkeleton({ count = 20 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-xl bg-[#141828]" style={{ animationDelay: `${i * 25}ms` }} />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" style={{ animationDelay: `${i * 25 + 80}ms` }} />
          <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#0d1020]" style={{ animationDelay: `${i * 25 + 120}ms` }} />
        </div>
      ))}
    </div>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const intent = useMemo(() => resolveDiscoveryIntent(q), [q]);
  const slowTimer = useRef<number | undefined>(undefined);
  const [isSlow, setIsSlow] = useState(false);
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const [allAnilist, setAllAnilist] = useState<Anime[]>([]);
  const [allJikan, setAllJikan] = useState<Anime[]>([]);
  const [visibleCount, setVisibleCount] = useState(18);

  useEffect(() => {
    setDiscoveryPage(1);
    setAllAnilist([]);
    setAllJikan([]);
    setVisibleCount(18);
  }, [intent.key]);

  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.length > 0 && intent.useBackend,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    retry: 1,
    retryDelay: 2000,
  });

  const anilistQ = useQuery({
    queryKey: ["anilist-discovery", intent.key, discoveryPage],
    queryFn: () => fetchAniListDiscovery(intent, discoveryPage),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
  });

  const jikanQ = useQuery({
    queryKey: ["jikan-discovery", intent.key, discoveryPage],
    queryFn: () => fetchJikanDiscovery(intent, discoveryPage),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 45,
    gcTime: 1000 * 60 * 120,
  });

  useEffect(() => {
    if (!anilistQ.data) return;
    const { media } = anilistQ.data;
    setAllAnilist((prev) => {
      if (discoveryPage === 1) return media;
      const existingIds = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...media.filter((anime) => !existingIds.has(animeId(anime)))];
    });
  }, [anilistQ.data, discoveryPage]);

  useEffect(() => {
    if (!jikanQ.data) return;
    const { media } = jikanQ.data;
    setAllJikan((prev) => {
      if (discoveryPage === 1) return media;
      const existingIds = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...media.filter((anime) => !existingIds.has(animeId(anime)))];
    });
  }, [jikanQ.data, discoveryPage]);

  useEffect(() => {
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    const reset = window.setTimeout(() => setIsSlow(false), 0);
    if (results.isLoading || anilistQ.isLoading) {
      slowTimer.current = window.setTimeout(() => setIsSlow(true), 4000);
    }
    return () => {
      window.clearTimeout(reset);
      if (slowTimer.current) window.clearTimeout(slowTimer.current);
    };
  }, [results.isLoading, anilistQ.isLoading]);

  const backendResults = intent.useBackend ? (results.data ?? []) : [];
  const mergedRaw = mergeAnimeSources(backendResults, allAnilist, allJikan);
  const merged = intent.useBackend ? rankAnimeForSearch(mergedRaw, q) : mergedRaw;
  const visibleMerged = merged.slice(0, visibleCount);
  const hasMore = Boolean(anilistQ.data?.hasNextPage || jikanQ.data?.hasNextPage);
  const isTimeout = results.error instanceof Error && results.error.message === "timeout";
  const isLoading = (results.isLoading || anilistQ.isLoading || jikanQ.isLoading) && discoveryPage === 1;
  const isLoadingMore = discoveryPage > 1 && (anilistQ.isLoading || jikanQ.isLoading);

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          <div className="mb-5 sm:hidden">
            <SearchBox />
          </div>

          {q ? (
            <div className="mb-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/70">{intent.sourceLabel}</p>
              <h1 className="flex items-baseline gap-3 text-2xl font-black text-white">
                {intent.label}
                {!isLoading && merged.length > 0 && (
                  <span className="text-lg font-semibold text-white/70">{merged.length} titles</span>
                )}
              </h1>
            </div>
          ) : (
            <div className="mb-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/70">Discover</p>
              <h1 className="text-2xl font-black text-white">Browse Anime</h1>
            </div>
          )}

          {!q && (
            <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              {DISCOVERY_CHIPS.map((chip) => (
                <a
                  key={chip}
                  href={GENRE_LINKS.has(chip) ? `/genre/${encodeURIComponent(chip)}` : `/search?q=${encodeURIComponent(chip)}`}
                  className="shrink-0 rounded-xl border border-white/[0.07] bg-[#0d1020] px-3.5 py-1.5 text-[12px] font-semibold text-white/50 transition-colors hover:border-[#cf2442]/30 hover:bg-[#cf2442]/10 hover:text-[#ff6f86]"
                >
                  {chip}
                </a>
              ))}
            </div>
          )}

          {results.isError && merged.length === 0 ? (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                {isTimeout ? <WifiOff size={28} className="text-amber-400" /> : <AlertCircle size={28} className="text-red-400" />}
              </span>
              <div>
                <p className="text-base font-bold text-white">{isTimeout ? "Server is waking up" : "Search failed"}</p>
                <p className="mt-1.5 max-w-xs text-sm text-white/40">
                  {isTimeout ? "The server was asleep. This takes 10-20 seconds. Try again." : "Something went wrong. Check your connection or try a different query."}
                </p>
              </div>
              <button
                onClick={() => results.refetch()}
                className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
              >
                <RefreshCw size={14} />
                Retry search
              </button>
            </div>
          ) : isLoading && isSlow ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Loading discovery sources</p>
                  <p className="text-xs text-amber-400/60">Your API, AniList, and MyAnimeList are being checked in parallel.</p>
                </div>
              </div>
              <GridSkeleton count={18} />
            </>
          ) : isLoading ? (
            <GridSkeleton count={18} />
          ) : merged.length > 0 ? (
            <>
              <div className="content-visibility-auto grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {visibleMerged.map((anime, i) => (
                  <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} className="w-full" priority={i < 3} />
                ))}
              </div>

              {isLoadingMore ? (
                <div className="mt-6">
                  <GridSkeleton count={12} />
                </div>
              ) : visibleMerged.length < merged.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((count) => count + 24)}
                    className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1020] px-8 py-3 text-sm font-bold text-white/60 transition-colors hover:border-white/[0.15] hover:text-white"
                  >
                    <ChevronDown size={16} />
                    Show More Results
                  </button>
                </div>
              ) : hasMore ? (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setDiscoveryPage((page) => page + 1)}
                    className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1020] px-8 py-3 text-sm font-bold text-white/60 transition-colors hover:border-white/[0.15] hover:text-white"
                  >
                    <ChevronDown size={16} />
                    Load More Results
                  </button>
                </div>
              ) : (
                <p className="mt-8 text-center text-xs text-white/20">All {merged.length} results shown</p>
              )}
            </>
          ) : !q ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <Search size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">Start searching</p>
                <p className="mt-1 text-sm text-white/40">Use the search bar above or browse a real discovery category.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <Search size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">No results for &ldquo;{q}&rdquo;</p>
                <p className="mt-1 text-sm text-white/40">Try a title, genre, seasonal query, or discovery keyword.</p>
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    </AppShell>
  );
}

function SearchFallback() {
  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          <div className="mb-5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#141828]" />
            <div className="mt-2 h-8 w-56 animate-pulse rounded-xl bg-[#141828]" />
          </div>
          <GridSkeleton count={20} />
        </div>
      </SidebarLayout>
    </AppShell>
  );
}
