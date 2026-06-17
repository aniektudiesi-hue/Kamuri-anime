"use client";

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 60 * 6,  // 6 hours — no mid-session refetches
        gcTime: 1000 * 60 * 60 * 24,   // 24 hours — persisted cache stays warm
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
