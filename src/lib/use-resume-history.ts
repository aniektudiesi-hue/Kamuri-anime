"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { LibraryItem } from "./types";
import { progressOf } from "./utils";

function historyForAnime(items: LibraryItem[] | undefined, malId: string) {
  return items?.find((item) => String(item.mal_id || item.anime_id) === malId);
}

export function useResumeHistory(malId: string) {
  const { token } = useAuth();

  const history = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token && malId),
    staleTime: 1000 * 20,
  });

  const item = historyForAnime(history.data, malId);
  const episode = item?.episode || item?.episode_num || 1;
  const progress = progressOf(item);
  const href = item
    ? `/watch/${malId}/${episode}${progress > 1 ? `?t=${Math.floor(progress)}` : ""}`
    : `/watch/${malId}/1`;

  return {
    item,
    episode,
    progress,
    href,
    hasResume: Boolean(item),
    isLoading: history.isLoading,
  };
}
