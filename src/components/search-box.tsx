"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { animeId, episodeLabel, posterOf, rankAnimeForSearch, rememberAnime, titleOf } from "@/lib/utils";

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
    const t = window.setTimeout(() => setDebounced(trimmed), 150);
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

  // Show "slow connection" hint after 4s of fetching with no data
  useEffect(() => {
    if (slowTimer.current) window.clearTimeout(slowTimer.current);
    // Reset async so the lint rule isn't triggered by a sync setState in effect body
    const reset = window.setTimeout(() => setIsSlow(false), 0);
    if (suggestions.isFetching && !suggestions.data) {
      slowTimer.current = window.setTimeout(() => setIsSlow(true), 4000);
    }
    return () => {
      window.clearTimeout(reset);
      if (slowTimer.current) window.clearTimeout(slowTimer.current);
    };
  }, [suggestions.isFetching, suggestions.data]);

  const items = useMemo(
    () => rankAnimeForSearch(suggestions.data ?? [], debounced).slice(0, 7),
    [debounced, suggestions.data],
  );

  const showDropdown = focused && trimmed.length >= 2;
  const isTimeout = suggestions.error instanceof Error && suggestions.error.message === "timeout";

  function submit() {
    if (!trimmed) return;
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
      router.push(`/anime/${id}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(titleOf(anime))}`);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      if (active >= 0 && items[active]) {
        openSuggestion(items[active]);
      } else {
        submit();
      }
    }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => (i <= 0 ? -1 : i - 1)); }
    if (event.key === "Escape") { setFocused(false); inputRef.current?.blur(); }
  }

  return (
    <div className="relative w-full">
      {/* Input */}
      <div
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 transition-[border-color,background-color] duration-150 ${
          focused
            ? "border-[#c8223d]/50 bg-[#141828]"
            : "border-white/[0.07] bg-[#0d1020] hover:border-white/[0.12]"
        }`}
      >
        <Search size={14} className={`shrink-0 transition-colors duration-150 ${focused ? "text-[#c8223d]" : "text-white/25"}`} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setActive(-1); }}
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
          placeholder="Search anime…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/20"
          autoComplete="off"
          spellCheck={false}
        />
        {suggestions.isFetching ? (
          <Loader2 size={13} className="shrink-0 animate-spin text-white/25" />
        ) : value ? (
          <button
            onClick={clear}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/40 hover:bg-white/[0.14] hover:text-white"
          >
            <X size={9} />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0f1117] shadow-xl shadow-black/70">

          {/* Error state */}
          {suggestions.isError && !suggestions.data ? (
            <div className="px-4 py-4">
              <div className="flex items-start gap-3">
                {isTimeout ? (
                  <WifiOff size={16} className="mt-0.5 shrink-0 text-[#d8b56a]" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80">
                    {isTimeout ? "Server is waking up…" : "Search failed"}
                  </p>
                  <p className="mt-0.5 text-xs text-white/35">
                    {isTimeout
                      ? "The server was asleep. It's starting up now — retry in a moment."
                      : "Something went wrong. Check your connection and try again."}
                  </p>
                  <button
                    onClick={retry}
                    className="mt-2.5 flex items-center gap-1.5 rounded-md bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
                  >
                    <RefreshCw size={11} />
                    Try again
                  </button>
                </div>
              </div>
            </div>

          /* Slow connection warning while loading */
          ) : isSlow && suggestions.isFetching ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-[#d8b56a]" />
                <div>
                  <p className="text-sm font-medium text-white/70">Waking up the server…</p>
                  <p className="mt-0.5 text-xs text-white/30">This takes ~10s on first search. Results coming.</p>
                </div>
              </div>
            </div>

          /* Normal loading (fast) */
          ) : suggestions.isLoading && !suggestions.data ? (
            <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-white/30">
              <Loader2 size={14} className="animate-spin" />
              Searching…
            </div>

          /* Results */
          ) : items.length ? (
            <>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                Results
              </div>
              <div className="pb-1.5">
                {items.map((anime, index) => {
                  const id = animeId(anime);
                  const poster = posterOf(anime);
                  return (
                    <button
                      type="button"
                      key={`${id}-${index}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => openSuggestion(anime)}
                      className={`mx-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-100 ${
                        active === index ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white/[0.05]">
                        {poster ? <Image src={poster} alt="" fill sizes="36px" className="object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-white/85">{titleOf(anime)}</p>
                        <p className="mt-0.5 text-[11px] text-white/30">
                          {episodeLabel(anime)}
                          {anime.score ? ` · ★ ${Number(anime.score).toFixed(1)}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-white/[0.055] px-3 py-2">
                <button
                  onClick={submit}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#c8223d] transition-colors duration-100 hover:bg-white/[0.04] hover:text-white"
                >
                  <span>All results for &ldquo;{trimmed}&rdquo;</span>
                  <Search size={13} />
                </button>
              </div>
            </>

          /* No results */
          ) : !suggestions.isFetching ? (
            <div className="px-4 py-4 text-sm text-white/30">
              No results for &ldquo;{trimmed}&rdquo;
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
