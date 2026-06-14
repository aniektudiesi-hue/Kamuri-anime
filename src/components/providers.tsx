"use client";

import type { QueryKey } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthRequiredGate } from "@/components/auth-required-gate";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import { makeQueryClient } from "@/lib/query";
import { SettingsProvider } from "@/lib/settings";
import { HistoryPersistenceSync } from "@/components/history-persistence-sync";

const PERSISTED_QUERY_ROOTS = new Set([
  "anilist-discovery",
  "anime-metadata",
  "cr-card",
  "hero-cr-cards",
  "home-schedule",
  "recent",
  "spotlight",
  "thumbnails",
  "top-rated",
]);

const noopPersister = {
  persistClient: () => undefined,
  restoreClient: () => undefined,
  removeClient: () => undefined,
};

const queryPersister = typeof window === "undefined"
  ? noopPersister
  : createSyncStoragePersister({
    storage: window.localStorage,
    key: "animeTVplus-query-cache-v3",
    throttleTime: 1200,
  });

function shouldPersistQuery(queryKey: QueryKey) {
  const root = Array.isArray(queryKey) ? String(queryKey[0] || "") : "";
  return PERSISTED_QUERY_ROOTS.has(root);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 6,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success" && shouldPersistQuery(query.queryKey),
        },
      }}
    >
      <ChunkReloadGuard />
      <SettingsProvider>
        <AuthProvider>
          <AnalyticsTracker />
          <HistoryPersistenceSync />
          <AuthRequiredGate>{children}</AuthRequiredGate>
        </AuthProvider>
      </SettingsProvider>
    </PersistQueryClientProvider>
  );
}
