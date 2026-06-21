"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MoreVertical, Search, SlidersHorizontal, X } from "lucide-react";
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
  fetchSearchAllFormats,
  resolveDiscoveryIntent,
} from "@/lib/anime-discovery";
import { KairoState } from "@/components/mascot/kairo";
import { SearchFeatured, SearchFeaturedSkeleton, wideImageOf } from "@/components/search-featured";
import { CR_CARD_QUERY_VERSION, fetchCrCard } from "@/lib/catalog-api";
import { imageCdnUrl, warmImageCdn } from "@/lib/image-cdn";
import { rememberSearchCatalog } from "@/lib/search-index";
import type { Anime, LibraryItem } from "@/lib/types";
import { HISTORY_UPDATED_EVENT, animeId, animePath, episodeCount, posterOf, rawPosterOf, rememberAnime, rememberedHistory, searchMatchTier, searchRelevanceScore, titleOf } from "@/lib/utils";

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

const DISCOVERY_QUERY_VERSION = "v3";
const warmedSearchPosters = new Set<string>();

// Run a low-priority side effect during browser idle time; returns a cleanup
// that cancels it if the component unmounts (or deps change) first.
function runWhenIdle(fn: () => void, timeout = 1000): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, Math.min(timeout, 200));
  return () => window.clearTimeout(id);
}


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

const SEARCH_GRID = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6";

function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className={SEARCH_GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-[#1b1b1f]" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[#1b1b1f]" />
          <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded bg-[#141417]" />
        </div>
      ))}
    </div>
  );
}

// The search loading splash — a smooth red "wave" that plays in the results area
// (below the search bar) while results organize. Replaces the old spinner so it
// never feels like buffering.
function SearchWave() {
  return (
    <div className="grid min-h-[58vh] place-items-center bg-black" style={{ animation: "fadeIn 220ms ease-out" }}>
      <div className="flex flex-col items-center gap-5">
        <div className="atv-search-wave" aria-hidden="true">
          <span /><span /><span /><span /><span /><span /><span /><span /><span />
        </div>
        <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-white/45">Searching</p>
      </div>
    </div>
  );
}

function MobileSearchResults({ items, query, section }: { items: Anime[]; query: string; section?: FormatKey }) {
  if (section) {
    const sectionItems = items.filter((anime) => mediaFormat(anime) === section);
    return (
      <div className="space-y-5 bg-black pb-24 sm:hidden" style={{ animation: "fadeIn 150ms ease-out" }}>
        <h1 className="text-[28px] font-black tracking-[-0.03em] text-white">{formatLabel(section)} Only</h1>
        <MobileResultSection title="" items={sectionItems} />
      </div>
    );
  }
  const top = items.slice(0, 3);
  const topIds = new Set(top.map((anime) => animeId(anime)));
  const remaining = items.filter((anime) => !topIds.has(animeId(anime)));
  const groups = [
    { key: "TV", title: "Series", items: remaining.filter((anime) => mediaFormat(anime) === "TV").slice(0, 3) },
    { key: "MOVIE", title: "Movies", items: remaining.filter((anime) => mediaFormat(anime) === "MOVIE").slice(0, 3) },
    { key: "ONA", title: "ONA", items: remaining.filter((anime) => mediaFormat(anime) === "ONA").slice(0, 3) },
    { key: "OVA", title: "OVA", items: remaining.filter((anime) => mediaFormat(anime) === "OVA").slice(0, 3) },
  ].filter((group) => group.items.length);

  return (
    <div className="space-y-9 bg-black pb-24 sm:hidden" style={{ animation: "fadeIn 150ms ease-out" }}>
      <MobileResultSection title="Top Results" items={top} priority />
      {groups.map((group) => (
        <MobileResultSection key={group.key} title={group.title} items={group.items} viewAllHref={`/browse?q=${encodeURIComponent(query)}&fmt=${group.key}&title=${encodeURIComponent(`${group.title} Only`)}`} />
      ))}
    </div>
  );
}

function MobileResultSection({ title, items, priority, viewAllHref }: { title: string; items: Anime[]; priority?: boolean; viewAllHref?: string }) {
  return (
    <section>
      {title ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[28px] font-normal tracking-[-0.03em] text-white">{title}</h2>
          {viewAllHref ? <Link href={viewAllHref} className="relative z-10 -mr-2 rounded px-2 py-1 text-[15px] font-bold text-[#c4182a]">View All</Link> : null}
        </div>
      ) : null}
      {items.length ? (
        <div className="space-y-4">
          {items.map((anime, index) => (
            <MobileResultRow key={`${animeId(anime)}-${index}`} anime={anime} priority={Boolean(priority && index === 0)} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// A genuine LANDSCAPE image (CR keyart, detail banner, or an AniList bannerImage)
// — never the portrait cr_poster. Items that have one render as a wide 16:9 card;
// AniList-only results (no wide art) fall back to a normal 9:16 poster card so they
// are shown crisp and un-stretched.
function searchWideArt(anime: Anime): string {
  if (anime.cr_wide) return imageCdnUrl(anime.cr_wide, "banner-md");
  if (anime.detail_banner) return imageCdnUrl(anime.detail_banner, "banner-md");
  const banner = anime.banner || "";
  if (/anilist|anili\.st/i.test(banner)) return imageCdnUrl(banner, "banner-md");
  return "";
}

function MobileResultRow({ anime, priority }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const format = formatLabel(mediaFormat(anime));
  const dub = (anime as { has_dub?: boolean }).has_dub ? "Dub English | Sub" : "Subtitled";
  const wideSrc = searchWideArt(anime);
  const wide = Boolean(wideSrc);

  return (
    <Link href={animePath(anime, id)} onClick={() => rememberAnime(anime)} className="flex items-center gap-4">
      <div className={`relative shrink-0 overflow-hidden rounded-md bg-[#111] ${wide ? "aspect-video w-[44vw]" : "aspect-[2/3] w-[23vw]"}`}>
        <ResilientSearchImage anime={anime} priority={priority} wide={wide} wideSrc={wideSrc} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[19px] font-bold leading-tight text-white">{title}</h3>
        <p className="mt-2 text-[15px] font-medium text-white/56">{count > 0 ? `${count} Episodes` : "Episodes"}</p>
        <p className="mt-2.5 line-clamp-1 text-[15px] font-medium text-white/82">
          <span className="text-[#4cc4c8]">{format}</span>
          <span className="text-white/45"> • </span>
          {dub}
        </p>
      </div>
      <MoreVertical size={24} className="shrink-0 text-white/62" />
    </Link>
  );
}

function ResilientSearchImage({ anime, priority, wide, wideSrc }: { anime: Anime; priority?: boolean; wide?: boolean; wideSrc?: string }) {
  const [index, setIndex] = useState(0);
  const posterCandidates = [
    imageCdnUrl(rawPosterOf(anime), "poster-sm"),
    imageCdnUrl(anime.image_url, "poster-sm"),
    imageCdnUrl(anime.poster, "poster-sm"),
    posterOf(anime, "poster-sm"),
  ];
  // Wide cards lead with the landscape art (poster only as an error fallback);
  // portrait cards are posters straight up — no stretching either way.
  const ordered = wide && wideSrc ? [wideSrc, ...posterCandidates] : posterCandidates;
  const candidates = ordered.filter((src, i, arr): src is string => Boolean(src) && arr.indexOf(src) === i);
  const src = candidates[index];
  if (!src) return <div className="absolute inset-0 bg-[#111]" />;
  return (
    <Image
      key={src}
      src={src}
      alt=""
      fill
      sizes={wide ? "44vw" : "23vw"}
      unoptimized
      priority={priority}
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? undefined : "lazy"}
      className="object-cover object-center"
      onError={() => setIndex((value) => Math.min(value + 1, candidates.length))}
    />
  );
}

function mediaFormat(anime: Anime): FormatKey {
  const fmt = (anime.format || "").toUpperCase();
  if (fmt === "TV" || fmt === "MOVIE" || fmt === "ONA" || fmt === "OVA" || fmt === "SPECIAL") return fmt;
  return "TV";
}

function formatLabel(format: FormatKey) {
  if (format === "MOVIE") return "Movie";
  if (format === "ONA") return "ONA";
  if (format === "OVA") return "OVA";
  if (format === "SPECIAL") return "Special";
  return "Series";
}

function normalizeSection(value: string | null): FormatKey | undefined {
  const section = (value || "").toUpperCase();
  if (section === "TV" || section === "MOVIE" || section === "ONA" || section === "OVA" || section === "SPECIAL") return section;
  return undefined;
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

const RECENT_SEARCHES_KEY = "atv-recent-searches";
const MAX_RECENT = 8;

function saveRecentSearch(query: string) {
  if (!query.trim() || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    const updated = [query, ...prev.filter((s) => s !== query)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch { /* best-effort */ }
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function removeRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(prev.filter((s) => s !== query)));
  } catch { /* best-effort */ }
}

function SearchContent({ initialData }: { initialData?: SearchInitialData }) {
  const params = useSearchParams();
  const urlQ = params.get("q")?.trim() ?? "";
  const section = normalizeSection(params.get("section"));
  const [q, setQ] = useState(urlQ);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => { setQ(urlQ); }, [urlQ]);

  const onCommit = useCallback((next: string) => {
    setQ(next);
    if (next) {
      saveRecentSearch(next);
      setRecentSearches(loadRecentSearches());
    }
    const url = next ? `/search?q=${encodeURIComponent(next)}${section ? `&section=${section}` : ""}` : "/search";
    window.history.replaceState(window.history.state, "", url);
  }, [section]);

  const onRemoveRecent = useCallback((s: string) => {
    removeRecentSearch(s);
    setRecentSearches(loadRecentSearches());
  }, []);

  const onClearAll = useCallback(() => {
    setRecentSearches([]);
  }, []);

  return (
    <SearchContentBody
      q={q}
      section={section}
      onCommit={onCommit}
      initialData={initialData}
      recentSearches={recentSearches}
      onRemoveRecent={onRemoveRecent}
      onClearAll={onClearAll}
    />
  );
}

// Search box with LOCAL state. Typing never triggers the expensive results grid.
const SearchField = memo(function SearchField({
  initial,
  onCommit,
  recentSearches,
  onRemoveRecent,
  onClearAll,
}: {
  initial: string;
  onCommit: (value: string) => void;
  recentSearches: string[];
  onRemoveRecent: (s: string) => void;
  onClearAll: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const lastCommitted = useRef(initial);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }, 260);
    return () => clearTimeout(id);
  }, [value, onCommit]);

  const showDropdown = focused && !value && recentSearches.length > 0;

  function selectRecent(s: string) {
    setValue(s);
    lastCommitted.current = s;
    onCommit(s);
    setFocused(false);
  }

  return (
    <div className="relative">
      <div className="-mx-4 mb-2 flex h-[68px] items-center gap-4 bg-[#202126] px-4 sm:mx-0 sm:h-auto sm:rounded-none sm:border-b-2 sm:border-white/15 sm:bg-transparent sm:px-0 sm:py-2">
        <Link href="/" aria-label="Back" className="grid h-11 w-8 shrink-0 place-items-center text-white sm:hidden">
          <ArrowLeft size={31} />
        </Link>
        <Search size={20} className={`pointer-events-none hidden shrink-0 transition-colors duration-150 sm:block ${focused ? "text-[#c4182a]" : "text-white/40"}`} />
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          placeholder="Search anime"
          aria-label="Search anime"
          className="w-full bg-transparent text-[25px] font-black tracking-[-0.03em] text-white caret-[#c4182a] placeholder:text-white/30 focus:outline-none sm:text-2xl sm:font-semibold"
        />
        {value ? (
          <button
            type="button"
            onClick={() => { setValue(""); inputRef.current?.focus(); }}
            aria-label="Clear"
            className="grid h-11 w-11 shrink-0 place-items-center text-white/90 transition hover:text-white"
          >
            <X size={31} />
          </button>
        ) : null}
      </div>

      {/* Recent searches dropdown */}
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#16171d] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Recent</span>
            <button
              type="button"
              onClick={() => { window.localStorage.removeItem(RECENT_SEARCHES_KEY); onClearAll(); }}
              className="text-[12px] font-semibold text-white/40 hover:text-white/70"
            >
              Clear all
            </button>
          </div>
          {recentSearches.map((s) => (
            <div key={s} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.05]">
              <Clock size={15} className="shrink-0 text-white/35" />
              <button
                type="button"
                className="flex-1 text-left text-[16px] font-medium text-white/80"
                onClick={() => selectRecent(s)}
              >
                {s}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveRecent(s); }}
                className="shrink-0 text-white/25 hover:text-white/60"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function SearchContentBody({
  q,
  section,
  onCommit,
  initialData,
  recentSearches,
  onRemoveRecent,
  onClearAll,
}: {
  q: string;
  section?: FormatKey;
  onCommit: (value: string) => void;
  initialData?: SearchInitialData;
  recentSearches: string[];
  onRemoveRecent: (s: string) => void;
  onClearAll: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const intent = useMemo(() => resolveDiscoveryIntent(q), [q]);
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
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [selectedFormats, setSelectedFormats] = useState<Set<FormatKey>>(new Set());
  const [facets, setFacets] = useState<DiscoveryFacets | undefined>(() => (initialMatches ? initialData.facets : undefined));
  const resetGuardRef = useRef(true);
  const prevQueryRef = useRef("");
  useEffect(() => { setSelectedFormats(new Set()); }, [intent.key]);

  // On a new query/intent, reset pagination but KEEP the previous query's
  // results + total on screen until the new backend response lands, then swap
  // grid and count together (atomically, via the copy effect below). Wiping to
  // [] here used to make the grid fall back to the local-cache instantResults
  // and THEN reshuffle when the remote results arrived â€” a visible two-phase
  // churn ("results change on their own after typing", unrelated partial-word
  // matches flashing in and out). keepPreviousData (on anilistQ) holds the prior
  // data, and the copy effect only applies data matching the CURRENT intent, so
  // grid+count never diverge â€” they update in one clean swap.
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
    // If the new query just REFINES the previous one (prefix-related, e.g.
    // "nar" → "naru", or backspacing "naru" → "nar"), keep the already-fetched
    // anime on screen — visibleMerged instantly re-filters them to the new query,
    // so the listing adjusts with NO wipe, NO wave, no re-fetch flicker. The
    // background fetch still runs and swaps in the fresh/complete set when ready.
    const prev = prevQueryRef.current;
    const curr = q.trim().toLowerCase();
    const prevNorm = prev.trim().toLowerCase();
    const related = curr.length > 0 && prevNorm.length > 0 && (curr.startsWith(prevNorm) || prevNorm.startsWith(curr));
    prevQueryRef.current = q;

    setDiscoveryPage(1);
    if (!related) {
      setAllAnilist([]);
      setResultTotal(0);
      setFacets(undefined);
    }
  }, [intent.key, initialData, initialMatches, q]);

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
    queryKey: ["anilist-discovery", DISCOVERY_QUERY_VERSION, intent.key, q, "ALL", discoveryPage],
    queryFn: async () => {
      // Page 1 renders from the SINGLE fast "ALL" call so results paint instantly.
      // The slower per-format completeness pass runs separately (enrichQ below) and
      // appends in the background — so one slow format never holds the whole grid
      // hostage ("only CR showed, the rest came a minute later").
      const result = await fetchAniListDiscovery(intent, discoveryPage, "ALL", discoveryPage === 1 ? 12000 : undefined);
      return { intentKey: intent.key, fmtKey: "ALL" as FormatKey, ...result };
    },
    enabled: true,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    initialData: initialMatches && discoveryPage === 1 && initialData
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
    if (anilistQ.data.intentKey !== intent.key) return;
    const { media } = anilistQ.data;
    setResultTotal(Number(anilistQ.data.total || media.length || 0));
    if (anilistQ.data.facets) setFacets(anilistQ.data.facets);
    setAllAnilist((prev) => {
      if (discoveryPage === 1) return media;
      const existingIds = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...media.filter((anime) => !existingIds.has(animeId(anime)))];
    });
  }, [anilistQ.data, discoveryPage, intent.key]);

  // Background completeness pass for TEXT search: pulls every format in parallel
  // and APPENDS anything the fast ALL call missed (e.g. extra movies/OVAs) plus
  // exact per-format facet counts — without ever blocking the initial paint.
  const isTextQuery = Boolean(intent.search);
  // Run the 6-call completeness pass ONLY after the fast single "ALL" call has
  // already returned for THIS query. Firing all 7 requests at once starved the
  // ALL call of the browser's ~6 connections-per-host, making the visible
  // results crawl in. Sequencing keeps first results ~instant; extras append.
  const enrichQ = useQuery({
    queryKey: ["search-enrich", DISCOVERY_QUERY_VERSION, intent.key, q],
    queryFn: async () => ({ intentKey: intent.key, ...(await fetchSearchAllFormats(intent, 1, 9000)) }),
    enabled: isTextQuery && discoveryPage === 1 && anilistQ.isSuccess && anilistQ.data?.intentKey === intent.key,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
  });

  useEffect(() => {
    if (!enrichQ.data || enrichQ.data.intentKey !== intent.key) return;
    if (enrichQ.data.facets) setFacets((prev) => ({ ...(prev ?? {}), ...enrichQ.data!.facets } as DiscoveryFacets));
    setResultTotal((prev) => Math.max(prev, Number(enrichQ.data!.total || 0)));
    setAllAnilist((prev) => {
      const ids = new Set(prev.map((anime) => animeId(anime)));
      const extra = enrichQ.data!.media.filter((anime) => !ids.has(animeId(anime)));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, [enrichQ.data, intent.key]);

  const mergedRaw = allAnilist;
  const merged = selectedFormats.size > 0 ? mergedRaw.filter((a) => selectedFormats.has(mediaFormat(a))) : mergedRaw;

  const formatCounts: Record<FormatKey, number> = facets ?? { ALL: resultTotal, TV: 0, MOVIE: 0, OVA: 0, ONA: 0, SPECIAL: 0 };

  const isTextSearch = Boolean(intent.search);

  // Re-rank the loaded page. For a TEXT query relevance is the PRIMARY key, so a
  // 100% title match wins even if it's an ONA â€” we never force a TV result above
  // an exact match. CR-mapped + TV-first only break ties WITHIN the same relevance
  // tier. Browse/genre views (no real relevance) keep CR-first then TV-first.
  // Multi-season TV entries are collapsed to their ROOT series so the grid shows
  // one card per show (no "Season 2" / "Part 2"); movies/ONA/OVA stay separate.
  const visibleMerged = useMemo(() => {
    const tier = new Map<Anime, number>();
    const rel = new Map<Anime, number>();
    if (q) merged.forEach((a) => { tier.set(a, searchMatchTier(a, q)); rel.set(a, searchRelevanceScore(a, q)); });
    const titleLen = (a: Anime) => titleOf(a).length;
    const sorted = merged
      .map((a, i) => ({ a, i }))
      .sort((x, y) => {
        if (q && isTextSearch) {
          // 1) closest MATCH (exact > prefix > substring) â€” most accurate first.
          const t = (tier.get(y.a) ?? 0) - (tier.get(x.a) ?? 0);
          if (t) return t;
          // 2) text relevance, 3) TV/series first, 4) shortest title/root,
          // 5) CR-mapped only as a final tie-breaker. Search accuracy beats art.
          const r = (rel.get(y.a) ?? 0) - (rel.get(x.a) ?? 0);
          if (r) return r;
          const fr = formatRank(x.a) - formatRank(y.a);
          if (fr) return fr;
          const len = titleLen(x.a) - titleLen(y.a);
          if (len) return len;
          const cr = crRank(x.a) - crRank(y.a);
          if (cr) return cr;
        } else {
          const cr = crRank(x.a) - crRank(y.a);
          if (cr) return cr;
          if (q) {
            const fr = formatRank(x.a) - formatRank(y.a);
            if (fr) return fr;
          }
        }
        return x.i - y.i;
      })
      .map((o) => o.a);
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const seenRoots = new Set<string>();
    // Normalized titles of TV roots already kept â€” used to fold "<Root> ... Arc/
    // Saga" entries (e.g. Demon Slayer's Swordsmith Village / Mugen Train arcs)
    // into the root series. Items are sorted shortest-title-first, so the bare root
    // is always seen before its arcs. Gated on the trailing "arc/saga" word so it
    // never merges genuinely separate franchises (Naruto vs Naruto: Shippuden,
    // Bleach vs Bleach: Thousand-Year Blood War).
    const keptTvNorms: string[] = [];
    const deduped = sorted.filter((a) => {
      const id = animeId(a);
      if (id && seenIds.has(id)) return false;
      const normalTitle = (a.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalTitle.length > 3 && seenTitles.has(normalTitle)) return false;
      // Collapse TV seasons to the root series (only the first/best is kept).
      if ((a.format || "").toUpperCase() === "TV") {
        const root = seasonRootKey(titleOf(a));
        if (root.length > 2) {
          if (seenRoots.has(root)) return false;
          seenRoots.add(root);
        }
        const isArc = /\b(arc|saga)\s*$/i.test(titleOf(a));
        if (isArc && keptTvNorms.some((p) => normalTitle.startsWith(p) && normalTitle.length > p.length + 2)) {
          return false;
        }
        if (normalTitle.length > 3) keptTvNorms.push(normalTitle);
      }
      if (id) seenIds.add(id);
      if (normalTitle.length > 3) seenTitles.add(normalTitle);
      return true;
    });
    // For a TEXT search, drop backend fuzzy noise (e.g. "God Mars" / "Kaiju No. 8"
    // for "attack") â€” keep only genuine matches. A non-matching title scores only
    // its capped ctx (â‰¤ ~88), far below the 200 floor, so any item that clears it is
    // a real title/word hit. We keep ALL genuine matches and only fall back to the
    // unfiltered set when there are NONE â€” otherwise collapsing a multi-season show
    // down to one card could drop the genuine count under an arbitrary threshold and
    // let unrelated trending titles flood back in (the "flips to Kaiju No. 8" bug).
    if (q && isTextSearch) {
      const relevant = deduped.filter((a) => titleHasQuery(a, q));
      if (relevant.length >= 1) return relevant;
      const strongBackendMatches = deduped.filter((a) => (rel.get(a) ?? 0) >= 360);
      return strongBackendMatches.slice(0, 18);
    }
    return deduped;
  }, [merged, q, isTextSearch]);

  // The featured top-3 lead the page. For a TEXT search they must be GENUINELY
  // relevant â€” only items that actually match the query (â‰¥ all-words tier) qualify,
  // so "overflow" never pads the row with unrelated titles. Browse/genre uses the
  // top-3 by rank. The grid is everything else (by id, so nothing is shown twice).
  const featuredItems = useMemo(() => {
    if (!q) return [];
    if (!isTextSearch) return visibleMerged.slice(0, 3);
    return visibleMerged.filter((a) => titleHasQuery(a, q)).slice(0, 3);
  }, [q, isTextSearch, visibleMerged]);
  const showFeatured = featuredItems.length >= 1;
  // The wide featured row is DESKTOP-ONLY. So the grid keeps EVERY item (phones
  // show the full list with no featured row); on desktop the featured items are
  // hidden from the grid (`lg:hidden`) since they appear in the wide row above.
  const gridItems = visibleMerged;
  const featuredIdSet = useMemo(
    () => (showFeatured ? new Set(featuredItems.map((a) => animeId(a))) : new Set<string>()),
    [showFeatured, featuredItems],
  );

  // CR-style sections: with NO format facet active, split the grid (everything
  // after the featured top-3) into titled groups â€” Series, Movies, â€¦ â€” like the
  // Crunchyroll results page. A facet narrows the set to one format, so we render
  // flat in that case.
  const gridSections = useMemo(() => {
    if (selectedFormats.size > 0) return null;
    const order: { key: FormatKey; label: string }[] = [
      { key: "TV", label: "Series" },
      { key: "MOVIE", label: "Movies" },
      { key: "ONA", label: "ONA" },
      { key: "OVA", label: "OVA" },
      { key: "SPECIAL", label: "Specials" },
    ];
    const bucket = (a: Anime): FormatKey => {
      const f = (a.format || "").toUpperCase();
      if (f === "TV" || f === "MOVIE" || f === "ONA" || f === "OVA") return f;
      return "SPECIAL";
    };
    const groups = new Map<FormatKey, Anime[]>();
    for (const a of gridItems) {
      const b = bucket(a);
      const arr = groups.get(b) ?? [];
      arr.push(a);
      groups.set(b, arr);
    }
    return order.map((s) => ({ ...s, items: groups.get(s.key) ?? [] })).filter((s) => s.items.length);
  }, [gridItems, selectedFormats]);

  // Auto-start the top-3 in the background the moment they appear: prefetch each
  // one's full CR season tree (the exact query the detail page reads) and warm
  // its wide banner, and cache a paint-stub. Opening any featured result is then
  // instant â€” season list + banner are already in memory, no spinner.
  const featuredKey = featuredItems.map((a) => animeId(a)).join(",");
  useEffect(() => {
    if (!featuredItems.length || typeof window === "undefined") return;
    for (const anime of featuredItems) {
      const malId = animeId(anime);
      if (!malId) continue;
      queryClient
        .prefetchQuery({
          queryKey: ["cr-card-full", CR_CARD_QUERY_VERSION, malId],
          queryFn: () => fetchCrCard(malId, 1, true),
          staleTime: 1000 * 60 * 30,
        })
        .catch(() => undefined);
      // Warm the EXACT image the featured card shows (CR thumbnail / AniList
      // banner) so it's already cached by paint â€” never a hero/detail crop.
      warmImageCdn(wideImageOf(anime) || posterOf(anime, "poster-md"), "banner-md");
      rememberAnime(anime);
    }
  // featuredKey collapses the array identity to its ids so this fires only when
  // the actual top-3 change, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredKey, queryClient]);
  const hasMore = Boolean(anilistQ.data?.hasNextPage);
  const hasRenderableResults = merged.length > 0;
  // True from the moment a facet is clicked until that facet's data is applied â€”
  // we render a skeleton in this window instead of the previous facet's stale items.
  const isLoading = !hasRenderableResults && anilistQ.isLoading && discoveryPage === 1;
  const isLoadingMore = discoveryPage > 1 && anilistQ.isFetching;
  const shownTotal = resultTotal || merged.length;
  // For a TEXT search the grid is deduped + season/arc-collapsed + relevance-
  // filtered down to genuine matches, so the raw backend total (e.g. 28 "naruto"
  // catalog rows incl. movies/specials/dupes) overstates what's on screen â€” the
  // "28 available but only 2 showing" mismatch. Show the count we ACTUALLY render.
  // Browse/genre keeps the real catalog total ("12,345 titles").
  const displayCount = isTextSearch ? visibleMerged.length : shownTotal;
  const canLoadMore = hasMore;

  // "Not found" must ONLY appear once EVERYTHING has genuinely answered for the
  // CURRENT query and produced nothing on screen. While the fast ALL call OR the
  // background enrich pass is still in flight — or their data hasn't been merged
  // into the grid yet — we keep the wave up. This kills the "Kairo couldn't find…"
  // flash that blinked in while results were still loading (even for famous
  // titles). Uses gridItems (what's actually shown) as the source of truth.
  const searchStillLoading =
    Boolean(q) &&
    (anilistQ.isFetching ||
      anilistQ.data?.intentKey !== intent.key ||
      (isTextQuery && (enrichQ.isFetching || (enrichQ.fetchStatus === "idle" && !enrichQ.isFetched))));
  const backendSettledEmpty = Boolean(q) && !searchStillLoading && gridItems.length === 0;

  function loadMoreResults() {
    if (isLoading || isLoadingMore) return;
    if (hasMore) setDiscoveryPage((page) => page + 1);
  }

  function toggleFormat(key: FormatKey) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (key === "ALL") { next.clear(); return next; }
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  useEffect(() => {
    if (!anilistQ.data?.hasNextPage || anilistQ.isFetching) return;
    for (const nextPage of [discoveryPage + 1, discoveryPage + 2]) {
      queryClient.ensureQueryData({
        queryKey: ["anilist-discovery", DISCOVERY_QUERY_VERSION, intent.key, q, "ALL", nextPage],
        queryFn: async () => ({ intentKey: intent.key, fmtKey: "ALL" as FormatKey, ...(await fetchAniListDiscovery(intent, nextPage, "ALL")) }),
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 90,
      }).catch(() => undefined);
    }
  }, [anilistQ.data?.hasNextPage, anilistQ.isFetching, discoveryPage, intent, q, queryClient]);

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

  // Both of these are pure side effects (index write + image prewarm) that the
  // perf trace flagged as main-thread long tasks during load. Defer them to idle
  // so they never compete with the LCP image or first interaction.
  useEffect(() => {
    if (!allAnilist.length) return;
    return runWhenIdle(() => rememberSearchCatalog(allAnilist), 1200);
  }, [allAnilist]);

  useEffect(() => {
    if (!visibleMerged.length) return;
    return runWhenIdle(() => warmAnimePosters(visibleMerged, 6), 1500);
  }, [visibleMerged]);

  // Show the wave splash ONLY in the results area (never over the search bar) and
  // only while a query is genuinely loading with nothing yet to show — so typing
  // stays smooth and there's no full-screen buffering flash on every keystroke.
  const showSearchWave = Boolean(q) && gridItems.length === 0 && !backendSettledEmpty;

  return (
    <AppShell hideMobileChrome>
      <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
        <div className="min-h-[calc(100vh-96px)] py-6">
          {/* Sticky search bar — stays pinned so scrolling results never collide
              with (or hide) the input + header. */}
          <div className="sticky top-0 z-40 mb-6 bg-black">
            <SearchField initial={q} onCommit={onCommit} recentSearches={recentSearches} onRemoveRecent={onRemoveRecent} onClearAll={onClearAll} />
          </div>
          {!q ? <div className="min-h-[calc(100vh-160px)] bg-black sm:hidden" /> : null}
          <div className={!q ? "hidden sm:block" : ""}>

          {q ? (
            <div className="mb-5 hidden sm:block">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">{intent.sourceLabel}</p>
              <h1 className="flex items-baseline gap-3 text-2xl font-semibold text-white">
                {intent.label}
                {mounted && displayCount > 0 && (
                  <span className="text-lg font-medium text-white/70">{displayCount.toLocaleString()} {displayCount === 1 ? "title" : "titles"}</span>
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
            <div className="no-scrollbar -mx-4 mb-5 hidden items-center gap-2 overflow-x-auto px-4 pb-1 sm:flex lg:mx-0 lg:px-0">
              {FORMAT_FACETS.map((facet) => {
                void formatCounts;
                const active = facet.key === "ALL" ? selectedFormats.size === 0 : selectedFormats.has(facet.key);
                return (
                  <button
                    key={facet.key}
                    type="button"
                    onClick={() => toggleFormat(facet.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-[12px] font-semibold transition-colors duration-[160ms] ${
                      active
                        ? "border-[#c4182a]/60 bg-[#c4182a]/16 text-white"
                        : "border-white/[0.08] bg-[#0c0c0e] text-white/55 hover:border-[#c4182a]/35 hover:text-white/85"
                    }`}
                  >
                    {facet.label}
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

          {/* Featured top-3 (16:9 wide CR keyart) lead the page, ABOVE the grid.
              A same-size skeleton reserves the space so nothing jumps while the
              query resolves. */}
          {/* Wide featured row â€” DESKTOP ONLY (phones get the plain grid). */}
          {isDesktop && q && showFeatured ? (
            <SearchFeatured items={featuredItems} />
          ) : isDesktop && q && (isLoading || (merged.length === 0 && anilistQ.isFetching)) ? (
            <SearchFeaturedSkeleton />
          ) : null}

          <div ref={resultsScrollRef} className={`mt-3 ${q ? "min-h-[720px]" : ""}`} style={{ overflowAnchor: "none" }}>
            {showSearchWave ? (
              isDesktop ? <GridSkeleton count={24} /> : <SearchWave />
            ) : gridItems.length > 0 ? (
              <>
                {q && !isDesktop ? <MobileSearchResults items={gridItems} query={q} section={section} /> : null}
                {isDesktop ? (
                <div style={{ animation: "fadeIn 150ms ease-out" }}>
                  {gridSections ? (
                    gridSections.map((section, si) => (
                      <div key={section.key} className={si > 0 ? "mt-9" : ""}>
                        <h2 className="mb-4 text-xl font-bold tracking-tight text-white">{section.label}</h2>
                        <div className={SEARCH_GRID}>
                          {section.items.map((anime, i) => (
                            <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} priority={si === 0 && i < 6} fastImage className={featuredIdSet.has(animeId(anime)) ? "w-full lg:hidden" : "w-full"} />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <h2 className="mb-4 text-xl font-bold tracking-tight text-white">Results</h2>
                      <div className={SEARCH_GRID}>
                        {gridItems.map((anime, i) => (
                          <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i < 6} fastImage className={featuredIdSet.has(animeId(anime)) ? "w-full lg:hidden" : "w-full"} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                ) : null}

                {isLoadingMore ? (
                  <div className="mt-6">
                    <GridSkeleton count={12} />
                  </div>
                ) : visibleMerged.length >= merged.length && !hasMore ? (
                  <p className="mt-8 text-center text-xs text-white/20">All {displayCount.toLocaleString()} results shown</p>
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
            ) : merged.length > 0 ? (
              // All matches fit in the featured row (â‰¤3 results) â€” nothing more.
              null
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

// Normalize a TV title to its ROOT-series key by stripping trailing season / part
// / cour markers, so "Attack on Titan", "Attack on Titan Season 2" and "Attack on
// Titan Final Season" collapse to one. Conservative: it removes ONLY clear season
// markers â€” it does NOT cut subtitles after ":" (so "Naruto" and "Naruto:
// Shippuden" stay distinct).
function seasonRootKey(title: string): string {
  let t = (title || "").toLowerCase().trim();
  t = t.replace(/\b(the\s+)?(final\s+)?season\s*\d*\b.*$/i, "");
  t = t.replace(/\b\d+(st|nd|rd|th)\s+season\b.*$/i, "");
  t = t.replace(/\bpart\s*\d+\b.*$/i, "");
  t = t.replace(/\bcour\s*\d+\b.*$/i, "");
  t = t.replace(/\b2nd|3rd|4th\b.*$/i, "");
  t = t.replace(/\s+(ii|iii|iv|v|vi|vii)\s*$/i, "");
  return t.replace(/[^a-z0-9]+/g, " ").trim();
}

function titleHasQuery(anime: Anime, query: string) {
  const title = expandSearchAliases(normalizeSearchText([
    titleOf(anime),
    anime.title_en,
    anime.title_jp,
    (anime as { romaji_title?: string }).romaji_title,
    (anime as { canonical_title?: string }).canonical_title,
    (anime as { native_title?: string }).native_title,
  ].filter(Boolean).join(" ")));
  const alias = SEARCH_ALIASES[normalizeSearchText(query)];
  if (alias) return alias.every((token) => title.includes(token));
  // Only require meaningful words (length >= 3) to match so stop words like
  // "of"/"in"/"no" don't cause mismatches (e.g. "eminence of shadow" vs "Eminence in Shadow").
  const tokens = expandSearchAliases(normalizeSearchText(query))
    .split(" ")
    .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token));
  if (!tokens.length) return false;
  return tokens.every((token) => title.includes(token) || title.split(" ").some((word) => word.startsWith(token)));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function expandSearchAliases(value: string) {
  let out = value;
  for (const [needle, replacement] of SEARCH_PHRASE_ALIASES) {
    if (out.includes(needle)) out = `${out} ${replacement}`;
  }
  return out;
}

const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "in", "into", "of", "on", "the", "to", "wo", "no", "de"]);

const SEARCH_PHRASE_ALIASES: Array<[string, string]> = [
  ["harem in the labyrinth", "isekai meikyuu harem"],
  ["labyrinth of another world", "isekai meikyuu"],
  ["worlds end harem", "shuumatsu harem"],
  ["world s end harem", "shuumatsu harem"],
  ["pseudo harem", "giji harem"],
  ["samurai harem", "asu yoichi"],
  ["eminence in shadow", "kage jitsuryokusha"],
  ["eminence of shadow", "eminence in shadow kage jitsuryokusha"],
];

const SEARCH_ALIASES: Record<string, string[]> = {
  aot: ["attack", "titan"],
  snk: ["shingeki", "kyojin"],
  jjk: ["jujutsu", "kaisen"],
  kny: ["kimetsu", "yaiba"],
  ds: ["demon", "slayer"],
  mha: ["hero", "academia"],
  bnha: ["hero", "academia"],
  opm: ["one", "punch", "man"],
  cote: ["classroom", "elite"],
  "eminence shadow": ["eminence", "shadow"],
  "eminence of shadow": ["eminence", "shadow"],
};

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
    if (values.size < 4) values.add(chip);
  });
  return Array.from(values).slice(0, 4);
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
