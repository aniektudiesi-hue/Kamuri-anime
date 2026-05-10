"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { Persister } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { AuthProvider } from "@/lib/auth";
import { makeQueryClient } from "@/lib/query";
import { SettingsProvider } from "@/lib/settings";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  const [persister, setPersister] = useState<Persister | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPersister(createSyncStoragePersister({
        key: "kairostream-query-cache-v3",
        storage: window.localStorage,
        throttleTime: 1000,
      }));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AuthProvider>{children}</AuthProvider>
        </SettingsProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        maxAge: 1000 * 60 * 60 * 6,
        persister,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = String(query.queryKey[0]);
            return query.state.status === "success" && !["me", "stream", "history", "watchlist", "downloads"].includes(key);
          },
        },
      }}
    >
      <SettingsProvider>
        <AuthProvider>{children}</AuthProvider>
      </SettingsProvider>
    </PersistQueryClientProvider>
  );
}
