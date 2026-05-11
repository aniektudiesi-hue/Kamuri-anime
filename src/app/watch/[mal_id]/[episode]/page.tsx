"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCcw, Radio, Play } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { EpisodeDownloadButton } from "@/components/episode-download-button";
import { VideoPlayer } from "@/components/video-player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startProgressiveOfflinePlayback, type OfflinePlayable } from "@/lib/offline-downloads";
import { useSettings } from "@/lib/settings";
import type { Anime, StreamResponse } from "@/lib/types";
import { posterOf, progressOf, rememberedAnime, rememberedProgress, rememberProgress, titleOf } from "@/lib/utils";

const SERVERS = [
  { id: "mega", label: "MegaPlay", desc: "Primary · Adaptive HLS" },
  { id: "moon", label: "Moon", desc: "Backup · Fast CDN" },
  { id: "hd1", label: "HD1", desc: "Alternate · Direct" },
] as const;

type ServerId = (typeof SERVERS)[number]["id"];

function hasPlayableStream(data: StreamResponse | undefined) {
  return Boolean(data?.m3u8_url || data?.url || data?.stream_url);
}

function fetchServer(id: ServerId, malId: string, ep: string, type: "sub" | "dub") {
  if (id === "mega") return api.stream(malId, ep, type);
  if (id === "moon") return api.moon(malId, ep);
  return api.hd1(malId, ep);
}

function getPlayed(malId: string): number[] {
  try { return JSON.parse(sessionStorage.getItem(`played_${malId}`) || "[]"); }
  catch { return []; }
}

function markPlayed(malId: string, ep: number) {
  try {
    const existing = getPlayed(malId);
    if (!existing.includes(ep)) {
      sessionStorage.setItem(`played_${malId}`, JSON.stringify([...existing, ep]));
    }
  } catch { /* ignore */ }
}

export default function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ mal_id: string; episode: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { mal_id: malId, episode } = use(params);
  const { t } = use(searchParams);
  const [server, setServer] = useState<ServerId>("mega");
  const [type, setType] = useState<"sub" | "dub">("sub");
  const [known, setKnown] = useState<Anime | undefined>();
  const [localResumeTime, setLocalResumeTime] = useState(0);
  const [failedServers, setFailedServers] = useState<ServerId[]>([]);
  const [playedEps, setPlayedEps] = useState<number[]>([]);
  const [prefetchState, setPrefetchState] = useState({ progress: 0, message: "", ready: false });
  const [offlinePlayable, setOfflinePlayable] = useState<OfflinePlayable | undefined>();
  const { token } = useAuth();
  const settings = useSettings();
  const queryClient = useQueryClient();
  const router = useRouter();
  const episodeNum = Number(episode);
  const savedHistoryKey = useRef("");
  const lastProgressSave = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setKnown(rememberedAnime(malId));
      const saved = rememberedProgress(malId, episodeNum);
      setLocalResumeTime(progressOf(saved));
      markPlayed(malId, episodeNum);
      setPlayedEps(getPlayed(malId));
    }, 0);
    return () => window.clearTimeout(id);
  }, [episodeNum, malId]);

  const streamQueries = useQueries({
    queries: SERVERS.map((s) => ({
      queryKey: ["stream", malId, episode, s.id, s.id === "mega" ? type : "any"],
      queryFn: () => fetchServer(s.id, malId, episode, type),
      enabled: Boolean(malId) && Number.isFinite(episodeNum),
      retry: s.id === "moon" ? 1 : false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 20,
    })),
  });

  const playableServers = SERVERS.filter(
    (s, i) => hasPlayableStream(streamQueries[i]?.data),
  );
  const availableServers = playableServers.filter((s) => !failedServers.includes(s.id));
  const selectedServer = availableServers.find((s) => s.id === server) ?? availableServers[0];
  const selectedStream = selectedServer
    ? streamQueries[SERVERS.findIndex((s) => s.id === selectedServer.id)]?.data
    : undefined;
  const activeServerId = selectedServer?.id;
  const streamsLoading = streamQueries.some((q) => q.isLoading || q.isFetching);
  const allSettled = streamQueries.every((q) => q.isSuccess || q.isError);
  const streamError = allSettled && !playableServers.length;
  const shouldProgressiveCache = Boolean(selectedStream && activeServerId && settings.autoFetchWhileWatching);

  const episodes = useQuery({
    queryKey: ["episodes", malId, 0],
    queryFn: () => api.episodes(malId),
    staleTime: 1000 * 60 * 20,
  });

  const animeTitle = titleOf(known);
  const animePoster = posterOf(known);
  const initialTime = settings.autoResume ? Number(t || localResumeTime || 0) : 0;

  const saveHistory = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.addHistory(token!, body),
  });
  // Stable ref so saveWatchProgress never changes identity (avoids HLS restart)
  const saveHistoryRef = useRef(saveHistory.mutate);
  saveHistoryRef.current = saveHistory.mutate;

  // Stable refs for title/poster/token so the callback deps stay minimal
  const animeTitleRef = useRef(animeTitle);
  animeTitleRef.current = animeTitle;
  const animePosterRef = useRef(animePoster);
  animePosterRef.current = animePoster;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const saveWatchProgress = useCallback(
    ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      if (!Number.isFinite(currentTime) || currentTime < 1) return;
      const now = Date.now();
      if (now - lastProgressSave.current < 12000 && currentTime + 2 < duration) return;
      lastProgressSave.current = now;
      const body = {
        mal_id: malId, anime_id: malId, title: animeTitleRef.current,
        image_url: animePosterRef.current, poster: animePosterRef.current,
        episode: episodeNum, episode_num: episodeNum,
        playback_pos: Math.floor(currentTime), progress: Math.floor(currentTime),
        timestamp: Math.floor(currentTime), duration: Math.floor(duration || 0),
        watched_at: new Date().toISOString(),
      };
      rememberProgress(body);
      if (tokenRef.current) saveHistoryRef.current(body);
    },
    // Only re-create when episode/anime changes, not on every mutation state change
    [episodeNum, malId],
  );

  useEffect(() => {
    if (!token || !selectedStream) return;
    const key = `${malId}:${episodeNum}`;
    if (savedHistoryKey.current === key) return;
    savedHistoryKey.current = key;
    saveHistoryRef.current({
      mal_id: malId, anime_id: malId, title: animeTitle,
      image_url: animePoster, poster: animePoster,
      episode: episodeNum, episode_num: episodeNum,
      playback_pos: Math.floor(initialTime || 0), progress: Math.floor(initialTime || 0),
      timestamp: Math.floor(initialTime || 0), watched_at: new Date().toISOString(),
    });
  // saveHistoryRef is a ref — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animePoster, animeTitle, episodeNum, initialTime, malId, token, selectedStream]);

  useEffect(() => {
    if (!malId || !Number.isFinite(episodeNum)) return;
    queryClient.prefetchQuery({ queryKey: ["episodes", malId, 0], queryFn: () => api.episodes(malId), staleTime: 1000 * 60 * 20 });
    queryClient.prefetchQuery({ queryKey: ["stream", malId, episodeNum + 1, "mega", type], queryFn: () => api.stream(malId, episodeNum + 1, type), staleTime: 1000 * 60 * 2 });
    queryClient.prefetchQuery({ queryKey: ["stream", malId, episodeNum + 1, "moon", "any"], queryFn: () => api.moon(malId, episodeNum + 1), staleTime: 1000 * 60 * 5 });
    router.prefetch(`/watch/${malId}/${episodeNum + 1}`);
  }, [episodeNum, malId, queryClient, router, type]);

  const maxEpisode = useMemo(
    () => episodes.data?.num_episodes || episodes.data?.episodes.at(-1)?.episode_number || 0,
    [episodes.data],
  );
  const hasPrev = episodeNum > 1;
  const hasNext = maxEpisode ? episodeNum < maxEpisode : true;
  const nextHref = hasNext ? `/watch/${malId}/${episodeNum + 1}` : undefined;
  const displayTitle = animeTitle === "Untitled" ? `Anime ${malId}` : animeTitle;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFailedServers([]);
      setServer("mega");
    }, 0);
    return () => window.clearTimeout(id);
  }, [episode, malId, type]);

  useEffect(() => {
    if (!shouldProgressiveCache || !selectedStream || !activeServerId) {
      setPrefetchState({ progress: 0, message: "", ready: false });
      setOfflinePlayable((current) => {
        current?.revoke();
        return undefined;
      });
      return;
    }

    const controller = new AbortController();
    setPrefetchState({ progress: 0, message: "Preparing cached playback", ready: false });
    setOfflinePlayable((current) => {
      current?.revoke();
      return undefined;
    });

    startProgressiveOfflinePlayback(
      selectedStream,
      {
        malId,
        episode: episodeNum,
        title: displayTitle,
        poster: animePoster,
        server: activeServerId,
      },
      controller.signal,
      (progress, message) => {
        setPrefetchState({ progress, message, ready: progress >= 100 });
      },
      (playable) => {
        if (controller.signal.aborted) {
          playable.revoke();
          return;
        }
        setOfflinePlayable((current) => {
          current?.revoke();
          return playable;
        });
      },
      { concurrency: 8 },
    )
      .then((download) => {
        if (controller.signal.aborted) return;
        setPrefetchState({ progress: 100, message: "Cached playback ready", ready: true });
      })
      .catch((error) => {
      if ((error as Error).name === "AbortError") return;
      setPrefetchState({ progress: 0, message: "Offline cache paused", ready: false });
    });

    return () => {
      controller.abort();
      setOfflinePlayable((current) => {
        current?.revoke();
        return undefined;
      });
    };
  }, [activeServerId, animePoster, displayTitle, episodeNum, malId, selectedStream, shouldProgressiveCache]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function markServerFailed(_msg: string) {
    if (!activeServerId) return;
    setFailedServers((c) => (c.includes(activeServerId) ? c : [...c, activeServerId]));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-2xl px-4 py-5 lg:px-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-white/30">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight size={13} />
          <Link href={`/anime/${malId}`} className="hover:text-white transition-colors line-clamp-1 max-w-[200px]">
            {displayTitle}
          </Link>
          <ChevronRight size={13} />
          <span className="text-white/60">Episode {episodeNum}</span>
        </div>

        <div className="flex gap-5">
          {/* ── Left: Player + controls ── */}
          <div className="min-w-0 flex-1">
            {/* Player */}
            {streamError ? (
              <div className="grid aspect-video place-items-center border border-red-500/10 bg-red-950/10 text-center">
                <div>
                  <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
                  <p className="font-bold text-white">No streams available right now.</p>
                  <p className="mt-1 text-sm text-white/35">All servers are offline for this episode. Please try again.</p>
                  <button
                    onClick={() => streamQueries.forEach((q) => q.refetch())}
                    className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/[0.07] px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                  >
                    <RefreshCcw size={15} />
                    Retry all servers
                  </button>
                </div>
              </div>
            ) : streamsLoading && !selectedStream ? (
              <div className="aspect-video w-full animate-pulse bg-[#141828]" />
            ) : shouldProgressiveCache && selectedStream && !offlinePlayable ? (
              <div className="grid aspect-video w-full place-items-center bg-black px-6 text-center">
                <div className="w-full max-w-xs">
                  <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-[3px] border-white/15 border-t-white/90" />
                  <p className="text-sm font-bold text-white">Starting cached playback</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${Math.max(4, prefetchState.progress)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/40">{Math.round(prefetchState.progress)}%</p>
                </div>
              </div>
            ) : (
              <VideoPlayer
                key={`${activeServerId}-${type}-${offlinePlayable?.stream.m3u8_url || selectedStream?.m3u8_url || selectedStream?.url || selectedStream?.stream_url}`}
                stream={shouldProgressiveCache ? offlinePlayable?.stream : selectedStream}
                title={`${displayTitle} · Episode ${episodeNum}`}
                initialTime={initialTime}
                autoPlay={settings.autoResume}
                nextHref={nextHref}
                onProgress={saveWatchProgress}
              />
            )}

            {/* Episode nav strip */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link
                aria-disabled={!hasPrev}
                href={hasPrev ? `/watch/${malId}/${episodeNum - 1}` : "#"}
                className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition ${
                  !hasPrev
                    ? "pointer-events-none bg-white/[0.03] text-white/20"
                    : "border border-white/[0.08] bg-[#0d1020] text-white/60 hover:border-white/[0.14] hover:text-white"
                }`}
              >
                <ChevronLeft size={16} />
                Prev
              </Link>

              {/* Now playing badge */}
              <div className="hidden items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#0d1020] px-4 py-2 sm:flex">
                <Radio size={13} className="text-[#1ed9cc] animate-pulse" />
                <span className="text-xs font-semibold text-white/40">
                  {displayTitle} · Ep {episodeNum}
                </span>
              </div>

              <Link
                aria-disabled={!hasNext}
                href={nextHref ?? "#"}
                className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
                  !hasNext
                    ? "pointer-events-none bg-white/[0.03] text-white/20"
                    : "bg-gradient-to-r from-[#e8336a] to-[#7c4dff] text-white shadow-lg shadow-[#e8336a]/20 hover:opacity-90"
                }`}
              >
                Next Episode
                <ChevronRight size={16} />
              </Link>
            </div>

            {/* Server + Audio bar */}
            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto_auto]">
              {/* Servers */}
              <div className="rounded-3xl border border-white/[0.055] bg-[#0d1020] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Stream Server</p>
                <div className="flex flex-wrap gap-2">
                  {streamsLoading && !availableServers.length ? (
                    <>{[1,2,3].map(i => <div key={i} className="h-9 w-24 animate-pulse rounded-2xl bg-[#141828]" />)}</>
                  ) : null}
                  {availableServers.map((s) => {
                    const isActive = activeServerId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setServer(s.id)}
                        className={`group flex flex-col rounded-2xl px-4 py-2 text-left transition ${
                          isActive
                            ? "bg-gradient-to-r from-[#e8336a]/20 to-[#7c4dff]/20 ring-1 ring-[#e8336a]/30"
                            : "border border-white/[0.07] bg-[#141828] hover:border-white/[0.13] hover:bg-[#1b2036]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#1ed9cc] animate-pulse" : "bg-emerald-400"}`} />
                          <span className={`text-sm font-bold ${isActive ? "text-white" : "text-white/60"}`}>{s.label}</span>
                        </div>
                        <span className="mt-0.5 text-[10px] text-white/25">{s.desc}</span>
                      </button>
                    );
                  })}
                  {failedServers.map((id) => (
                    <div key={id} className="flex flex-col rounded-2xl border border-red-500/15 bg-red-950/10 px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        <span className="text-sm font-bold text-red-300/60">
                          {SERVERS.find((s) => s.id === id)?.label}
                        </span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-red-400/40">Unavailable</span>
                    </div>
                  ))}
                  {!streamsLoading && !availableServers.length && !failedServers.length ? (
                    <span className="text-sm text-white/30">No servers responded</span>
                  ) : null}
                </div>
              </div>

              {/* Audio */}
              <div className="rounded-3xl border border-white/[0.055] bg-[#0d1020] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Audio Track</p>
                <div className="flex gap-2">
                  {(["sub", "dub"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => { setType(a); setServer("mega"); }}
                      className={`rounded-2xl px-4 py-2 text-sm font-bold uppercase transition ${
                        type === a
                          ? "bg-gradient-to-r from-[#e8336a] to-[#7c4dff] text-white shadow-lg shadow-[#e8336a]/20"
                          : "border border-white/[0.07] bg-[#141828] text-white/40 hover:border-white/[0.14] hover:text-white"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <EpisodeDownloadButton
                stream={selectedStream}
                token={token}
                malId={malId}
                episode={episodeNum}
                title={displayTitle}
                poster={animePoster}
                server={activeServerId}
                prefetch={prefetchState}
              />
            </div>

            {/* Mobile episode list */}
            <div className="mt-4 xl:hidden">
              <EpisodeSidebar
                episodesData={episodes.data?.episodes}
                isLoading={episodes.isLoading}
                maxEpisode={maxEpisode}
                malId={malId}
                currentEp={episodeNum}
                animePoster={animePoster}
                playedEps={playedEps}
                mobile
              />
            </div>
          </div>

          {/* ── Right: Episode list with thumbnails ── */}
          <div className="hidden w-[340px] shrink-0 xl:block">
            <div className="sticky top-[84px]">
              <EpisodeSidebar
                episodesData={episodes.data?.episodes}
                isLoading={episodes.isLoading}
                maxEpisode={maxEpisode}
                malId={malId}
                currentEp={episodeNum}
                animePoster={animePoster}
                playedEps={playedEps}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const RANGE_SIZE = 100;

function getRanges(total: number) {
  if (total <= RANGE_SIZE) return [];
  const ranges: { label: string; start: number; end: number }[] = [];
  for (let s = 1; s <= total; s += RANGE_SIZE) {
    const e = Math.min(s + RANGE_SIZE - 1, total);
    ranges.push({ label: `${String(s).padStart(3, "0")}-${String(e).padStart(3, "0")}`, start: s, end: e });
  }
  return ranges;
}

function EpisodeSidebar({
  episodesData, isLoading, maxEpisode, malId, currentEp, animePoster, playedEps, mobile = false,
}: {
  episodesData?: { episode_number: number; title?: string }[];
  isLoading: boolean;
  maxEpisode: number;
  malId: string;
  currentEp: number;
  animePoster?: string;
  playedEps: number[];
  mobile?: boolean;
}) {
  const ranges = getRanges(maxEpisode);
  const defaultRange = ranges.length
    ? Math.max(0, ranges.findIndex((r) => currentEp >= r.start && currentEp <= r.end))
    : 0;
  const [activeRange, setActiveRange] = useState(defaultRange);
  const currentRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentEp]);

  const visibleEpisodes = ranges.length && episodesData
    ? episodesData.filter(
        (ep) => ep.episode_number >= ranges[activeRange].start && ep.episode_number <= ranges[activeRange].end,
      )
    : (episodesData ?? []);

  if (mobile) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.055] bg-[#0d1020]">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-3">
          <h2 className="text-sm font-black text-white">Episodes</h2>
          <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-white/25">
            {maxEpisode ? `${maxEpisode} total` : "…"}
          </span>
        </div>
        {ranges.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.04] px-3 py-2">
            {ranges.map((r, i) => (
              <button key={r.label} onClick={() => setActiveRange(i)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                  activeRange === i ? "bg-gradient-to-r from-[#e8336a] to-[#7c4dff] text-white" : "bg-white/[0.05] text-white/35 hover:text-white"
                }`}
              >{r.label}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1.5 p-2.5 sm:grid-cols-8 md:grid-cols-12">
          {isLoading
            ? Array.from({ length: 36 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-[#141828]" />)
            : visibleEpisodes.map((ep) => {
                const isActive = ep.episode_number === currentEp;
                const isPlayed = playedEps.includes(ep.episode_number);
                return (
                  <Link key={ep.episode_number} href={`/watch/${malId}/${ep.episode_number}`}
                    title={ep.title || `Episode ${ep.episode_number}`}
                    className={`grid h-10 place-items-center rounded-xl text-xs font-bold transition ${
                      isActive
                        ? "bg-gradient-to-br from-[#e8336a] to-[#7c4dff] text-white shadow-md shadow-[#e8336a]/20"
                        : isPlayed
                          ? "bg-[#7c4dff]/20 text-[#a78bfa] ring-1 ring-[#7c4dff]/30 hover:bg-[#7c4dff]/30"
                          : "bg-[#141828] text-white/35 hover:bg-[#1b2036] hover:text-white"
                    }`}
                  >
                    {ep.episode_number}
                  </Link>
                );
              })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-2xl border border-white/[0.055] bg-[#0d1020]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-white">Episodes</h2>
          <p className="text-[11px] text-white/25">{maxEpisode ? `${maxEpisode} total` : "Loading…"}</p>
        </div>
        <span className="rounded-lg bg-gradient-to-r from-[#e8336a]/20 to-[#7c4dff]/20 px-2.5 py-1 text-[10px] font-bold text-white/60 ring-1 ring-[#e8336a]/20">
          Ep {currentEp}
        </span>
      </div>

      {/* Range tabs */}
      {ranges.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.04] px-3 py-2">
          {ranges.map((r, i) => (
            <button key={r.label} onClick={() => setActiveRange(i)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                activeRange === i ? "bg-gradient-to-r from-[#e8336a] to-[#7c4dff] text-white" : "bg-white/[0.05] text-white/35 hover:text-white"
              }`}
            >{r.label}</button>
          ))}
        </div>
      )}

      {/* Episode list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex gap-3 border-b border-white/[0.04] p-3">
                <div className="h-16 w-28 shrink-0 animate-pulse rounded-xl bg-[#141828]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#141828]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-[#141828]" />
                </div>
              </div>
            ))
          : visibleEpisodes.map((ep) => {
              const isActive = ep.episode_number === currentEp;
              const isPlayed = playedEps.includes(ep.episode_number);
              return (
                <Link
                  key={ep.episode_number}
                  href={`/watch/${malId}/${ep.episode_number}`}
                  ref={isActive ? currentRef : null}
                  className={`group flex gap-3 border-b border-white/[0.04] p-3 transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-[#e8336a]/10 to-[#7c4dff]/10"
                      : isPlayed
                        ? "bg-[#7c4dff]/5 hover:bg-[#7c4dff]/10"
                        : "hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-[#141828]">
                    {animePoster ? (
                      <Image src={animePoster} alt="" fill sizes="112px" className="object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-black/30" />
                    {/* Play overlay on hover */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      <span className={`grid h-8 w-8 place-items-center rounded-full ${
                        isActive ? "bg-white/90" : "bg-black/60"
                      }`}>
                        <Play size={12} fill="currentColor" className={isActive ? "text-[#e8336a]" : "text-white"} />
                      </span>
                    </div>
                    {/* Episode number badge */}
                    <span className={`absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive
                        ? "bg-[#e8336a] text-white"
                        : isPlayed
                          ? "bg-[#7c4dff]/80 text-white"
                          : "bg-black/70 text-white/80"
                    }`}>
                      {ep.episode_number}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${
                      isActive ? "text-[#e8336a]" : isPlayed ? "text-[#a78bfa]" : "text-white/30"
                    }`}>
                      {isActive ? "Now Playing" : isPlayed ? "Watched" : `Episode ${ep.episode_number}`}
                    </p>
                    <p className={`mt-0.5 line-clamp-2 text-xs leading-4 ${
                      isActive ? "font-semibold text-white" : isPlayed ? "text-white/50" : "text-white/60"
                    }`}>
                      {ep.title || `Episode ${ep.episode_number}`}
                    </p>
                    {isActive && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#1ed9cc]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#1ed9cc]">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-[#1ed9cc]" />
                        LIVE
                      </span>
                    )}
                    {isPlayed && !isActive && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#7c4dff]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#a78bfa]">
                        ✓ Played
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
