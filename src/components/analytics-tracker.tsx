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
    const makePayload = () => {
      const path = `${window.location.pathname}${window.location.search}`;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const language = navigator.language || "";
      const screen = `${window.screen.width}x${window.screen.height}`;
      return { path, referrer: document.referrer, timezone, language, screen };
    };

    const path = `${window.location.pathname}${window.location.search}`;
    const identity = token ? `user:${token.slice(-10)}` : "guest";
    const key = `${identity}:${path}`;
    if (lastTrackedKey.current === key) return;

    const isWatchPage = path.startsWith("/watch/");
    const timer = window.setTimeout(() => {
      lastTrackedKey.current = key;
      api.trackVisit(makePayload(), token);
    }, isWatchPage ? 9000 : token ? 1500 : 6000);

    return () => window.clearTimeout(timer);
  }, [pathname, token]);

  useEffect(() => {
    if (!token) return;

    const sendPresence = () => {
      if (document.visibilityState === "hidden") return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const language = navigator.language || "";
      const screen = `${window.screen.width}x${window.screen.height}`;
      api.trackVisit(
        {
          path: `${window.location.pathname}${window.location.search}`,
          referrer: document.referrer,
          timezone,
          language,
          screen,
        },
        token,
      );
    };

    const interval = window.setInterval(sendPresence, 120_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") sendPresence();
    };
    const firstPresence = window.setTimeout(
      sendPresence,
      window.location.pathname.startsWith("/watch/") ? 15_000 : 8000,
    );
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(firstPresence);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  return null;
}
