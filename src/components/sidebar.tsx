"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, TrendingUp, ChevronRight, Moon, Sun, Wifi } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { animeId, episodeCount, posterOf, titleOf } from "@/lib/utils";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Horror", "Isekai", "Mecha", "Mystery", "Romance",
  "School", "Sci-Fi", "Slice of Life", "Sports", "Supernatural",
];

export function Sidebar() {
  const [tab, setTab] = useState<"popular" | "toprated">("popular");
  const settings = useSettings();

  const thumbnails = useQuery({
    queryKey: ["thumbnails"],
    queryFn: api.thumbnails,
    staleTime: 1000 * 60 * 60,
  });

  const topRated = useQuery({
    queryKey: ["top-rated"],
    queryFn: api.topRated,
    staleTime: 1000 * 60 * 60,
  });

  const recent = useQuery({
    queryKey: ["recent"],
    queryFn: api.recentlyAdded,
    staleTime: 1000 * 60 * 20,
  });

  const activeData = tab === "popular" ? thumbnails.data : topRated.data;
  const isLoading = tab === "popular" ? thumbnails.isLoading : topRated.isLoading;
  const topItems = (activeData ?? []).slice(0, 10);
  const recentItems = (recent.data ?? []).slice(0, 10);

  return (
    <aside className="w-[280px] shrink-0 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1020]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">Playback Settings</h3>
        </div>
        <div className="space-y-2 p-3">
          <SettingSwitch
            label="Deep buffer"
            hint="Load far ahead while watching"
            checked={settings.autoFetchWhileWatching}
            onChange={settings.setAutoFetchWhileWatching}
            icon={<Wifi size={13} />}
          />
          <SettingSwitch
            label="Auto resume"
            hint="Start from your last timestamp"
            checked={settings.autoResume}
            onChange={settings.setAutoResume}
            icon={<Clock size={13} />}
          />
          <div className="rounded-xl bg-white/[0.04] p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/55">Theme</span>
          {settings.theme === "dark" ? <Moon size={13} className="text-white/35" /> : <Sun size={13} className="text-[#d8b56a]" />}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["dark", "light"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => settings.setTheme(theme)}
                  className={`h-8 rounded-lg text-xs font-bold capitalize transition ${
                    settings.theme === theme
            ? "bg-[#cf2442] text-white"
                      : "bg-white/[0.05] text-white/35 hover:text-white"
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Genre Filter */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1020]">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/40">Browse Genres</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 p-3">
          {GENRES.map((g) => (
            <Link
              key={g}
              href={`/genre/${encodeURIComponent(g)}`}
              className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/50 transition-colors hover:bg-[#cf2442]/15 hover:text-[#cf2442]"
            >
              {g}
            </Link>
          ))}
        </div>
      </div>

      {/* Top Anime */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1020]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-[#cf2442]" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Top Anime</h3>
          </div>
          <div className="flex gap-1">
            {(["popular", "toprated"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
              tab === t ? "bg-[#cf2442] text-white" : "text-white/25 hover:text-white"
                }`}
              >
                {t === "popular" ? "Popular" : "Top Rated"}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#141828]" />
                  <div className="h-10 w-8 shrink-0 animate-pulse rounded-lg bg-[#141828]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#141828]" />
                    <div className="h-2 w-1/2 animate-pulse rounded-full bg-[#141828]" />
                  </div>
                </div>
              ))
            : topItems.map((anime, i) => {
                const id = animeId(anime);
                const poster = posterOf(anime);
                return (
                  <Link
                    key={`${id}-${i}`}
                    href={`/anime/${id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={`w-5 shrink-0 text-center text-sm font-black tabular-nums ${
                        i === 0
                                ? "text-[#d8b56a]"
                          : i === 1
                            ? "text-white/50"
                            : i === 2
                            ? "text-[#b58653]"
                              : "text-white/20"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-[#141828]">
                      {poster ? (
                        <Image src={poster} alt="" fill sizes="32px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-medium text-white/75">{titleOf(anime)}</p>
                      {anime.score ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-[#d8b56a]">
                      <Star size={8} className="fill-[#d8b56a]" />
                          {Number(anime.score).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>

      {/* Recently Added */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1020]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <Clock size={13} className="text-[#c8ced8]" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Recently Added</h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {recent.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="h-12 w-9 shrink-0 animate-pulse rounded-lg bg-[#141828]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#141828]" />
                    <div className="h-2.5 w-12 animate-pulse rounded bg-[#141828]" />
                  </div>
                </div>
              ))
            : recentItems.map((anime, i) => {
                const id = animeId(anime);
                const count = episodeCount(anime);
                const poster = posterOf(anime);
                return (
                  <Link
                    key={`${id}-${i}`}
                    href={count > 0 ? `/watch/${id}/${count}` : `/anime/${id}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-[#141828]">
                      {poster ? (
                        <Image src={poster} alt="" fill sizes="36px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs leading-4 text-white/70">{titleOf(anime)}</p>
                  <span className="mt-1 inline-block rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-[#c8ced8]">
                        {count > 0 ? `EP ${count}` : "NEW"}
                      </span>
                    </div>
                  </Link>
                );
              })}
        </div>
        <div className="border-t border-white/[0.04] px-4 py-2.5">
          <Link
            href="/search?q=new"
            className="flex items-center justify-center gap-1 text-[11px] font-semibold text-white/25 transition-colors hover:text-white"
          >
            View all <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SettingSwitch({
  label,
  hint,
  checked,
  onChange,
  icon,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.06]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/40">{icon}</span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-white/60">{label}</span>
          <span className="block truncate text-[10px] text-white/25">{hint}</span>
        </span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#cf2442]" : "bg-white/[0.12]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden lg:block">
          <div className="sticky top-[80px]">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
