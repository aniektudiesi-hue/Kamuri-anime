"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { LibraryItem } from "./types";
import { HISTORY_UPDATED_EVENT, progressOf, rememberedHistory } from "./utils";

function historyTime(item: LibraryItem | undefined) {
  const watchedAt = item?.watched_at;
  if (typeof watchedAt === "number") return watchedAt < 10_000_000_000 ? watchedAt * 1000 : watchedAt;
  if (typeof watchedAt === "string") {
    const numeric = Number(watchedAt);
    if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(watchedAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function historyForAnime(items: LibraryItem[] | undefined, malId: string) {
  return items?.find((item) => String(item.mal_id || item.anime_id) === malId);
}

export function useResumeHistory(malId: string) {
  const { token } = useAuth();
  const [localItem, setLocalItem] = useState<LibraryItem | undefined>();

  useEffect(() => {
    if (!malId) return;
    const sync = () => setLocalItem(historyForAnime(rememberedHistory(), malId));
    sync();
    window.addEventListener(HISTORY_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(HISTORY_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [malId]);

  const history = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token && malId),
    staleTime: 1000 * 20,
  });

  const remoteItem = historyForAnime(history.data, malId);
  const item = useMemo(() => {
    if (!localItem) return remoteItem;
    if (!remoteItem) return localItem;
    return historyTime(localItem) >= historyTime(remoteItem) ? localItem : remoteItem;
  }, [localItem, remoteItem]);

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
