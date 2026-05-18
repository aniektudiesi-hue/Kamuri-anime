"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { HISTORY_UPDATED_EVENT, rememberedHistory } from "@/lib/utils";

const SYNC_MARK_PREFIX = "anime-tv-history-sync:";
const SYNC_THROTTLE_MS = 10_000;

export function HistoryPersistenceSync() {
  const { token, isReady } = useAuth();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);
  const lastSyncRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isReady || !token) return;

    const sync = async () => {
      if (syncingRef.current) return;
      const now = Date.now();
      if (now - lastSyncRef.current < SYNC_THROTTLE_MS) return;
      const localItems = rememberedHistory(200);
      if (!localItems.length) return;

      const newest = localItems
        .map((item) => Number(item.watched_at || item.created_at || 0))
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] || 0;
      const markerKey = `${SYNC_MARK_PREFIX}${token.slice(-24)}`;
      const marker = `${localItems.length}:${newest}`;
      if (window.localStorage.getItem(markerKey) === marker) return;

      syncingRef.current = true;
      lastSyncRef.current = now;
      try {
        await api.syncHistory(token, localItems);
        window.localStorage.setItem(markerKey, marker);
        queryClient.invalidateQueries({ queryKey: ["history", token] });
      } finally {
        syncingRef.current = false;
      }
    };

    const schedule = (delay = 1200) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => void sync(), { timeout: 2500 });
        } else {
          void sync();
        }
      }, delay);
    };

    const onHistoryUpdated = () => schedule(2500);
    const onOnline = () => schedule(500);

    schedule();
    window.addEventListener(HISTORY_UPDATED_EVENT, onHistoryUpdated);
    window.addEventListener("online", onOnline);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener(HISTORY_UPDATED_EVENT, onHistoryUpdated);
      window.removeEventListener("online", onOnline);
    };
  }, [isReady, queryClient, token]);

  return null;
}
