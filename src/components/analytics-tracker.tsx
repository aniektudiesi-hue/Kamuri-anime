"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const { token } = useAuth();
  const lastPath = useRef("");

  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    if (lastPath.current === path) return;
    lastPath.current = path;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const language = navigator.language || "";
    const screen = `${window.screen.width}x${window.screen.height}`;
    api.trackVisit({ path, referrer: document.referrer, timezone, language, screen }, token);
  }, [pathname, token]);

  return null;
}
