"use client";

import Image from "next/image";
import { useQueries } from "@tanstack/react-query";
import { VideoPlayer } from "@/components/video-player";
import {
  DEFAULT_STREAM_PROVIDER_ID,
  STREAM_PROVIDERS,
  fetchStreamProvider,
  hasPlayableStream,
  streamProviderQueryKey,
} from "@/lib/stream-providers";
import type { Anime } from "@/lib/types";
import { posterOf, titleOf } from "@/lib/utils";

export function VideoEmbedPage({
  malId,
  episode,
  anime,
}: {
  malId: string;
  episode: string;
  anime?: Anime;
}) {
  const episodeNumber = Number(episode);
  const title = titleOf(anime) === "Untitled" ? `Anime ${malId}` : titleOf(anime);
  const poster = posterOf(anime);

  const streamQueries = useQueries({
    queries: STREAM_PROVIDERS.map((provider) => ({
      queryKey: streamProviderQueryKey(provider, malId, episode, "sub"),
      queryFn: () => fetchStreamProvider(provider, { malId, episode, type: "sub" }),
      enabled: Boolean(malId) && Number.isFinite(episodeNumber),
      retry: provider.retry,
      staleTime: 1000 * 60 * 25,
      gcTime: 1000 * 60 * 120,
    })),
  });

  const playableIndex = streamQueries.findIndex((query) => hasPlayableStream(query.data));
  const selectedProvider = playableIndex >= 0 ? STREAM_PROVIDERS[playableIndex] : STREAM_PROVIDERS[0];
  const selectedStream = playableIndex >= 0 ? streamQueries[playableIndex]?.data : undefined;
  const loading = streamQueries.some((query) => query.isLoading || query.isFetching);
  const allSettled = streamQueries.every((query) => query.isSuccess || query.isError);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center p-3">
        {selectedStream ? (
          <VideoPlayer
            stream={selectedStream}
            poster={poster}
            serverId={selectedProvider?.id || DEFAULT_STREAM_PROVIDER_ID}
            title={`${title} Episode ${episode}`}
            autoPlay={false}
            deepBuffer={false}
          />
        ) : (
          <div className="relative grid aspect-video w-full max-w-6xl place-items-center overflow-hidden rounded-2xl bg-[#080a12]">
            {poster ? (
              <>
                <Image src={poster} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
                <div className="absolute inset-0 bg-black/70" />
              </>
            ) : null}
            <div className="relative z-10 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/5">
                {loading ? <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white" /> : null}
              </div>
              <h1 className="text-xl font-black">{title} Episode {episode}</h1>
              <p className="mt-2 text-sm text-white/45">
                {allSettled ? "This episode is not available on our servers yet." : "Preparing player..."}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

