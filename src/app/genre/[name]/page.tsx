"use client";

import { use, useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { SidebarLayout } from "@/components/sidebar";
import { catalogClientGet, mapCatalogList } from "@/lib/catalog-api";
import { genreDescription } from "@/lib/seo";
import type { Anime } from "@/lib/types";
import { animeId } from "@/lib/utils";

type CatalogPage = Parameters<typeof mapCatalogList>[0] & {
  has_more?: boolean;
  total?: number;
};

const GENRE_QUERY_VERSION = "v3";

export default function GenrePage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params);
  const genre = decodeURIComponent(rawName);
  const [page, setPage] = useState(1);
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setPage(1);
    setAllAnime([]);
  }, [genre]);

  const query = useQuery({
    queryKey: ["catalog-genre", GENRE_QUERY_VERSION, genre, page],
    queryFn: () => catalogClientGet<CatalogPage>(`/api/anime/genre/${encodeURIComponent(genre)}?limit=60&page=${page}`),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    retry: 1,
    retryDelay: 1200,
    placeholderData: keepPreviousData,
  });

  const resolvedLabel = genre.toLowerCase() === "donghua" ? "Origin" : "Genre";
  const hasMore = Boolean(query.data?.has_more);

  function loadMoreResults() {
    if (query.isFetching || !hasMore) return;
    setPage((p) => p + 1);
  }

  useEffect(() => {
    const nextItems = mapCatalogList(query.data);
    if (!nextItems.length) return;
    setAllAnime((prev) => {
      if (page === 1) return nextItems;
      const seen = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...nextItems.filter((anime) => !seen.has(animeId(anime)))];
    });
  }, [query.data, page]);

  useEffect(() => {
    if (!hasMore || query.isFetching) return;
    const nextPage = page + 1;
    queryClient.prefetchQuery({
      queryKey: ["catalog-genre", GENRE_QUERY_VERSION, genre, nextPage],
      queryFn: () => catalogClientGet<CatalogPage>(`/api/anime/genre/${encodeURIComponent(genre)}?limit=60&page=${nextPage}`),
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 90,
    });
  }, [genre, hasMore, page, query.isFetching, queryClient]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || query.isFetching || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreResults();
      },
      { rootMargin: "700px 0px 900px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, query.isFetching]);

  useEffect(() => {
    if (!hasMore || query.isFetching) return;
    const maybeLoadMore = () => {
      const sentinel = loadMoreRef.current;
      if (sentinel) {
        const rect = sentinel.getBoundingClientRect();
        if (rect.top < window.innerHeight + 1400) {
          loadMoreResults();
          return;
        }
      }
      const distance = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distance < 1400) loadMoreResults();
    };
    const id = window.setTimeout(maybeLoadMore, 120);
    window.addEventListener("scroll", maybeLoadMore, { passive: true });
    window.addEventListener("resize", maybeLoadMore);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("scroll", maybeLoadMore);
      window.removeEventListener("resize", maybeLoadMore);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnime.length, hasMore, query.isFetching]);

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          <div className="mb-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">{resolvedLabel}</p>
            <h1 className="flex items-baseline gap-3 text-2xl font-black text-white">
              {genre}
              {!query.isLoading && allAnime.length > 0 && (
                <span className="text-lg font-semibold text-white/25">{query.data?.total ?? allAnime.length} titles</span>
              )}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/42">{genreDescription(genre)}</p>
          </div>

          {query.isError ? (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <AlertCircle size={28} className="text-red-400" />
              </span>
              <div>
                <p className="text-base font-bold text-white">Failed to load</p>
                <p className="mt-1.5 max-w-xs text-sm text-white/40">Could not fetch this catalog section. Try again.</p>
              </div>
              <button
                onClick={() => query.refetch()}
                className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : query.isLoading && page === 1 ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-md border border-white/[0.07] bg-[#0d1020] px-4 py-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-white/40" />
                <p className="text-sm text-white/40">Loading {genre} anime...</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i}>
                    <div className="aspect-[2/3] animate-pulse rounded-md bg-[#141828]" style={{ animationDelay: `${i * 25}ms` }} />
                    <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" />
                    <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#0d1020]" />
                  </div>
                ))}
              </div>
            </>
          ) : allAnime.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {allAnime.map((anime, i) => (
                  <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} className="w-full" priority={i < 8} />
                ))}
              </div>

              {query.isFetching && page > 1 ? (
                <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i}>
                      <div className="aspect-[2/3] animate-pulse rounded-md bg-[#141828]" />
                      <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" />
                    </div>
                  ))}
                </div>
              ) : null}
              {hasMore ? (
                <div ref={loadMoreRef} className="mt-8 flex min-h-20 items-center justify-center">
                  <button
                    type="button"
                    onClick={loadMoreResults}
                    disabled={query.isFetching}
                    className="rounded-md border border-white/[0.08] bg-white/[0.055] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/12 hover:text-white disabled:cursor-wait disabled:opacity-45"
                  >
                    {query.isFetching ? "Loading..." : `Load more ${genre} anime`}
                  </button>
                </div>
              ) : null}
              {!hasMore ? <p className="mt-8 text-center text-xs text-white/20">All results shown</p> : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <AlertCircle size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">No results for &ldquo;{genre}&rdquo;</p>
                <p className="mt-1 text-sm text-white/40">Try a different genre name or browse the sidebar.</p>
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    </AppShell>
  );
}
