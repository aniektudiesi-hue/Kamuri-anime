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
    api.trackVisit({ path, referrer: document.referrer }, token);
  }, [pathname, token]);

  return null;
}
