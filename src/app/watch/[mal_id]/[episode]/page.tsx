"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { VideoPlayer } from "@/components/video-player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Anime, StreamResponse } from "@/lib/types";
import { posterOf, rememberedAnime, rememberedProgress, rememberProgress, titleOf } from "@/lib/utils";

const servers = [
  { id: "mega", label: "MegaPlay" },
  { id: "moon", label: "Moon" },
  { id: "hd1", label: "HD1" },
] as const;

type ServerId = (typeof servers)[number]["id"];

function hasPlayableStream(data: StreamResponse | undefined) {
  return Boolean(data?.m3u8_url || data?.url || data?.stream_url);
}

function fetchServer(serverId: ServerId, malId: string, episode: string, type: "sub" | "dub") {
  if (serverId === "mega") return api.stream(malId, episode, type);
  if (serverId === "moon") return api.moon(malId, episode);
  return api.hd1(malId, episode);
}

export default function WatchPage({ params, searchParams }: { params: Promise<{ mal_id: string; episode: string }>; searchParams: Promise<{ t?: string }> }) {
  const { mal_id: malId, episode } = use(params);
  const { t } = use(searchParams);
  const [server, setServer] = useState<ServerId>("mega");
  const [type, setType] = useState<"sub" | "dub">("sub");
  const [known, setKnown] = useState<Anime | undefined>();
  const [localResumeTime, setLocalResumeTime] = useState(0);
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const episodeNum = Number(episode);
  const savedHistoryKey = useRef("");
  const lastProgressSave = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setKnown(rememberedAnime(malId));
      const saved = rememberedProgress(malId, episodeNum);
      setLocalResumeTime(Number(saved?.progress || saved?.timestamp || 0));
    }, 0);
    return () => window.clearTimeout(id);
  }, [episodeNum, malId]);

  const streamQueries = useQueries({
    queries: servers.map((item) => ({
      queryKey: ["stream", malId, episode, item.id, item.id === "mega" ? type : "any"],
      queryFn: () => fetchServer(item.id, malId, episode, type),
      enabled: Boolean(malId) && Number.isFinite(episodeNum),
      retry: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
    })),
  });

  const availableServers = servers.filter((item, index) => hasPlayableStream(streamQueries[index]?.data));
  const megaQuery = streamQueries[0];
  const megaAvailable = hasPlayableStream(megaQuery?.data);
  const selectedServer =
    server === "mega" && !megaAvailable && (megaQuery?.isLoading || megaQuery?.isFetching)
      ? undefined
      : availableServers.find((item) => item.id === server) ?? (megaAvailable ? servers[0] : availableServers[0]);
  const selectedStream = selectedServer ? streamQueries[servers.findIndex((item) => item.id === selectedServer.id)]?.data : undefined;
  const activeServerId = selectedServer?.id;
  const streamsLoading = streamQueries.some((query) => query.isLoading || query.isFetching);
  const allStreamsSettled = streamQueries.every((query) => query.isSuccess || query.isError);
  const streamError = allStreamsSettled && !availableServers.length;

  const episodes = useQuery({
    queryKey: ["episodes", malId, 0],
    queryFn: () => api.episodes(malId),
    staleTime: 1000 * 60 * 20,
  });

  const animeTitle = titleOf(known);
  const animePoster = posterOf(known);
  const initialTime = Number(t || localResumeTime || 0);

  const saveHistory = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.addHistory(token!, body),
  });

  const saveWatchProgress = useCallback(
    ({ currentTime, duration }: { currentTime: number; duration: number }) => {
      if (!Number.isFinite(currentTime) || currentTime < 1) return;
      const now = Date.now();
      if (now - lastProgressSave.current < 12000 && currentTime + 2 < duration) return;
      lastProgressSave.current = now;
      const body = {
        mal_id: malId,
        anime_id: malId,
        title: animeTitle,
        poster: animePoster,
        episode: episodeNum,
        episode_num: episodeNum,
        progress: Math.floor(currentTime),
        timestamp: Math.floor(currentTime),
        duration: Math.floor(duration || 0),
        watched_at: new Date().toISOString(),
      };
      rememberProgress(body);
      if (token) saveHistory.mutate(body);
    },
    [animePoster, animeTitle, episodeNum, malId, saveHistory, token],
  );

  useEffect(() => {
    const key = `${malId}:${episodeNum}`;
    if (token && selectedStream && savedHistoryKey.current !== key) {
      savedHistoryKey.current = key;
      saveHistory.mutate({
        mal_id: malId,
        anime_id: malId,
        title: animeTitle,
        poster: animePoster,
        episode: episodeNum,
        episode_num: episodeNum,
        progress: Math.floor(initialTime || 0),
        timestamp: Math.floor(initialTime || 0),
        watched_at: new Date().toISOString(),
      });
    }
  }, [animePoster, animeTitle, episodeNum, initialTime, malId, saveHistory, token, selectedStream]);

  useEffect(() => {
    if (!malId || !Number.isFinite(episodeNum)) return;
    queryClient.prefetchQuery({ queryKey: ["episodes", malId, 0], queryFn: () => api.episodes(malId), staleTime: 1000 * 60 * 20 });
    queryClient.prefetchQuery({ queryKey: ["stream", malId, episodeNum + 1, "mega", type], queryFn: () => api.stream(malId, episodeNum + 1, type), staleTime: 1000 * 60 * 2, gcTime: 1000 * 60 * 10 });
    router.prefetch(`/watch/${malId}/${episodeNum + 1}`);
  }, [episodeNum, malId, queryClient, router, type]);

  const maxEpisode = useMemo(() => episodes.data?.num_episodes || episodes.data?.episodes.at(-1)?.episode_number || 0, [episodes.data]);
  const hasPrev = episodeNum > 1;
  const hasNext = maxEpisode ? episodeNum < maxEpisode : true;
  const nextHref = hasNext ? `/watch/${malId}/${episodeNum + 1}` : undefined;

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-accent-2">Watching</p>
            <h1 className="text-2xl font-black">{animeTitle === "Untitled" ? `Anime ${malId}` : animeTitle} - Episode {episodeNum}</h1>
          </div>
          <div className="flex gap-2">
            <Link aria-disabled={!hasPrev} href={hasPrev ? `/watch/${malId}/${episodeNum - 1}` : "#"} className={`grid h-10 w-10 place-items-center rounded-md bg-panel-strong ${!hasPrev ? "pointer-events-none opacity-40" : "hover:bg-white/10"}`}>
              <ChevronLeft size={18} />
            </Link>
            <Link aria-disabled={!hasNext} href={nextHref ?? "#"} className={`grid h-10 w-10 place-items-center rounded-md bg-panel-strong ${!hasNext ? "pointer-events-none opacity-40" : "hover:bg-white/10"}`}>
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {streamError ? (
          <div className="grid aspect-video place-items-center rounded-md border border-red-400/30 bg-red-950/20 text-center">
            <div>
              <AlertTriangle className="mx-auto mb-3 text-red-300" />
              <p className="font-semibold">Stream unavailable on all servers.</p>
              <Button onClick={() => streamQueries.forEach((query) => query.refetch())} className="mt-4">
                <RefreshCcw size={16} />
                Retry
              </Button>
            </div>
          </div>
        ) : streamsLoading && !selectedStream ? (
          <div className="aspect-video w-full rounded-md bg-black" />
        ) : (
          <VideoPlayer
            key={`${activeServerId}-${type}-${selectedStream?.m3u8_url || selectedStream?.url || selectedStream?.stream_url || selectedStream?.iframe_url || selectedStream?.embed_url}`}
            stream={selectedStream}
            title={`${animeTitle === "Untitled" ? `Anime ${malId}` : animeTitle} episode ${episodeNum}`}
            initialTime={initialTime}
            nextHref={nextHref}
            onProgress={saveWatchProgress}
          />
        )}

        <div className="mt-5 grid gap-4 rounded-md border border-white/10 bg-panel p-4 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="font-black">Servers</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {streamsLoading && !availableServers.length ? (
                <span className="rounded-md bg-panel-strong px-4 py-2 text-sm font-semibold text-muted">Checking availability...</span>
              ) : null}
              {availableServers.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={activeServerId === item.id}
                  onClick={() => setServer(item.id)}
                  className={`h-10 rounded-md px-4 text-sm font-bold ${activeServerId === item.id ? "bg-accent text-white" : "bg-panel-strong text-muted hover:text-white"}`}
                >
                  {item.label}
                </button>
              ))}
              {!streamsLoading && !availableServers.length ? (
                <span className="rounded-md bg-panel-strong px-4 py-2 text-sm font-semibold text-muted">No servers available</span>
              ) : null}
            </div>
          </div>
          <div>
            <h2 className="font-black">Audio</h2>
            <div className="mt-3 flex gap-2">
              {(["sub", "dub"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setType(item);
                    setServer("mega");
                  }}
                  className={`h-10 rounded-md px-4 text-sm font-bold uppercase ${type === item ? "bg-accent-2 text-black" : "bg-panel-strong text-muted hover:text-white"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
