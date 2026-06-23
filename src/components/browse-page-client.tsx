"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Cast, Check, ChevronDown, ListFilter, MoreVertical, Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BufferingScreen } from "@/components/buffering-screen";
import { ProgressiveImage } from "@/components/progressive-image";
import { mapCatalogList } from "@/lib/catalog-api";
import type { Anime } from "@/lib/types";
import { animeId, animePath, posterOf, rememberAnime, titleOf } from "@/lib/utils";

type CatalogPayload = Parameters<typeof mapCatalogList>[0] & { has_more?: boolean };
type BrowseResult = { items: Anime[]; hasMore: boolean };
const SEARCH_DISCOVERY_BASE = "https://animetvplus-proxy.amanosan994.workers.dev";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Harem", "Isekai", "Mystery",
  "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Music",
  "Ecchi", "Horror", "Mecha", "Martial Arts", "Demons", "Dungeon", "Reincarnation", "Vampire",
];
const GENRE_EXPANSIONS: Record<string, string[]> = {
  Harem: ["Harem", "Romance", "Ecchi", "School"],
  Isekai: ["Isekai", "Fantasy", "Adventure", "Reincarnation", "Dungeon"],
  Dungeon: ["Dungeon", "Fantasy", "Adventure", "Isekai"],
  Reincarnation: ["Reincarnation", "Isekai", "Fantasy"],
  Demons: ["Demons", "Supernatural", "Action", "Fantasy"],
  Vampire: ["Vampire", "Supernatural", "Horror", "Romance"],
  "Martial Arts": ["Martial Arts", "Action", "Sports"],
  Psychological: ["Psychological", "Mystery", "Thriller"],
  Romance: ["Romance", "Comedy", "Drama", "Slice of Life"],
  Ecchi: ["Ecchi", "Harem", "Comedy"],
};
const FORMATS = [
  { key: "TV", label: "Series" },
  { key: "MOVIE", label: "Movies" },
  { key: "ONA", label: "ONA" },
  { key: "OVA", label: "OVA" },
  { key: "SPECIAL", label: "Specials" },
];

async function fetchBrowsePage(page: number, fmt: string, genre: string, q: string, sort: string): Promise<CatalogPayload> {
  const params = new URLSearchParams({ limit: "60", page: String(page) });
  if (fmt) params.set("fmt", fmt);
  if (genre) params.set("genre", genre);
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  const response = await fetch(`${SEARCH_DISCOVERY_BASE}/api/search?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Failed to load browse catalog");
  return (await response.json()) as CatalogPayload;
}

async function fetchBrowseMulti(
  page: number,
  fmts: string[],
  genres: string[],
  q: string,
  sort: string,
): Promise<BrowseResult> {
  const fmtList = fmts.length ? fmts : [""];
  const genreList = genres.length ? expandGenres(genres) : [""];
  const calls = fmtList.flatMap((fmt) => genreList.map((genre) => fetchBrowsePage(page, fmt, genre, q, sort)));
  const settled = await Promise.allSettled(calls);
  const rawResults = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const seen = new Set<string>();
  const items: Anime[] = [];
  for (const raw of rawResults) {
    for (const anime of mapCatalogList(raw)) {
      const id = animeId(anime);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push(anime);
    }
  }
  return { items, hasMore: rawResults.some((r) => r.has_more ?? false) };
}

function expandGenres(genres: string[]) {
  const seen = new Set<string>();
  for (const genre of genres) {
    for (const next of GENRE_EXPANSIONS[genre] || [genre]) seen.add(next);
  }
  return Array.from(seen);
}

export function BrowsePageClient({ initialItems = [] }: { initialItems?: Anime[] }) {
  const params = useSearchParams();
  const initialFmt = (params.get("fmt") || "").toUpperCase();
  const initialGenre = params.get("genre") || "";
  const searchQuery = params.get("q") || "";
  const sort = params.get("sort") || "";
  const forcedTitle = params.get("title") || "";

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Anime[]>(initialItems);
  const [genresOpen, setGenresOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Multi-select active filters
  const [activeFmts, setActiveFmts] = useState<string[]>(initialFmt ? [initialFmt] : []);
  const [activeGenres, setActiveGenres] = useState<string[]>(initialGenre ? [initialGenre] : []);

  // Draft (uncommitted) selections
  const [draftFmts, setDraftFmts] = useState<string[]>(initialFmt ? [initialFmt] : []);
  const [draftGenres, setDraftGenres] = useState<string[]>(initialGenre ? [initialGenre] : []);
  const [chromeVisible, setChromeVisible] = useState(true);

  const queryKey = useMemo(
    () => ["mobile-browse-v3", page, activeFmts.slice().sort().join(","), activeGenres.slice().sort().join(","), searchQuery, sort],
    [page, activeFmts, activeGenres, searchQuery, sort],
  );

  const query = useQuery<BrowseResult>({
    queryKey,
    queryFn: () => fetchBrowseMulti(page, activeFmts, activeGenres, searchQuery, sort),
    initialData: page === 1 && !activeFmts.length && !activeGenres.length && !searchQuery && initialItems.length
      ? { items: initialItems, hasMore: true }
      : undefined,
    staleTime: 1000 * 60 * 20,
  });

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextFmts = initialFmt ? [initialFmt] : [];
    const nextGenres = initialGenre ? [initialGenre] : [];
    setActiveFmts(nextFmts);
    setActiveGenres(nextGenres);
    setDraftFmts(nextFmts);
    setDraftGenres(nextGenres);
    setPage(1);
  }, [initialFmt, initialGenre]);

  useEffect(() => {
    const next = query.data?.items;
    if (!next?.length) return;
    setItems((prev) => {
      if (page === 1) return next;
      const seen = new Set(prev.map((anime) => animeId(anime)));
      return [...prev, ...next.filter((anime) => !seen.has(animeId(anime)))];
    });
    // Preload images for scroll smoothness
    const preload = () => {
      for (const [i, anime] of next.entries()) {
        const src = posterOf(anime, "poster-sm");
        if (!src) continue;
        const img = new window.Image();
        img.decoding = "async";
        (img as HTMLImageElement & { fetchPriority?: "auto" | "high" | "low" }).fetchPriority = i < 8 ? "high" : "low";
        img.src = src;
      }
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(preload, { timeout: 500 });
    else globalThis.setTimeout(preload, 100);
  }, [query.data, page]);

  useEffect(() => {
    setPage(1);
    setItems(!activeFmts.length && !activeGenres.length && !searchQuery ? initialItems : []);
  }, [activeFmts, activeGenres, searchQuery, sort, initialItems]);

  const hasMore = query.data?.hasMore ?? false;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore || query.isFetching) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPage((v) => v + 1); },
      { rootMargin: "900px 0px 1200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, query.isFetching]);

  useEffect(() => {
    if (!hasMore || query.isFetching) return;
    const onScroll = () => {
      const ratio = (window.scrollY + window.innerHeight) / Math.max(1, document.documentElement.scrollHeight);
      if (ratio > 0.75) setPage((v) => v + 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, query.isFetching]);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setChromeVisible(y < 20 || y < lastY);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleDraftFmt(key: string) {
    setDraftFmts((prev) => prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]);
  }
  function toggleDraftGenre(genre: string) {
    setDraftGenres((prev) => prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]);
  }
  function applyFilters() {
    setActiveFmts(draftFmts);
    setActiveGenres(draftGenres);
    setFilterOpen(false);
  }
  function clearFilters() {
    setDraftFmts([]);
    setDraftGenres([]);
    setActiveFmts([]);
    setActiveGenres([]);
    setFilterOpen(false);
  }

  const activeCount = activeFmts.length + activeGenres.length;
  const heading = forcedTitle || (activeGenres.length === 1 ? activeGenres[0] : searchQuery ? "Results" : activeGenres.length > 1 ? "Mixed Genres" : "Popular");

  return (
    <AppShell hideMobileChrome hideMobileBottomNav={false}>
      <main className="min-h-screen bg-black px-4 pb-28 pt-6 sm:px-6">
        <div className={`sticky -top-1 z-40 -mx-4 bg-black/96 px-4 pt-6 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform duration-220 ${chromeVisible ? "translate-y-0" : "-translate-y-[132px]"}`}>
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-[30px] font-black tracking-[-0.04em] text-white">Browse</h1>
            <div className="flex items-center gap-7 text-white">
              <Cast size={29} />
              <Link href="/search" aria-label="Search">
                <Search size={34} />
              </Link>
            </div>
          </header>

          <nav className="-mx-4 flex overflow-x-auto border-b border-white/12 px-4 text-[15px] font-black text-white/45 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/browse" className="relative shrink-0 px-1 py-4 text-white">
              All Anime
              <span className="absolute bottom-0 left-0 h-[3px] w-full bg-[#c4182a]" />
            </Link>
            <Link href="/schedule" className="ml-7 shrink-0 py-4">Simulcasts</Link>
            <button type="button" onClick={() => setGenresOpen((o) => !o)} className="ml-7 flex shrink-0 items-center justify-center gap-1 py-4 whitespace-nowrap">
              Anime Genres
              <ChevronDown size={16} className={genresOpen ? "rotate-180 transition" : "transition"} />
            </button>
            <Link href="/genre/Music" className="ml-7 shrink-0 py-4">Music</Link>
          </nav>
        </div>

        {genresOpen ? (
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-sm border border-white/10 bg-[#101014] p-3">
            {GENRES.map((genre) => (
              <Link key={genre} href={`/genre/${encodeURIComponent(genre)}`} className="rounded-sm bg-white/[0.055] px-3 py-2 text-[13px] font-bold text-white/82">
                {genre}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[26px] font-normal text-white">{heading}</h2>
            {activeCount > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {activeFmts.map((f) => (
                  <span key={f} className="rounded-full bg-[#c4182a]/20 px-2.5 py-0.5 text-[12px] font-bold text-[#ff6b82]">
                    {FORMATS.find((x) => x.key === f)?.label ?? f}
                  </span>
                ))}
                {activeGenres.map((g) => (
                  <span key={g} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-bold text-white/70">
                    {g}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-5 text-white">
            <button
              type="button"
              onClick={() => { setDraftFmts(activeFmts); setDraftGenres(activeGenres); setFilterOpen(true); }}
              aria-label="Open filters"
              className="relative"
            >
              <SlidersHorizontal size={30} />
              {activeCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c4182a] text-[9px] font-black text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Filter sheet */}
        {filterOpen ? (
          <div className="fixed inset-0 z-[80] bg-black/80" onClick={() => setFilterOpen(false)}>
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#111116] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[22px] font-black text-white">Filters</h3>
                <button type="button" onClick={() => setFilterOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Format multi-select */}
              <p className="mb-3 text-[12px] font-black uppercase tracking-widest text-white/45">Type — select multiple</p>
              <div className="mb-6 grid grid-cols-2 gap-2">
                {FORMATS.map((fmt) => {
                  const active = draftFmts.includes(fmt.key);
                  return (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => toggleDraftFmt(fmt.key)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-[15px] font-bold transition-colors ${active ? "border-[#c4182a] bg-[#c4182a]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/65"}`}
                    >
                      {fmt.label}
                      {active ? <Check size={18} className="text-[#c4182a]" /> : <div className="h-4.5 w-4.5 rounded border border-white/20" />}
                    </button>
                  );
                })}
              </div>

              {/* Genre multi-select */}
              <p className="mb-3 text-[12px] font-black uppercase tracking-widest text-white/45">Genre — select multiple</p>
              <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {GENRES.map((genre) => {
                  const active = draftGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleDraftGenre(genre)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] font-bold transition-colors ${active ? "border-[#c4182a] bg-[#c4182a]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/65"}`}
                    >
                      {genre}
                      {active ? <Check size={16} className="text-[#c4182a]" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex gap-3">
                <button type="button" onClick={clearFilters} className="h-12 flex-1 rounded-xl border border-white/15 text-[15px] font-bold text-white/60">
                  Clear All
                </button>
                <button type="button" onClick={applyFilters} className="h-12 flex-[2] rounded-xl bg-[#c4182a] text-[16px] font-black text-white">
                  Apply{draftFmts.length + draftGenres.length > 0 ? ` (${draftFmts.length + draftGenres.length} selected)` : ""}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {query.isLoading && !items.length ? <BufferingScreen /> : null}
        {query.isError && !items.length ? (
          <div className="mb-6 rounded-sm border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/70">
            Could not load titles. Pull back or tap filters to retry.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4 gap-y-7">
          {(items.length ? items : Array.from({ length: 4 }) as Anime[]).map((anime, index) => (
            anime ? <BrowseCard key={`${animeId(anime)}-${index}`} anime={anime} priority={index < 4} /> : <BrowseSkeleton key={index} />
          ))}
        </div>

        {hasMore ? <div ref={loadMoreRef} className="h-24" /> : null}
      </main>
    </AppShell>
  );
}

function BrowseCard({ anime, priority }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const title = titleOf(anime);
  const poster = posterOf(anime, "poster-sm");

  return (
    <article className="min-w-0">
      <Link href={animePath(anime, id)} onClick={() => rememberAnime(anime)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-[#111] [contain:layout_paint]">
          {poster ? (
            <ProgressiveImage
              highSrc={poster}
              alt={title}
              sizes="(max-width:640px) 50vw, 240px"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
            />
          ) : null}
        </div>
        <div className="relative min-h-[68px] pr-5 pt-2">
          <h3 className="line-clamp-1 text-[18px] font-normal leading-tight text-white">{title}</h3>
          <p className="mt-2 line-clamp-1 text-[16px] font-semibold text-white/58">Dub English | Sub</p>
          <MoreVertical size={23} className="absolute bottom-1 right-0 text-white/60" />
        </div>
      </Link>
    </article>
  );
}

function BrowseSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] animate-pulse bg-[#151515]" />
      <div className="mt-2 h-4 w-4/5 animate-pulse bg-[#151515]" />
      <div className="mt-2 h-3 w-1/2 animate-pulse bg-[#111]" />
    </div>
  );
}
