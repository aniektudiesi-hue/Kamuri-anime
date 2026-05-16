"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { AuthRequiredGate } from "@/components/auth-required-gate";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { makeQueryClient } from "@/lib/query";
import { SettingsProvider } from "@/lib/settings";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <AnalyticsTracker />
          <AuthRequiredGate>{children}</AuthRequiredGate>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
