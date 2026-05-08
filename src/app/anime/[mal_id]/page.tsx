"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Play, Plus, Star } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button, ButtonLink } from "@/components/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Anime } from "@/lib/types";
import { animeId, displayStatus, episodeCount, posterOf, rememberedAnime, titleOf } from "@/lib/utils";

export default function AnimeDetailPage({ params }: { params: Promise<{ mal_id: string }> }) {
  const { mal_id: malId } = use(params);
  const { token, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [clickedAnime, setClickedAnime] = useState<Anime | undefined>();

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
    [...(thumbs.data ?? []), ...(recent.data ?? []), ...(top.data ?? [])].find((item) => animeId(item) === malId)) as Anime | undefined;
  const hint = episodeCount(known);

  const episodes = useQuery({
    queryKey: ["episodes", malId, hint],
    queryFn: () => api.episodes(malId, hint),
    staleTime: 1000 * 60 * 20,
  });

  const history = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token),
  });
  const last = history.data?.find((item) => String(item.mal_id || item.anime_id) === malId);
  const watchlist = useQuery({
    queryKey: ["watchlist", token],
    queryFn: () => api.watchlist(token!),
    enabled: Boolean(token),
  });
  const inWatchlist = Boolean(watchlist.data?.some((item) => String(item.mal_id || item.anime_id) === malId));

  const addWatchlist = useMutation({
    mutationFn: () => api.addWatchlist(token!, { mal_id: malId, anime_id: malId, title: titleOf(known), image_url: posterOf(known), episodes: hint }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  function prefetchWatch(episodeNumber: number) {
    queryClient.prefetchQuery({
      queryKey: ["stream", malId, episodeNumber, "mega", "sub"],
      queryFn: () => api.stream(malId, episodeNumber, "sub"),
      staleTime: 1000 * 60 * 3,
    });
  }

  const episodeTotal = episodes.data?.num_episodes || hint;

  return (
    <AppShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-35">
          {posterOf(known) ? <Image src={posterOf(known)} alt="" fill sizes="100vw" className="object-cover blur-2xl" /> : null}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[260px_1fr]">
          <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-panel-strong shadow-2xl">
            {posterOf(known) ? <Image src={posterOf(known)} alt={titleOf(known)} fill priority sizes="260px" className="object-cover" /> : null}
          </div>
          <div className="self-end pb-2">
            <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold uppercase text-accent-2">
              <span>{displayStatus(known?.status)}</span>
              <span>{episodeTotal ? `${episodeTotal} Episodes` : "Episodes TBA"}</span>
              <span className="flex items-center gap-1"><Star size={13} className="fill-accent-2" /> {known?.score || "NA"}</span>
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">{titleOf(known) || `Anime ${malId}`}</h1>
            {known?.title_jp ? <p className="mt-3 text-muted">{known.title_jp}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={`/watch/${malId}/${last?.episode || last?.episode_num || 1}`}>
                <Play size={17} fill="currentColor" />
                {last ? "Continue watching" : "Watch episode 1"}
              </ButtonLink>
              <Button disabled={!isLoggedIn || inWatchlist || addWatchlist.isPending} onClick={() => addWatchlist.mutate()} variant={inWatchlist ? "primary" : "panel"}>
                {inWatchlist ? <Check size={17} /> : <Plus size={17} />}
                {!isLoggedIn ? "Login for watchlist" : inWatchlist ? "In watchlist" : addWatchlist.isPending ? "Adding..." : "Add to watchlist"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="mb-4 text-xl font-black">Episodes</h2>
        {episodes.isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: 36 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-panel-strong" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-12">
            {episodes.data?.episodes.map((episode) => (
              <Link
                key={episode.episode_number}
                href={`/watch/${malId}/${episode.episode_number}`}
                onMouseEnter={() => prefetchWatch(episode.episode_number)}
                onFocus={() => prefetchWatch(episode.episode_number)}
                className="rounded-md bg-panel-strong px-3 py-3 text-center text-sm font-bold hover:bg-accent"
              >
                {episode.episode_number}
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
