"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { animeId, posterOf, rankAnimeForSearch, rememberAnime, titleOf } from "@/lib/utils";

export function SearchBox() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(-1);
  const trimmed = value.trim();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(trimmed), 220);
    return () => window.clearTimeout(timeout);
  }, [trimmed]);

  const suggestions = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.suggest(debounced),
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
  });

  const items = useMemo(() => rankAnimeForSearch(suggestions.data ?? [], debounced).slice(0, 6), [debounced, suggestions.data]);

  function submit() {
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setValue("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      submit();
    }
    if (event.key === "ArrowDown") setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    if (event.key === "ArrowUp") setActive((i) => (i <= 0 ? -1 : i - 1));
  }

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2 rounded-md border border-white/10 bg-panel-strong px-3">
        <Search size={18} className="text-muted" />
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(-1);
          }}
          onFocus={() => trimmed && queryClient.prefetchQuery({ queryKey: ["suggest", trimmed], queryFn: () => api.suggest(trimmed), staleTime: 1000 * 60 * 30, gcTime: 1000 * 60 * 90 })}
          onKeyDown={onKeyDown}
          placeholder="Search anime..."
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-muted"
        />
      </div>

      {trimmed.length >= 2 ? (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-md border border-white/10 bg-[#11131d] shadow-2xl">
          {suggestions.isLoading ? (
            <div className="p-3 text-sm text-muted">Searching...</div>
          ) : items.length ? (
            <div className="py-2">
              {items.map((anime, index) => (
                <Link
                  key={`${animeId(anime)}-${index}`}
                  href={`/anime/${animeId(anime)}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    rememberAnime(anime);
                    setValue("");
                  }}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${active === index ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-white/10">
                    {posterOf(anime) ? <Image src={posterOf(anime)} alt="" fill sizes="40px" className="object-cover" /> : null}
                  </div>
                  <span className="line-clamp-2 flex-1">{titleOf(anime)}</span>
                </Link>
              ))}
              <button onClick={submit} className="w-full border-t border-white/10 px-3 py-2 text-left text-sm font-semibold text-accent-2 hover:bg-white/5">
                View all results
              </button>
            </div>
          ) : (
            <div className="p-3 text-sm text-muted">No quick matches.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
