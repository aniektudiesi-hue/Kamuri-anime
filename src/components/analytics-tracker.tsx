"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const { token } = useAuth();
  const lastTrackedKey = useRef("");

  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    const identity = token ? `user:${token.slice(-10)}` : "guest";
    const key = `${identity}:${path}`;
    if (lastTrackedKey.current === key) return;

    const timer = window.setTimeout(() => {
      lastTrackedKey.current = key;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const language = navigator.language || "";
      const screen = `${window.screen.width}x${window.screen.height}`;
      api.trackVisit({ path, referrer: document.referrer, timezone, language, screen }, token);
    }, token ? 250 : 900);

    return () => window.clearTimeout(timer);
  }, [pathname, token]);

  return null;
}
