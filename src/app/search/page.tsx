"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Search, WifiOff, Loader2, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { SidebarLayout } from "@/components/sidebar";
import { api } from "@/lib/api";
import type { Anime } from "@/lib/types";
import { animeId, rankAnimeForSearch } from "@/lib/utils";

type AniListMedia = {
  idMal: number | null; id: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string };
  averageScore: number | null;
  episodes: number | null;
  status: string;
};

const ANILIST_STATUS: Record<string, string> = {
  RELEASING: "currently_airing", FINISHED: "finished_airing",
  NOT_YET_RELEASED: "not_yet_aired", CANCELLED: "finished_airing", HIATUS: "finished_airing",
};

function mapAniList(item: AniListMedia): Anime {
  return {
    mal_id: item.idMal ? String(item.idMal) : String(item.id),
    title: item.title.english || item.title.romaji,
    image_url: item.coverImage.large,
    score: item.averageScore ? item.averageScore / 10 : undefined,
    episodes: item.episodes ?? undefined,
    status: ANILIST_STATUS[item.status] || item.status.toLowerCase(),
  };
}

async function fetchAniListSearch(q: string, page: number): Promise<{ media: Anime[]; hasNextPage: boolean }> {
  const gql = `
    query Search($q: String!, $page: Int!) {
      Page(page: $page, perPage: 30) {
        pageInfo { hasNextPage }
        media(search: $q, type: ANIME, sort: POPULARITY_DESC) {
          idMal id title { romaji english } coverImage { large } averageScore episodes status
        }
      }
    }
  `;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { q, page } }),
    });
    if (!res.ok) return { media: [], hasNextPage: false };
    const json = await res.json() as { data?: { Page?: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } } };
    const pageData = json.data?.Page;
    return {
      media: (pageData?.media ?? []).filter((m) => m.idMal || m.id).map(mapAniList),
      hasNextPage: pageData?.pageInfo?.hasNextPage ?? false,
    };
  } catch {
    return { media: [], hasNextPage: false };
  }
}

const GENRE_CHIPS = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Horror", "Isekai", "Mecha", "Mystery", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural",
];

export default function SearchPage() {
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
  const slowTimer = useRef<number | undefined>(undefined);
  const [isSlow, setIsSlow] = useState(false);

  // AniList pagination state
  const [anilistPage, setAnilistPage] = useState(1);
  const [allAnilist, setAllAnilist] = useState<Anime[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Reset AniList state when query changes
  useEffect(() => {
    setAnilistPage(1);
    setAllAnilist([]);
    setHasMore(false);
  }, [q]);

  // Backend search
  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    retry: 1,
    retryDelay: 2000,
  });

  // AniList — always runs in parallel (not just fallback)
  const anilistQ = useQuery({
    queryKey: ["anilist-search", q, anilistPage],
    queryFn: () => fetchAniListSearch(q, anilistPage),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
  });

  // Accumulate AniList pages as user loads more
  useEffect(() => {
    if (!anilistQ.data) return;
    const { media, hasNextPage } = anilistQ.data;
    setAllAnilist((prev) => {
      if (anilistPage === 1) return media;
      const existingIds = new Set(prev.map((a) => animeId(a)));
      return [...prev, ...media.filter((a) => !existingIds.has(animeId(a)))];
    });
    setHasMore(hasNextPage);
  }, [anilistQ.data, anilistPage]);

  useEffect(() => {
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    const reset = window.setTimeout(() => setIsSlow(false), 0);
    if (results.isLoading) {
      slowTimer.current = window.setTimeout(() => setIsSlow(true), 4000);
    }
    return () => {
      window.clearTimeout(reset);
      if (slowTimer.current) window.clearTimeout(slowTimer.current);
    };
  }, [results.isLoading]);

  const backendResults = rankAnimeForSearch(results.data ?? [], q);
  const backendIds = new Set(backendResults.map((a) => animeId(a)));

  // Merge: backend first, then AniList-only items (anything the backend missed)
  const anilistOnly = allAnilist.filter((a) => !backendIds.has(animeId(a)));
  const merged = [...backendResults, ...anilistOnly];

  const isTimeout = results.error instanceof Error && results.error.message === "timeout";
  const isLoading = results.isLoading || (anilistPage === 1 && anilistQ.isLoading);
  const isLoadingMore = anilistPage > 1 && anilistQ.isLoading;

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          {/* Page header */}
          {q ? (
            <div className="mb-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Search results</p>
              <h1 className="flex items-baseline gap-3 text-2xl font-black text-white">
                &ldquo;{q}&rdquo;
                {!isLoading && merged.length > 0 && (
                  <span className="text-lg font-semibold text-white/25">{merged.length} titles</span>
                )}
              </h1>
            </div>
          ) : (
            <div className="mb-5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">Discover</p>
              <h1 className="text-2xl font-black text-white">Browse Anime</h1>
            </div>
          )}

          {/* Genre chips (only when no query) */}
          {!q && (
            <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              {GENRE_CHIPS.map((g) => (
                <a
                  key={g}
                  href={`/genre/${encodeURIComponent(g)}`}
                  className="shrink-0 rounded-xl border border-white/[0.07] bg-[#0d1020] px-3.5 py-1.5 text-[12px] font-semibold text-white/50 transition-colors hover:border-[#e8336a]/30 hover:bg-[#e8336a]/10 hover:text-[#e8336a]"
                >
                  {g}
                </a>
              ))}
            </div>
          )}

          {/* Error */}
          {results.isError && merged.length === 0 ? (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                {isTimeout ? <WifiOff size={28} className="text-amber-400" /> : <AlertCircle size={28} className="text-red-400" />}
              </span>
              <div>
                <p className="text-base font-bold text-white">{isTimeout ? "Server is waking up" : "Search failed"}</p>
                <p className="mt-1.5 max-w-xs text-sm text-white/40">
                  {isTimeout ? "The server was asleep. This takes 10–20 seconds. Try again." : "Something went wrong. Check your connection or try a different query."}
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

          /* Loading slow */
          ) : isLoading && isSlow ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Server is waking up</p>
                  <p className="text-xs text-amber-400/60">Results will appear shortly — server starts cold on first use.</p>
                </div>
              </div>
              <GridSkeleton count={20} />
            </>

          /* Loading fast */
          ) : isLoading ? (
            <GridSkeleton count={20} />

          /* Results */
          ) : merged.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {merged.map((anime, i) => (
                  <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} className="w-full" priority={i < 8} />
                ))}
              </div>

              {/* Load more / loading more skeleton */}
              {isLoadingMore ? (
                <div className="mt-6">
                  <GridSkeleton count={12} />
                </div>
              ) : hasMore ? (
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => setAnilistPage((p) => p + 1)}
                    className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1020] px-8 py-3 text-sm font-bold text-white/60 transition-colors hover:border-white/[0.15] hover:text-white"
                  >
                    <ChevronDown size={16} />
                    Load More Results
                  </button>
                </div>
              ) : merged.length > 0 ? (
                <p className="mt-8 text-center text-xs text-white/20">All {merged.length} results shown</p>
              ) : null}
            </>

          /* No query */
          ) : !q ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <Search size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">Start searching</p>
                <p className="mt-1 text-sm text-white/40">Use the search bar above to find any anime.</p>
              </div>
            </div>

          /* No results */
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <Search size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">No results for &ldquo;{q}&rdquo;</p>
                <p className="mt-1 text-sm text-white/40">Try a different title, genre, or keyword.</p>
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
