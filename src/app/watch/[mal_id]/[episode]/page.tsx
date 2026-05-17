"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, MessageCircle, RefreshCcw, Radio, Play } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { fetchAnimeMetadataByMalId } from "@/lib/anime-metadata";
import { useAuth } from "@/lib/auth";
import { shareWatching } from "@/lib/chat";
import { historySocketUrl } from "@/lib/history-realtime";
import { clearCachedStream } from "@/lib/stream-cache";
import { useSettings } from "@/lib/settings";
import {
  DEFAULT_STREAM_PROVIDER_ID,
  STREAM_PROVIDERS,
  fetchStreamProvider,
  hasPlayableStream,
  streamProviderCacheKey,
  streamProviderIndex,
  streamProviderQueryKey,
  type StreamProviderId,
} from "@/lib/stream-providers";
import type { Anime } from "@/lib/types";
import {
  animePath,
  episodeNumberFromSlug,
  idFromSlug,
  posterOf,
  progressOf,
  rememberAnime,
  rememberProgress,
  rememberedAnime,
  rememberedProgress,
  titleOf,
  watchPath,
} from "@/lib/utils";

const VideoPlayer = dynamic(
  () => import("@/components/video-player").then((module) => module.VideoPlayer),
  {
    ssr: false,
    loading: () => <div className="aspect-video w-full rounded-2xl border border-white/[0.08] bg-black" />,
  },
);

const EpisodeDownloadButton = dynamic(
  () => import("@/components/episode-download-button").then((module) => module.EpisodeDownloadButton),
  { ssr: false },
);

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
  const { mal_id: rawMalId, episode: rawEpisode } = use(params);
  const malId = idFromSlug(rawMalId);
  const episode = episodeNumberFromSlug(rawEpisode);
  const { t } = use(searchParams);
  const [server, setServer] = useState<StreamProviderId>(DEFAULT_STREAM_PROVIDER_ID);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [type, setType] = useState<"sub" | "dub">("sub");
  const [known, setKnown] = useState<Anime | undefined>();
  const [localResumeItem, setLocalResumeItem] = useState<Record<string, unknown> | undefined>();
  const [playedEps, setPlayedEps] = useState<number[]>([]);
  const [backupStreamsEnabled, setBackupStreamsEnabled] = useState(false);
  const [secondaryDataEnabled, setSecondaryDataEnabled] = useState(false);
  const { token } = useAuth();
  const settings = useSettings();
  const queryClient = useQueryClient();
  const router = useRouter();
  const episodeNum = Number(episode);
  const savedHistoryKey = useRef("");
  const lastProgressSave = useRef(0);
  const lastHttpProgressSave = useRef(0);
  const pendingHistoryBodyRef = useRef<Record<string, unknown> | null>(null);
  const latestPlaybackTimeRef = useRef(0);
  const historySocketRef = useRef<WebSocket | null>(null);
  const historySocketReadyRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setKnown(rememberedAnime(malId));
      setLocalResumeItem(rememberedProgress(malId, episodeNum) as Record<string, unknown> | undefined);
      markPlayed(malId, episodeNum);
      setPlayedEps(getPlayed(malId));
    }, 0);
    return () => window.clearTimeout(id);
  }, [episodeNum, malId]);

  useEffect(() => {
    setBackupStreamsEnabled(false);
    const id = window.setTimeout(() => setBackupStreamsEnabled(true), 4500);
    return () => window.clearTimeout(id);
  }, [episode, malId, type]);

  useEffect(() => {
    setSecondaryDataEnabled(false);
    const id = window.setTimeout(() => setSecondaryDataEnabled(true), 3000);
    return () => window.clearTimeout(id);
  }, [episode, malId]);

  const streamQueries = useQueries({
    queries: STREAM_PROVIDERS.map((provider) => ({
      queryKey: streamProviderQueryKey(provider, malId, episode, type),
      queryFn: () => fetchStreamProvider(provider, { malId, episode, type }),
      enabled: Boolean(malId) && Number.isFinite(episodeNum) && (
        provider.id === DEFAULT_STREAM_PROVIDER_ID ||
        backupStreamsEnabled ||
        serverMenuOpen
      ),
      retry: provider.retry,
      staleTime: 1000 * 60 * 25,
      gcTime: 1000 * 60 * 120,
    })),
  });

  const megaQuery = streamQueries[streamProviderIndex(DEFAULT_STREAM_PROVIDER_ID)];
  const megaHasPlayableStream = hasPlayableStream(megaQuery?.data);
  const showAudioControls = megaHasPlayableStream;
  const playableServers = STREAM_PROVIDERS.filter((provider, i) => {
    if (type === "dub") return provider.id === DEFAULT_STREAM_PROVIDER_ID && hasPlayableStream(streamQueries[i]?.data);
    return hasPlayableStream(streamQueries[i]?.data);
  });
  const availableServers = playableServers;
  const selectedServer = availableServers.find((s) => s.id === server) ?? availableServers[0];
  const selectedStream = selectedServer
    ? streamQueries[streamProviderIndex(selectedServer.id)]?.data
    : undefined;
  const selectedStreamForPlayer = selectedStream;
  const activeServerId = selectedServer?.id;
  const selectedQueryIndex = selectedServer ? streamProviderIndex(selectedServer.id) : 0;
  const selectedQuery = streamQueries[selectedQueryIndex];
  const availableServerIds = availableServers.map((s) => s.id).join("|");
  const firstAvailableServerId = availableServers[0]?.id;
  const streamsLoading = Boolean((selectedQuery?.isLoading || selectedQuery?.isFetching) || (!selectedStream && streamQueries.some((q) => q.isLoading || q.isFetching)));
  const allSettled = streamQueries.every((q) => q.isSuccess || q.isError);
  const streamError = allSettled && !playableServers.length;

  const episodes = useQuery({
    queryKey: ["episodes", malId, 0],
    queryFn: () => api.episodes(malId),
    enabled: Boolean(selectedStream || secondaryDataEnabled),
    staleTime: 1000 * 60 * 20,
  });

  const needsMetadataFallback = !known || titleOf(known) === "Untitled" || !posterOf(known);
  const metadataFallback = useQuery({
    queryKey: ["anime-metadata", malId],
    queryFn: () => fetchAnimeMetadataByMalId(malId),
    enabled: needsMetadataFallback && Number.isFinite(Number(malId)) && Boolean(selectedStream || secondaryDataEnabled),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const displayAnime = useMemo(
    () => ({
      ...(known ?? {}),
      ...(metadataFallback.data ?? {}),
      mal_id: malId,
    }) as Anime,
    [known, malId, metadataFallback.data],
  );

  const explicitResumeTime = Number(t || 0);
  const history = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token && malId && settings.autoResume && explicitResumeTime <= 0 && selectedStream),
    staleTime: 1000 * 20,
  });

  const animeTitle = titleOf(displayAnime);
  const animePoster = posterOf(displayAnime);
  const blockedAdultShow = isAdultRestrictedAnime(displayAnime);
  const noStreamTitle = blockedAdultShow ? "This title is not available here." : "Episode not available yet.";
  const noStreamMessage = blockedAdultShow
    ? "We do not stream 18+ restricted anime on animeTVplus."
    : "This episode is not available on our servers yet. Please try again later.";

  useEffect(() => {
    if (titleOf(displayAnime) !== "Untitled") {
      // Keep future direct visits and history rows titled without waiting on home data.
      rememberAnime(displayAnime);
    }
  }, [displayAnime, malId]);
  const serverResumeItem = useMemo(
    () => history.data?.find(
      (item) =>
        String(item.mal_id || item.anime_id) === malId &&
        Number(item.episode || item.episode_num || 1) === episodeNum,
    ),
    [episodeNum, history.data, malId],
  );
  const serverResumeTime = progressOf(serverResumeItem);
  const localResumeTime = progressOf(localResumeItem);
  const initialTime = explicitResumeTime > 0
    ? explicitResumeTime
    : settings.autoResume
      ? Number(serverResumeTime || localResumeTime || 0)
      : 0;

  const saveHistory = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.addHistory(token!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["history", token] });
    },
  });
  // Stable ref so saveWatchProgress never changes identity (avoids HLS restart)
  const saveHistoryRef = useRef(saveHistory.mutate);

  // Stable refs for title/poster/token so the callback deps stay minimal
  const animeTitleRef = useRef(animeTitle);
  const animePosterRef = useRef(animePoster);
  const tokenRef = useRef(token);

  useEffect(() => {
    saveHistoryRef.current = saveHistory.mutate;
  }, [saveHistory.mutate]);

  useEffect(() => {
    animeTitleRef.current = animeTitle;
  }, [animeTitle]);

  useEffect(() => {
    animePosterRef.current = animePoster;
  }, [animePoster]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!token) {
      historySocketReadyRef.current = false;
      historySocketRef.current?.close();
      historySocketRef.current = null;
      return;
    }

    let closed = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (closed) return;
      const socket = new WebSocket(historySocketUrl(token));
      historySocketRef.current = socket;
      historySocketReadyRef.current = false;

      socket.onopen = () => {
        historySocketReadyRef.current = true;
      };
      socket.onclose = () => {
        historySocketReadyRef.current = false;
        if (!closed) reconnectTimer = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => {
        historySocketReadyRef.current = false;
        socket.close();
      };
    };

    const connectTimer = window.setTimeout(connect, 5000);

    return () => {
      closed = true;
      if (connectTimer) window.clearTimeout(connectTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      historySocketReadyRef.current = false;
      historySocketRef.current?.close();
      historySocketRef.current = null;
    };
  }, [token]);

  const sendRealtimeHistory = useCallback((body: Record<string, unknown>) => {
    const socket = historySocketRef.current;
    if (!historySocketReadyRef.current || !socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(body));
      return true;
    } catch {
      return false;
    }
  }, []);

  const saveWatchProgress = useCallback(
    ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      if (!Number.isFinite(currentTime) || currentTime < 1) return;
      latestPlaybackTimeRef.current = currentTime;
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
      pendingHistoryBodyRef.current = body;
      rememberProgress(body);
      if (!tokenRef.current) return;

      sendRealtimeHistory(body);
      const shouldHttpFallback =
        now - lastHttpProgressSave.current > 15000 ||
        currentTime + 2 >= duration;

      if (shouldHttpFallback) {
        lastHttpProgressSave.current = now;
        saveHistoryRef.current(body);
      }
    },
    // Only re-create when episode/anime changes, not on every mutation state change
    [episodeNum, malId, sendRealtimeHistory],
  );

  useEffect(() => {
    if (!selectedStream) return;
    const key = `${malId}:${episodeNum}`;
    if (savedHistoryKey.current === key) return;
    savedHistoryKey.current = key;
    const body = {
      mal_id: malId, anime_id: malId, title: animeTitle,
      image_url: animePoster, poster: animePoster,
      episode: episodeNum, episode_num: episodeNum,
      playback_pos: Math.floor(initialTime || 0), progress: Math.floor(initialTime || 0),
      timestamp: Math.floor(initialTime || 0), watched_at: new Date().toISOString(),
    };
    pendingHistoryBodyRef.current = body;
    rememberProgress(body);
    if (token) {
      sendRealtimeHistory(body);
      lastHttpProgressSave.current = Date.now();
      saveHistoryRef.current(body);
    }
  }, [animePoster, animeTitle, episodeNum, initialTime, malId, token, selectedStream, sendRealtimeHistory]);

  useEffect(() => {
    if (!token) return;
    const flush = () => {
      const body = pendingHistoryBodyRef.current;
      if (!body) return;
      api.addHistoryKeepalive(token, body);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [episodeNum, malId, token]);

  useEffect(() => {
    if (!malId || !Number.isFinite(episodeNum)) return;
    queryClient.prefetchQuery({ queryKey: ["episodes", malId, 0], queryFn: () => api.episodes(malId), staleTime: 1000 * 60 * 20 });
    router.prefetch(watchPath(displayAnime, malId, episodeNum + 1));
  }, [displayAnime, episodeNum, malId, queryClient, router]);

  const maxEpisode = useMemo(
    () => episodes.data?.num_episodes || episodes.data?.episodes.at(-1)?.episode_number || 0,
    [episodes.data],
  );
  const hasPrev = episodeNum > 1;
  const hasNext = maxEpisode ? episodeNum < maxEpisode : true;
  const nextHref = hasNext ? watchPath(displayAnime, malId, episodeNum + 1) : undefined;
  const displayTitle = animeTitle === "Untitled" ? `Anime ${malId}` : animeTitle;

  function shareCurrentWatch() {
    const timestamp = Math.floor(latestPlaybackTimeRef.current || initialTime || 0);
    shareWatching({
      title: displayTitle,
      malId,
      episode: episodeNum,
      timestamp,
      href: `${watchPath(displayAnime, malId, episodeNum)}${timestamp > 1 ? `?t=${timestamp}` : ""}`,
    });
  }

  useEffect(() => {
    if (type === "dub" && megaHasPlayableStream && server !== DEFAULT_STREAM_PROVIDER_ID) {
      setServer(DEFAULT_STREAM_PROVIDER_ID);
      return;
    }
    if (type === "dub" && allSettled && !megaHasPlayableStream) {
      setType("sub");
      return;
    }
    if (!firstAvailableServerId) return;
    if (!availableServerIds.split("|").includes(server)) {
      setServer(firstAvailableServerId);
    }
  }, [allSettled, availableServerIds, firstAvailableServerId, megaHasPlayableStream, server, type]);

  function handlePlayerFatalError() {
    if (!activeServerId) return;
    const providerIndex = streamProviderIndex(activeServerId);
    const provider = STREAM_PROVIDERS[providerIndex];
    if (!provider) return;
    clearCachedStream(streamProviderCacheKey(provider, malId, episode, type));
    streamQueries[providerIndex]?.refetch();
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      setServer(DEFAULT_STREAM_PROVIDER_ID);
    }, 0);
    return () => window.clearTimeout(id);
  }, [episode, malId, type]);

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-2xl px-4 py-5 lg:px-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight size={13} />
          <Link href={animePath(displayAnime, malId)} className="hover:text-white transition-colors line-clamp-1 max-w-[200px]">
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
                  <p className="font-bold text-white">{noStreamTitle}</p>
                  <p className="mt-1 text-sm text-white/35">{noStreamMessage}</p>
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
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[0_24px_90px_rgba(0,0,0,0.72)] sm:rounded-[22px]">
                {animePoster ? (
                  <>
                    <Image src={animePoster} alt="" fill priority sizes="100vw" className="scale-105 object-cover opacity-80 blur-[1px]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/32" />
                  </>
                ) : (
                  <div className="absolute inset-0 animate-pulse bg-[#141828]" />
                )}
                <div className="absolute inset-0 grid place-items-center">
                  <div className="relative grid h-14 w-14 place-items-center rounded-full border border-white/[0.08] bg-black/18 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                    <div className="absolute inset-2 animate-spin rounded-full border-2 border-white/10 border-t-white/90" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.75)]" />
                  </div>
                </div>
              </div>
            ) : (
              <VideoPlayer
                key={`${activeServerId}-${type}-${selectedStreamForPlayer?.m3u8_url || selectedStreamForPlayer?.url || selectedStreamForPlayer?.stream_url}`}
                stream={selectedStreamForPlayer}
                poster={animePoster}
                serverId={activeServerId}
                title={`${displayTitle} · Episode ${episodeNum}`}
                initialTime={initialTime}
                autoPlay={settings.autoResume}
                deepBuffer={settings.autoFetchWhileWatching}
                nextHref={nextHref}
                onProgress={saveWatchProgress}
                onFatalError={handlePlayerFatalError}
              />
            )}

            {/* Episode nav strip */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link
                aria-disabled={!hasPrev}
                href={hasPrev ? watchPath(displayAnime, malId, episodeNum - 1) : "#"}
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
                <Radio size={13} className="text-[#c8ced8] animate-pulse" />
                <span className="text-xs font-semibold text-white/70">
                  {displayTitle} · Ep {episodeNum}
                </span>
              </div>

              <button
                type="button"
                onClick={shareCurrentWatch}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1020] px-3 text-xs font-black text-white/70 transition hover:border-[#e11d48]/35 hover:text-white"
              >
                <MessageCircle size={15} />
                <span className="hidden sm:inline">What am I watching</span>
              </button>

              <Link
                aria-disabled={!hasNext}
                href={nextHref ?? "#"}
                className={`inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
                  !hasNext
                    ? "pointer-events-none bg-white/[0.03] text-white/20"
                    : "bg-[#cf2442] text-white shadow-lg shadow-[#cf2442]/20 hover:bg-[#dc2d4b]"
                }`}
              >
                Next Episode
                <ChevronRight size={16} />
              </Link>
            </div>

            {/* Server + Audio bar */}
            <div className={`mt-3 grid gap-3 ${showAudioControls && activeServerId === DEFAULT_STREAM_PROVIDER_ID ? "xl:grid-cols-[1fr_auto_auto]" : "xl:grid-cols-[1fr_auto]"}`}>
              {/* Servers */}
              <div className="rounded-2xl border border-white/[0.055] bg-[#0d1020] p-3.5">
                <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">Stream Server</p>
                <div className="relative">
                  {streamsLoading && !availableServers.length ? (
                    <div className="h-11 w-full animate-pulse rounded-xl bg-[#141828]" />
                  ) : null}
                  {!streamsLoading && selectedServer ? (
                    <button
                      type="button"
                      aria-expanded={serverMenuOpen}
                      onClick={() => {
                        setBackupStreamsEnabled(true);
                        setServerMenuOpen((value) => !value);
                      }}
                      className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#141828] px-3.5 text-left transition hover:border-white/[0.13] hover:bg-[#1b2036]"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#c8ced8]" />
                          <span className="text-sm font-black text-white">{selectedServer.label}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/70">
                          {selectedServer.desc}
                        </span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 text-white/45 transition ${serverMenuOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : null}
                  {serverMenuOpen && availableServers.length ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close server list"
                        className="fixed inset-0 z-40"
                        onClick={() => setServerMenuOpen(false)}
                      />
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#090b14]/98 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                        {availableServers.map((s) => {
                          const isActive = activeServerId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setServer(s.id);
                                setServerMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                isActive
                                  ? "bg-[#cf2442]/16 text-white"
                                  : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-black">{s.label}</span>
                                <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/70">{s.desc}</span>
                              </span>
                              {isActive ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#cf2442]" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                  {!streamsLoading && !availableServers.length ? (
                    <span className="text-sm text-white/70">No servers responded</span>
                  ) : null}
                </div>
              </div>

              {showAudioControls ? (
                <div className="rounded-2xl border border-white/[0.055] bg-[#0d1020] p-3.5">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/70">Audio Track</p>
                  <div className="flex gap-2">
                    {(["sub", "dub"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => {
                          setType(a);
                          if (a === "dub") setServer(DEFAULT_STREAM_PROVIDER_ID);
                        }}
                        className={`rounded-xl px-4 py-2 text-sm font-bold uppercase transition ${
                          type === a
                            ? "bg-[#cf2442] text-white shadow-lg shadow-[#cf2442]/20"
                            : "border border-white/[0.07] bg-[#141828] text-white/70 hover:border-white/[0.14] hover:text-white"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeServerId === DEFAULT_STREAM_PROVIDER_ID ? (
                <EpisodeDownloadButton
                  stream={selectedStreamForPlayer}
                  malId={malId}
                  episode={episodeNum}
                  title={displayTitle}
                  poster={animePoster}
                  server={activeServerId}
                />
              ) : null}
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
          <div className="hidden min-h-[720px] w-[340px] shrink-0 xl:block">
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

function isAdultRestrictedAnime(anime: Anime | undefined) {
  if (!anime) return false;
  const record = anime as Anime & Record<string, unknown>;
  const values = [
    record.rating,
    record.rated,
    record.age_rating,
    record.certification,
    record.content_rating,
    record.genres,
    record.themes,
    record.demographics,
  ];

  return values.some((value) => {
    const text = Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(" ")
      : String(value ?? "");
    return /\b(rx|r\+|18\+|adult|hentai|ecchi)\b/i.test(text);
  });
}

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
          <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-white/70">
            {maxEpisode ? `${maxEpisode} total` : "…"}
          </span>
        </div>
        {ranges.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.04] px-3 py-2">
            {ranges.map((r, i) => (
              <button key={r.label} onClick={() => setActiveRange(i)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                  activeRange === i ? "bg-[#cf2442] text-white" : "bg-white/[0.05] text-white/70 hover:text-white"
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
                  <Link key={ep.episode_number} href={watchPath(undefined, malId, ep.episode_number)}
                    title={ep.title || `Episode ${ep.episode_number}`}
                    className={`grid h-10 place-items-center rounded-xl text-xs font-bold transition ${
                      isActive
                        ? "bg-[#cf2442] text-white shadow-md shadow-[#cf2442]/20"
                        : isPlayed
                          ? "bg-white/[0.08] text-[#c8ced8] ring-1 ring-white/10 hover:bg-white/[0.12]"
                          : "bg-[#141828] text-white/70 hover:bg-[#1b2036] hover:text-white"
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
    <div className="flex h-[calc(100vh-96px)] min-h-[720px] flex-col overflow-hidden rounded-2xl border border-white/[0.055] bg-[#0d1020]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-3">
        <div>
          <h2 className="text-sm font-black text-white">Episodes</h2>
          <p className="text-[11px] text-white/70">{maxEpisode ? `${maxEpisode} total` : "Loading…"}</p>
        </div>
        <span className="rounded-lg bg-[#cf2442]/14 px-2.5 py-1 text-[10px] font-bold text-white/60 ring-1 ring-[#cf2442]/20">
          Ep {currentEp}
        </span>
      </div>

      {/* Range tabs */}
      {ranges.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.04] px-3 py-2">
          {ranges.map((r, i) => (
            <button key={r.label} onClick={() => setActiveRange(i)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                activeRange === i ? "bg-[#cf2442] text-white" : "bg-white/[0.05] text-white/70 hover:text-white"
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
                  href={watchPath(undefined, malId, ep.episode_number)}
                  ref={isActive ? currentRef : null}
                  className={`group flex gap-3 border-b border-white/[0.04] p-3 transition-colors ${
                    isActive
                      ? "bg-[#cf2442]/10"
                      : isPlayed
                        ? "bg-white/[0.035] hover:bg-white/[0.06]"
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
                        <Play size={12} fill="currentColor" className={isActive ? "text-[#cf2442]" : "text-white"} />
                      </span>
                    </div>
                    {/* Episode number badge */}
                    <span className={`absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive
                        ? "bg-[#cf2442] text-white"
                        : isPlayed
                          ? "bg-white/25 text-white"
                          : "bg-black/70 text-white/80"
                    }`}>
                      {ep.episode_number}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${
                      isActive ? "text-[#cf2442]" : isPlayed ? "text-[#c8ced8]" : "text-white/30"
                    }`}>
                      {isActive ? "Now Playing" : isPlayed ? "Watched" : `Episode ${ep.episode_number}`}
                    </p>
                    <p className={`mt-0.5 line-clamp-2 text-xs leading-4 ${
                      isActive ? "font-semibold text-white" : isPlayed ? "text-white/50" : "text-white/60"
                    }`}>
                      {ep.title || `Episode ${ep.episode_number}`}
                    </p>
                    {isActive && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-[#c8ced8]">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-[#c8ced8]" />
                        LIVE
                      </span>
                    )}
                    {isPlayed && !isActive && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-[#c8ced8]">
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
