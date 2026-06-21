"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Kairo } from "@/components/mascot/kairo";
import { localSearchAnime, mergeSearchResults, rememberSearchCatalog } from "@/lib/search-index";
import { animeId, animePath, episodeLabel, posterOf, rankAnimeForSearch, rememberAnime, titleOf } from "@/lib/utils";

const MAX_SUGGESTIONS = 4;

export function SearchBox() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const slowTimer = useRef<number | undefined>(undefined);
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const trimmed = value.trim();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(trimmed), 90);
    return () => window.clearTimeout(t);
  }, [trimmed]);

  const suggestions = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.suggest(debounced),
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: 1500,
  });

  // Show "slow connection" hint after 4s of fetching with no data.
  useEffect(() => {
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    const reset = window.setTimeout(() => setIsSlow(false), 0);
    if (suggestions.isFetching && !suggestions.data) {
      slowTimer.current = window.setTimeout(() => setIsSlow(true), 4000);
    }
    return () => {
      window.clearTimeout(reset);
      if (slowTimer.current) window.clearTimeout(slowTimer.current);
    };
  }, [suggestions.isFetching, suggestions.data]);

  const instantItems = useMemo(() => localSearchAnime(trimmed, MAX_SUGGESTIONS), [trimmed]);
  const hasInstantPosters = useMemo(() => instantItems.some((anime) => Boolean(posterOf(anime, "poster-xs"))), [instantItems]);
  const items = useMemo(() => {
    // When the API (root-only, deduped) has responded, show ONLY its results.
    // Do NOT merge the local instant cache here — it can hold stale child-season
    // ("Season 2/3") entries that the API now hides, which would leak back in.
    if (suggestions.data?.length) return rankAnimeForSearch(suggestions.data, trimmed).slice(0, MAX_SUGGESTIONS);
    if (hasInstantPosters) return rankAnimeForSearch(instantItems, trimmed).slice(0, MAX_SUGGESTIONS);
    return [];
  }, [hasInstantPosters, instantItems, suggestions.data, trimmed]);

  useEffect(() => {
    if (suggestions.data?.length) rememberSearchCatalog(suggestions.data);
  }, [suggestions.data]);

  const showDropdown = focused && trimmed.length >= 2;
  function submit() {
    if (!trimmed) {
      router.push("/search");
      setFocused(false);
      inputRef.current?.blur();
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setValue("");
    setFocused(false);
    inputRef.current?.blur();
  }

  function clear() {
    setValue("");
    setDebounced("");
    inputRef.current?.focus();
  }

  function retry() {
    queryClient.removeQueries({ queryKey: ["suggest", debounced] });
    suggestions.refetch();
  }

  function openSuggestion(anime: (typeof items)[number]) {
    const id = animeId(anime);
    rememberAnime(anime);
    setValue("");
    setFocused(false);
    inputRef.current?.blur();
    if (id) {
      router.push(animePath(anime, id));
    } else {
      router.push(`/search?q=${encodeURIComponent(titleOf(anime))}`);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      submit();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? -1 : i - 1));
    }
    if (event.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full">
      <form
        action="/search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={`flex h-[48px] items-center gap-2 rounded-[4px] border px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color,box-shadow] duration-150 ${
          focused
            ? "border-[#c4182a]/60 bg-[rgba(18,18,22,0.94)] shadow-[0_0_0_3px_rgba(226,29,72,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "border-white/[0.10] bg-[rgba(18,18,22,0.88)] hover:border-white/[0.18]"
        }`}
      >
        <Search size={16} className={`shrink-0 transition-colors duration-150 ${focused ? "text-[#f43f5e]" : "text-white/30"}`} />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(-1);
          }}
          onFocus={() => {
            setFocused(true);
            if (trimmed.length >= 2) {
              queryClient.prefetchQuery({
                queryKey: ["suggest", trimmed],
                queryFn: () => api.suggest(trimmed),
                staleTime: 1000 * 60 * 30,
              });
            }
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Search anime..."
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] font-normal text-white shadow-none outline-none placeholder:text-white/24 focus-visible:ring-0"
          autoComplete="off"
          spellCheck={false}
        />
        {suggestions.isFetching && !items.length ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-white/25" />
        ) : value ? (
          <button
            type="button"
            onClick={clear}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-md bg-white/[0.08] text-white/40 hover:bg-white/[0.14] hover:text-white"
          >
            <X size={9} />
          </button>
        ) : null}
      </form>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-xl border border-white/[0.085] bg-[#0b0e19]/98 shadow-[0_28px_90px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
          {suggestions.isError && !suggestions.data ? (
            <div className="px-4 py-4">
              <div className="flex items-start gap-3">
                <Kairo mood="offline" size={48} className="-mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80">Kairo lost the connection</p>
                  <p className="mt-0.5 text-xs text-white/35">
                    The catalog didn&apos;t respond in time. Check your network and try again.
                  </p>
                  <button
                    onClick={retry}
                    className="mt-2.5 flex items-center gap-1.5 rounded-md bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <RefreshCw size={11} />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : isSlow && suggestions.isFetching ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-[#d8b56a]" />
                <div>
                  <p className="text-sm font-medium text-white/70">Searching catalog...</p>
                  <p className="mt-0.5 text-xs text-white/30">Reading the local anime index.</p>
                </div>
              </div>
            </div>
          ) : suggestions.isLoading && !suggestions.data && !items.length ? (
            <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-white/30">
              <Loader2 size={14} className="animate-spin" />
              Searching...
            </div>
          ) : items.length ? (
            <>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-widest text-white/20">
                Results
              </div>
              <div className="pb-1.5">
                {items.map((anime, index) => {
                  const id = animeId(anime);
                  const poster = posterOf(anime, "poster-xs");
                  return (
                    <button
                      type="button"
                      key={`${id}-${index}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => openSuggestion(anime)}
                      className={`mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 ${
                        active === index ? "bg-white/[0.08]" : "hover:bg-white/[0.045]"
                      }`}
                    >
                      <div className="relative h-[52px] w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.05] ring-1 ring-white/[0.06]">
                        {poster ? (
                          index < 2 ? (
                            <Image
                              src={poster}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                              priority
                              fetchPriority="high"
                              unoptimized
                            />
                          ) : (
                            <Image
                              src={poster}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                              loading="lazy"
                              fetchPriority="auto"
                              unoptimized
                            />
                          )
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-white/85">{titleOf(anime)}</p>
                        <p className="mt-0.5 text-[11px] text-white/30">
                          {episodeLabel(anime)}
                          {anime.score ? ` - Score ${Number(anime.score).toFixed(1)}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/[0.055] px-3 py-2">
                <button
                  type="button"
                  onClick={submit}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#cf2442] transition-colors duration-100 hover:bg-white/[0.045] hover:text-white"
                >
                  <span>Press Enter to search &ldquo;{trimmed}&rdquo;</span>
                  <Search size={13} />
                </button>
              </div>
            </>
          ) : !suggestions.isFetching ? (
            <div className="flex items-center gap-3 px-4 py-4">
              <Kairo mood="notfound" size={48} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">Kairo couldn&apos;t find that</p>
                <p className="mt-0.5 truncate text-xs text-white/35">No matches for &ldquo;{trimmed}&rdquo;</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
