"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { SearchBox } from "@/components/search-box";
import { SidebarLayout } from "@/components/sidebar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DISCOVERY_CHIPS,
  type DiscoveryFacets,
  fetchAniListDiscovery,
  resolveDiscoveryIntent,
} from "@/lib/anime-discovery";
import { KairoState } from "@/components/mascot/kairo";
import { localSearchAnime, rememberSearchCatalog } from "@/lib/search-index";
import type { Anime, LibraryItem } from "@/lib/types";
import { HISTORY_UPDATED_EVENT, animeId, posterOf, rememberedHistory, titleOf } from "@/lib/utils";

const GENRE_LINKS = new Set([
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Harem",
  "Ecchi",
  "Erotica",
  "Isekai",
  "Dungeon",
  "Reincarnation",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Martial Arts",
  "Demons",
]);

const DISCOVERY_QUERY_VERSION = "v2";
const warmedSearchPosters = new Set<string>();

export type SearchInitialData = {
  intentKey: string;
  fmtKey: FormatKey;
  page: number;
  media: Anime[];
  hasNextPage: boolean;
  total: number;
  count: number;
  facets?: DiscoveryFacets;
};

export function SearchPageClient({ initialData }: { initialData?: SearchInitialData }) {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent initialData={initialData} />
    </Suspense>
  );
}

const SEARCH_GRID = "grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";

function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className={SEARCH_GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-[#1b1b1f]" style={{ animationDelay: `${i * 20}ms` }} />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[#1b1b1f]" style={{ animationDelay: `${i * 20 + 70}ms` }} />
          <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded bg-[#141417]" style={{ animationDelay: `${i * 20 + 110}ms` }} />
        </div>
      ))}
    </div>
  );
}

function warmAnimePosters(items: Anime[], priorityCount = 0) {
  if (typeof window === "undefined" || !items.length) return;
  for (const [index, anime] of items.slice(0, 18).entries()) {
    const poster = posterOf(anime, "poster-sm");
    if (!poster || warmedSearchPosters.has(poster)) continue;
    warmedSearchPosters.add(poster);
    const image = new window.Image();
    image.decoding = "async";
    (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = index < priorityCount ? "high" : "low";
    image.src = poster;
  }
}

function SearchContent({ initialData }: { initialData?: SearchInitialData }) {
  const params = useSearchParams();
  const urlQ = params.get("q")?.trim() ?? "";
  const [q, setQ] = useState(urlQ);

  // External URL changes (header search submit, category links) sync into the box.
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Commit a typed query: update the heavy results view + the URL. The keystrokes
  // themselves live entirely inside <SearchField> (local state), so typing never
  // waits on this big component tree to re-render — the search box stays smooth.
  const onCommit = useCallback((next: string) => {
    setQ(next);
    const url = next ? `/search?q=${encodeURIComponent(next)}` : "/search";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return <SearchContentBody q={q} onCommit={onCommit} initialData={initialData} />;
}

// Search box with LOCAL state. A child's own state change does not re-render its
// parent, so typing here never triggers the expensive results-grid render. The
// committed value is debounced up to the parent.
const SearchField = memo(function SearchField({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const lastCommitted = useRef(initial);
  // Re-sync ONLY on genuinely external changes (chip nav, header submit). Without
  // the guard, the parent echoes our own just-committed value back as `initial`
  // mid-keystroke and resets the input — dropping characters and jumping the
  // cursor (the "typing lags" bug). Comparing against what we last committed
  // tells our own echo apart from a real external change.
  useEffect(() => {
    if (initial !== lastCommitted.current) {
      lastCommitted.current = initial;
      setValue(initial);
    }
  }, [initial]);
  useEffect(() => {
    const id = setTimeout(() => {
      const next = value.trim();
      lastCommitted.current = next;
      onCommit(next);
    }, 140);
    return () => clearTimeout(id);
  }, [value, onCommit]);
  return (
    <div className="relative flex items-center border-b-2 border-white/15 transition focus-within:border-[#c4182a]">
      <Search size={20} className="pointer-events-none shrink-0 text-white/40" />
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search anime..."
        aria-label="Search anime"
        className="w-full bg-transparent px-3 py-2.5 text-xl font-medium text-white placeholder:text-white/30 focus:outline-none sm:text-2xl"
      />
      {value ? (
        <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="shrink-0 px-1 text-white/40 transition hover:text-white">
          <X size={20} />
        </button>
      ) : null}
    </div>
  );
});

function SearchContentBody({
  q,
  onCommit,
  initialData,
}: {
  q: string;
  onCommit: (value: string) => void;
  initialData?: SearchInitialData;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const intent = useMemo(() => resolveDiscoveryIntent(q), [q]);
  const instantResults = useMemo(() => localSearchAnime(q, 30), [q]);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const initialMatches = initialData?.intentKey === intent.key && initialData?.fmtKey === "ALL" && initialData.page === 1;
  const [allAnilist, setAllAnilist] = useState<Anime[]>(() => (initialMatches ? initialData.media : []));
  const [resultTotal, setResultTotal] = useState(() => (initialMatches ? initialData.total : 0));
  const [localHistory, setLocalHistory] = useState<LibraryItem[]>([]);
  // The result count is fully client-derived (instant cache + AniList), so the
  // SSR value never matches the post-fetch value. Render it only after mount to
  // avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Filter UI: format facet + collapsible panel. CR-mapped titles always rank
  // first regardless of facet, so the on-brand catalog leads every genre/search.
  const [formatFilter, setFormatFilter] = useState<FormatKey>("ALL");
  const [facets, setFacets] = useState<DiscoveryFacets | undefined>(() => (initialMatches ? initialData.facets : undefined));
  const [, startFilterTransition] = useTransition();
  const resetGuardRef = useRef(true);
  useEffect(() => setFormatFilter("ALL"), [intent.key]);

  // On a new query/intent, drop the previous query's accumulated results and
  // total immediately. Without this the grid keeps showing the OLD query's
  // cards (and the header/count can diverge from the grid) until the new fetch
  // lands — the "UI dhoka" / phone "count updates but page doesn't" bug. The
  // instant local-cache results (instantResults) fill the gap with no flash.
  useEffect(() => {
    if (resetGuardRef.current) {
      resetGuardRef.current = false;
      if (initialMatches && initialData) {
        setDiscoveryPage(1);
        setAllAnilist(initialData.media);
        setResultTotal(initialData.total);
        setFacets(initialData.facets);
        return;
      }
    }
    setDiscoveryPage(1);
    setAllAnilist([]);
    setResultTotal(0);
  }, [intent.key, formatFilter, initialData, initialMatches]);

  useEffect(() => {
    const refresh = () => setLocalHistory(rememberedHistory(12));
    refresh();
    window.addEventListener(HISTORY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, refresh);
  }, []);

  const serverHistory = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10,
  });

  const suggestionQueries = useMemo(
    () => buildHistorySuggestions(localHistory, serverHistory.data),
    [localHistory, serverHistory.data],
  );

  const anilistQ = useQuery({
    queryKey: ["anilist-discovery", DISCOVERY_QUERY_VERSION, intent.key, q, formatFilter, discoveryPage],
    queryFn: async () => ({ intentKey: intent.key, fmtKey: formatFilter, ...(await fetchAniListDiscovery(intent, discoveryPage, formatFilter)) }),
    enabled: true,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    initialData: initialMatches && formatFilter === "ALL" && discoveryPage === 1 && initialData
      ? {
        intentKey: initialData.intentKey,
        fmtKey: initialData.fmtKey,
        media: initialData.media,
        hasNextPage: initialData.hasNextPage,
        total: initialData.total,
        count: initialData.count,
        page: initialData.page,
        facets: initialData.facets,
      }
      : undefined,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!anilistQ.data) return;
    if (anilistQ.data.intentKey !== intent.key || anilistQ.data.fmtKey !== formatFilter) return;
    const { media } = anilistQ.data;
    setResultTotal(Number(anilistQ.data.total || media.length || 0));
    if (anilistQ.data.facets) setFacets(anilistQ.data.facets);
    setAllAnilist((prev) => {
      if (discoveryPage === 1) return media;
      const existingIds = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...media.filter((anime) => !existingIds.has(animeId(anime)))];
    });
  }, [anilistQ.data, discoveryPage, intent.key, formatFilter]);

  // Instant local-cache results render in <1ms while the live query loads.
  const mergedRaw = allAnilist.length ? allAnilist : instantResults;
  const merged = mergedRaw;

  // Authoritative per-format counts from the backend (computed over the WHOLE
  // result set in one response) — fixed numbers that never grow as pages load.
  const formatCounts: Record<FormatKey, number> = facets ?? { ALL: resultTotal, TV: 0, MOVIE: 0, OVA: 0, ONA: 0, SPECIAL: 0 };

  // Backend already applies the format facet (fmt=) + total/pagination. Here we
  // only re-rank within the loaded page: CR-mapped first, then TV-first for text
  // queries, preserving backend relevance order within each bucket.
  const visibleMerged = useMemo(() => {
    const sorted = merged
      .map((a, i) => ({ a, i }))
      .sort((x, y) => {
        const cr = crRank(x.a) - crRank(y.a);
        if (cr) return cr;
        if (q) {
          const fr = formatRank(x.a) - formatRank(y.a);
          if (fr) return fr;
        }
        return x.i - y.i;
      })
      .map((o) => o.a);
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    return sorted.filter((a) => {
      const id = animeId(a);
      if (id && seenIds.has(id)) return false;
      const normalTitle = (a.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalTitle.length > 3 && seenTitles.has(normalTitle)) return false;
      if (id) seenIds.add(id);
      if (normalTitle.length > 3) seenTitles.add(normalTitle);
      return true;
    });
  }, [merged, q]);
  const hasMore = Boolean(anilistQ.data?.hasNextPage);
  const hasRenderableResults = merged.length > 0;
  const isLoading = !hasRenderableResults && anilistQ.isLoading && discoveryPage === 1;
  const isLoadingMore = discoveryPage > 1 && anilistQ.isFetching;
  const shownTotal = resultTotal || merged.length;
  const canLoadMore = hasMore;

  function loadMoreResults() {
    if (isLoading || isLoadingMore) return;
    if (hasMore) setDiscoveryPage((page) => page + 1);
  }

  function chooseFormatFilter(key: FormatKey) {
    startFilterTransition(() => setFormatFilter(key));
  }

  useEffect(() => {
    if (!anilistQ.data?.hasNextPage || anilistQ.isFetching) return;
    for (const nextPage of [discoveryPage + 1, discoveryPage + 2]) {
      queryClient.ensureQueryData({
        queryKey: ["anilist-discovery", DISCOVERY_QUERY_VERSION, intent.key, q, formatFilter, nextPage],
        queryFn: async () => ({ intentKey: intent.key, fmtKey: formatFilter, ...(await fetchAniListDiscovery(intent, nextPage, formatFilter)) }),
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 90,
      }).catch(() => undefined);
    }
  }, [anilistQ.data?.hasNextPage, anilistQ.isFetching, discoveryPage, intent, q, formatFilter, queryClient]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || isLoading || isLoadingMore) return;
    if (visibleMerged.length === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        loadMoreResults();
      },
      { root: resultsScrollRef.current, rootMargin: "1800px 0px 2200px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoading, isLoadingMore, merged.length, visibleMerged.length]);

  useEffect(() => {
    if (!canLoadMore || isLoading || isLoadingMore) return;
    const onScroll = () => {
      const distance = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distance < 2200) loadMoreResults();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadMore, isLoading, isLoadingMore, merged.length, visibleMerged.length]);

  useEffect(() => {
    if (allAnilist.length) rememberSearchCatalog(allAnilist);
  }, [allAnilist]);

  useEffect(() => {
    if (!visibleMerged.length) return;
    warmAnimePosters(visibleMerged, 6);
  }, [visibleMerged]);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
        <div className="min-h-[calc(100vh-96px)] py-6">
          <div className="mb-6">
            <SearchField initial={q} onCommit={onCommit} />
          </div>

          {q ? (
            <div className="mb-5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">{intent.sourceLabel}</p>
              <h1 className="flex items-baseline gap-3 text-2xl font-semibold text-white">
                {intent.label}
                {mounted && shownTotal > 0 && (
                  <span className="text-lg font-medium text-white/70">{shownTotal.toLocaleString()} titles available</span>
                )}
              </h1>
            </div>
          ) : (
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">Full Database</p>
                <h1 className="flex items-baseline gap-3 text-2xl font-bold tracking-tight text-white sm:text-[28px]">
                  Explore Anime
                  {mounted && shownTotal > 0 ? <span className="text-base font-medium text-white/55">{shownTotal.toLocaleString()} titles</span> : null}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-white/40">
                <SlidersHorizontal size={14} />
                <span>Crunchyroll titles first</span>
              </div>
            </div>
          )}

          {mounted && merged.length > 0 ? (
            <div className="no-scrollbar -mx-4 mb-5 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
              {FORMAT_FACETS.map((facet) => {
                const n = formatCounts[facet.key] ?? 0;
                if (facet.key !== "ALL" && n === 0) return null;
                const active = formatFilter === facet.key;
                return (
                  <button
                    key={facet.key}
                    type="button"
                    onClick={() => chooseFormatFilter(facet.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-[160ms] ${
                      active
                        ? "border-[#c4182a]/60 bg-[#c4182a]/16 text-white"
                        : "border-white/[0.08] bg-[#0c0c0e] text-white/55 hover:border-[#c4182a]/35 hover:text-white/85"
                    }`}
                  >
                    {facet.label}
                    <span className={active ? "text-white/70" : "text-white/35"}>{n.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!q && (
            <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              {DISCOVERY_CHIPS.map((chip) => (
                <a
                  key={chip}
                  href={chip === "Explore" ? "/search" : GENRE_LINKS.has(chip) ? `/genre/${encodeURIComponent(chip)}` : `/search?q=${encodeURIComponent(chip)}`}
                  className={`shrink-0 rounded-[4px] border px-3.5 py-1.5 text-[12px] font-medium transition-colors duration-[160ms] ${
                    chip === "Explore"
                      ? "border-[#c4182a]/50 bg-[#c4182a]/14 text-white"
                      : "border-white/[0.08] bg-[#0c0c0e] text-white/50 hover:border-[#c4182a]/35 hover:bg-[#c4182a]/10 hover:text-white/80"
                  }`}
                >
                  {chip}
                </a>
              ))}
            </div>
          )}

          {q && !isLoading && merged.length > 0 ? (
            <h2 className="mb-4 text-xl font-bold tracking-tight text-white">Results</h2>
          ) : null}

          <div ref={resultsScrollRef} className={q ? "min-h-[720px]" : ""} style={{ overflowAnchor: "none" }}>
            {isLoading ? (
              <GridSkeleton count={24} />
            ) : merged.length > 0 ? (
              <>
                <div className={SEARCH_GRID}>
                  {visibleMerged.map((anime, i) => (
                    <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i < 6} fastImage className="w-full" />
                  ))}
                </div>

                {isLoadingMore ? (
                  <div className="mt-6">
                    <GridSkeleton count={12} />
                  </div>
                ) : visibleMerged.length >= merged.length && !hasMore ? (
                  <p className="mt-8 text-center text-xs text-white/20">All {shownTotal.toLocaleString()} results shown</p>
                ) : null}
                {canLoadMore && !isLoadingMore ? (
                  <div ref={loadMoreRef} className="mt-8 flex min-h-20 items-center justify-center">
                    <button
                      type="button"
                      onClick={loadMoreResults}
                      className="rounded-[4px] border border-white/[0.08] bg-[#0c0c0e] px-5 py-2.5 text-sm font-semibold text-white/70 transition-colors duration-[160ms] hover:border-[#c4182a]/35 hover:bg-[#c4182a]/10 hover:text-white"
                    >
                      Load more results
                    </button>
                  </div>
                ) : null}
              </>
            ) : q && anilistQ.isFetching ? (
              <GridSkeleton count={12} />
            ) : q ? (
              <KairoState
                mood="notfound"
                title={`Kairo couldn't find "${q}" yet`}
                subtitle="Try another title, check the spelling, or explore a genre instead."
                action={{ label: "Explore anime", href: "/search" }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// TV first, then ONA, then unknowns, then specials/OVAs/movies/music last.
const FORMAT_RANK: Record<string, number> = { TV: 0, ONA: 1, SPECIAL: 3, OVA: 4, MOVIE: 5, MUSIC: 6 };
function formatRank(anime: Anime) {
  const fmt = (anime.format || "").toUpperCase();
  return fmt in FORMAT_RANK ? FORMAT_RANK[fmt] : 2;
}

// Filter facets. MUSIC + unknowns collapse into SPECIAL so every title lands in
// exactly one bucket (no anime disappears when a facet is active).
type FormatKey = "ALL" | "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
const FORMAT_FACETS: { key: FormatKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TV", label: "Series" },
  { key: "MOVIE", label: "Movies" },
  { key: "OVA", label: "OVA" },
  { key: "ONA", label: "ONA" },
  { key: "SPECIAL", label: "Specials" },
];
// CR-mapped titles sort ahead of everything else.
function crRank(anime: Anime) {
  return anime.cr_mapped ? 0 : 1;
}

function HistorySuggestions({ queries }: { queries: string[] }) {
  if (!queries.length) return null;
  return (
    <section className="mb-6 rounded-md border border-white/[0.06] bg-[#0d1020]/72 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#c4182a]">Suggested for you</p>
          <p className="mt-1 text-xs font-medium text-white/42">Based on what you were watching</p>
        </div>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {queries.map((query) => (
          <Link
            key={query}
            href={GENRE_LINKS.has(query) ? `/genre/${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}`}
            className="shrink-0 rounded-md border border-white/[0.075] bg-white/[0.045] px-3 py-2 text-xs font-medium text-white/72 transition hover:border-[#c4182a]/35 hover:bg-[#c4182a]/12 hover:text-white"
          >
            {query}
          </Link>
        ))}
      </div>
    </section>
  );
}

function buildHistorySuggestions(localItems: LibraryItem[], serverItems: LibraryItem[] | undefined) {
  const values = new Set<string>();
  [...localItems, ...(serverItems ?? [])].forEach((item) => {
    const title = titleOf(item);
    if (title && title !== "Untitled") values.add(title);
  });
  ["Airing", "Top Rated", "Isekai", "Fantasy", "Action", "Reincarnation", "Dungeon", "Romance"].forEach((chip) => {
    if (values.size < 10) values.add(chip);
  });
  return Array.from(values).slice(0, 10);
}

function SearchFallback() {
  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          <div className="mb-5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#141828]" />
            <div className="mt-2 h-8 w-56 animate-pulse rounded-md bg-[#141828]" />
          </div>
          <GridSkeleton count={20} />
        </div>
      </SidebarLayout>
    </AppShell>
  );
}
