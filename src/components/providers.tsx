"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { ChatWidget } from "@/components/chat-widget";
import { makeQueryClient } from "@/lib/query";
import { SettingsProvider } from "@/lib/settings";
import { VisitGate } from "@/components/visit-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <AnalyticsTracker />
          <VisitGate />
          <ChatWidget />
          {children}
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
