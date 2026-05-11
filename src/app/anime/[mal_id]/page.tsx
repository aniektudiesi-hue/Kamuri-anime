"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock, Play, Plus, Star, Tv, CheckCircle2, Loader2 } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Anime } from "@/lib/types";
import { useResumeHistory } from "@/lib/use-resume-history";
import {
  animeId, bannerOf, displayStatus, episodeCount, posterOf,
  rememberAnime, rememberedAnime, titleOf,
} from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  currently_airing: { label: "Airing Now", color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20", dot: "bg-emerald-400 animate-pulse" },
  finished_airing: { label: "Completed", color: "text-white/50 bg-white/[0.06] ring-white/10", dot: "bg-white/40" },
  not_yet_aired: { label: "Upcoming", color: "text-blue-300 bg-blue-500/10 ring-blue-400/20", dot: "bg-blue-400" },
};

const RANGE_SIZE = 100;

function getRanges(total: number): { label: string; start: number; end: number }[] {
  if (total <= RANGE_SIZE) return [];
  const ranges = [];
  for (let s = 1; s <= total; s += RANGE_SIZE) {
    const e = Math.min(s + RANGE_SIZE - 1, total);
    ranges.push({ label: `${String(s).padStart(3, "0")}-${String(e).padStart(3, "0")}`, start: s, end: e });
  }
  return ranges;
}

export default function AnimeDetailPage({ params }: { params: Promise<{ mal_id: string }> }) {
  const { mal_id: malId } = use(params);
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [clickedAnime, setClickedAnime] = useState<Anime | undefined>();
  const [watchlistSaved, setWatchlistSaved] = useState(false);
  const [activeRange, setActiveRange] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setClickedAnime(rememberedAnime(malId)), 0);
    return () => window.clearTimeout(id);
  }, [malId]);

  const [thumbs, recent, top] = useQueries({
    queries: [
      { queryKey: ["thumbnails"], queryFn: api.thumbnails },
      { queryKey: ["recent"], queryFn: api.recentlyAdded },
      { queryKey: ["top-rated"], queryFn: api.topRated },
    ],
  });
  const known = (clickedAnime ||
    [...(thumbs.data ?? []), ...(recent.data ?? []), ...(top.data ?? [])].find(
      (item) => animeId(item) === malId,
    )) as Anime | undefined;
  const hint = episodeCount(known);

  useEffect(() => {
    if (known) rememberAnime(known);
  }, [known]);

  const episodes = useQuery({
    queryKey: ["episodes", malId, hint],
    queryFn: () => api.episodes(malId, hint),
    staleTime: 1000 * 60 * 20,
  });

  const resume = useResumeHistory(malId);
  const last = resume.item;
  const lastEp = resume.episode;
  const localProgress = resume.progress;

  const watchlist = useQuery({
    queryKey: ["watchlist", token],
    queryFn: () => api.watchlist(token!),
    enabled: Boolean(token),
  });
  const watchlistHasAnime = Boolean(watchlist.data?.some((item) => String(item.mal_id || item.anime_id) === malId));
  const inWatchlist = watchlistSaved || watchlistHasAnime;

  useEffect(() => {
    setWatchlistSaved(watchlistHasAnime);
  }, [malId, watchlistHasAnime]);

  const addWatchlist = useMutation({
    mutationFn: () =>
      api.addWatchlist(token!, {
        mal_id: malId, anime_id: malId,
        title: titleOf(known), image_url: posterOf(known), episodes: hint,
      }),
    onMutate: () => setWatchlistSaved(true),
    onError: () => setWatchlistSaved(false),
    onSuccess: () => {
      setWatchlistSaved(true);
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", token] });
    },
  });

  function prefetchWatch(ep: number) {
    queryClient.prefetchQuery({
      queryKey: ["stream", malId, ep, "mega", "sub"],
      queryFn: () => api.stream(malId, ep, "sub"),
      staleTime: 1000 * 60 * 3,
    });
  }

  const episodeTotal = episodes.data?.num_episodes || hint;
  const poster = posterOf(known);
  const backdrop = bannerOf(known) || poster;
  const title = titleOf(known) || `Anime ${malId}`;
  const statusKey = (known?.status || "").toLowerCase();
  const statusCfg = STATUS_CONFIG[statusKey];
  const resumeHref = resume.href;

  const allEpisodes = episodes.data?.episodes ?? [];
  const ranges = getRanges(episodeTotal);

  // Auto-select range that contains lastEp
  useEffect(() => {
    if (!ranges.length || !lastEp) return;
    const idx = ranges.findIndex((r) => lastEp >= r.start && lastEp <= r.end);
    if (idx >= 0) setActiveRange(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEp, ranges.length]);

  const visibleEpisodes = ranges.length
    ? allEpisodes.filter(
        (ep) => ep.episode_number >= ranges[activeRange].start && ep.episode_number <= ranges[activeRange].end,
      )
    : allEpisodes;

  return (
    <AppShell>
      {/* ── Hero (full width, outside sidebar) ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -bottom-12">
          {backdrop ? (
            <Image src={backdrop} alt="" fill sizes="100vw" className="scale-105 object-cover object-center opacity-[0.46] blur-[1px] sm:opacity-[0.38]" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-[#06070d]/24 via-[#06070d]/62 to-[#06070d]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06070d] via-[#06070d]/74 to-[#06070d]/22" />
          <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_78%_20%,rgba(200,34,61,0.16),transparent_32%),radial-gradient(circle_at_82%_76%,rgba(200,206,216,0.10),transparent_30%)] lg:block" />
        </div>

        <div className="relative mx-auto max-w-screen-2xl px-4 py-6 sm:py-10 lg:px-6 lg:py-16">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-1.5 text-xs text-white/35 sm:mb-6">
            <Link href="/" className="transition-colors hover:text-white">Home</Link>
            <ChevronRight size={12} />
            <span className="text-white/50">TV</span>
            <ChevronRight size={12} />
            <span className="line-clamp-1 max-w-[200px] text-white/50">{title}</span>
          </div>

          <div className="grid gap-4 sm:gap-8 md:grid-cols-[200px_minmax(0,620px)] lg:min-h-[430px] lg:items-center">
            {/* Poster */}
            <div className="mx-auto w-[132px] sm:w-[160px] md:mx-0 md:w-auto">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-[#141828] shadow-2xl shadow-black/70 ring-1 ring-white/[0.12] sm:rounded-2xl sm:ring-white/[0.08]">
                {poster ? (
                  <Image src={poster} alt={title} fill priority sizes="200px" className="object-cover" />
                ) : (
                  <div className="h-full w-full bg-[#141828]" />
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className="mx-auto flex w-full max-w-[360px] flex-col justify-end rounded-3xl border border-white/[0.1] bg-[#090b13]/30 p-3.5 text-center shadow-2xl shadow-black/35 backdrop-blur-xl sm:mx-0 sm:max-w-none sm:border-0 sm:bg-transparent sm:p-0 sm:pb-2 sm:text-left sm:shadow-none sm:backdrop-blur-0">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {statusCfg ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${statusCfg.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                    {statusCfg.label}
                  </span>
                ) : known?.status ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-white/50 ring-1 ring-white/10">
                    {displayStatus(known.status)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/50 ring-1 ring-white/[0.08]">
                  <Tv size={11} />
                  TV Series
                </span>
                {episodeTotal > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/50 ring-1 ring-white/[0.08]">
                    <Clock size={11} />
                    {episodeTotal} Episodes
                  </span>
                ) : null}
                {known?.score ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d8b56a]/10 px-3 py-1 text-[11px] font-bold text-[#d8b56a] ring-1 ring-[#d8b56a]/20">
                    <Star size={11} className="fill-[#d8b56a]" />
                    {Number(known.score).toFixed(2)} / 10
                  </span>
                ) : null}
              </div>

              <h1 className="mb-1 text-xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              {known?.title_jp && known.title_jp !== title ? (
                <p className="mb-5 text-sm text-white/30">{known.title_jp}</p>
              ) : (
                <div className="mb-5" />
              )}

              {/* Progress bar */}
              {last && localProgress > 1 ? (
                <div className="mx-auto mb-5 max-w-xs sm:mx-0">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/30">
                    <span>Episode {lastEp} in progress</span>
                    <span>{formatClock(localProgress)}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-[#c8223d]"
                      style={{ width: `${Math.min(100, (localProgress / (last.duration || 1440)) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link
                  href={resumeHref}
                  className="shine inline-flex h-11 items-center justify-center gap-2.5 rounded-2xl bg-[#c8223d] px-6 text-sm font-bold text-white shadow-xl shadow-[#c8223d]/25 transition hover:bg-[#d62a47] sm:rounded-xl"
                >
                  <Play size={16} fill="currentColor" />
                  {last ? "Continue Watching" : "Watch Episode 1"}
                </Link>
                <button
                  disabled={!token || inWatchlist || addWatchlist.isPending}
                  onClick={() => addWatchlist.mutate()}
                  className={`inline-flex h-11 items-center justify-center gap-2.5 rounded-2xl border px-5 text-sm font-bold transition disabled:cursor-not-allowed sm:rounded-xl ${
                    inWatchlist
                      ? "border-white/15 bg-white/[0.08] text-[#c8ced8]"
                      : "border-[#c8223d]/35 bg-[#c8223d]/10 text-white/82 hover:border-[#c8223d]/60 hover:bg-[#c8223d]/18 hover:text-white disabled:opacity-40"
                  }`}
                >
                  {addWatchlist.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : inWatchlist ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  {!token
                    ? "Sign in to save"
                    : inWatchlist
                      ? "Saved"
                      : addWatchlist.isPending
                        ? "Saving…"
                        : "Add to Watchlist"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Episodes + Sidebar ── */}
      <SidebarLayout>
        <div className="py-6 pb-16">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-5 w-1 rounded-full bg-[#c8223d]" />
              <h2 className="text-base font-black text-white">Episodes</h2>
              {episodeTotal > 0 && (
                <span className="rounded-lg bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-white/30">
                  {episodeTotal} total
                </span>
              )}
            </div>
          </div>

          {/* Range tabs */}
          {ranges.length > 0 && (
            <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
              {ranges.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setActiveRange(i)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeRange === i
                      ? "bg-[#c8223d] text-white shadow-md shadow-[#c8223d]/20"
                      : "border border-white/[0.07] bg-[#0d1020] text-white/40 hover:border-white/[0.13] hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Episode grid */}
          {episodes.isLoading ? (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-[#141828]" />
              ))}
            </div>
          ) : visibleEpisodes.length ? (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {visibleEpisodes.map((ep) => {
                const isCurrent = ep.episode_number === lastEp && Boolean(last);
                return (
                  <Link
                    key={ep.episode_number}
                    href={`/watch/${malId}/${ep.episode_number}`}
                    onMouseEnter={() => prefetchWatch(ep.episode_number)}
                    onFocus={() => prefetchWatch(ep.episode_number)}
                    title={ep.title || `Episode ${ep.episode_number}`}
                    className={`group relative grid h-10 place-items-center rounded-xl text-xs font-bold transition ${
                      isCurrent
                        ? "bg-[#c8223d] text-white shadow-md shadow-[#c8223d]/25"
                        : "bg-[#0d1020] text-white/40 hover:bg-[#141828] hover:text-white"
                    }`}
                  >
                    {ep.episode_number}
                    {isCurrent ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#c8ced8]">
                        <span className="h-1 w-1 rounded-full bg-[#06070d]" />
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.055] bg-[#0d1020] p-10 text-center">
              <p className="text-white/30">No episodes found yet.</p>
              <p className="mt-1 text-sm text-white/20">Check back soon — we update daily.</p>
            </div>
          )}
        </div>
      </SidebarLayout>
    </AppShell>
  );
}

function formatClock(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
