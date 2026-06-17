"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// AdsMaven / MagSrv — same network as the VAST preroll (s.magsrv.com).
// Replace with your popunder zone ID from: Dashboard → Sites → Zones → Popunder
const POPUNDER_ZONE_ID = "5947876";

// Only truly dead-end pages (offline downloads) skip entirely.
const SKIP_PREFIXES = ["/offline/", "/embed/"];

// Global frequency cap — popunder fires at most once per this many ms.
// 30 min on browse pages; player pages get a longer 45-min window so a
// binge watcher isn't hit every episode.
const CAP_BROWSE_MS = 30 * 60 * 1000;
const CAP_PLAYER_MS = 45 * 60 * 1000;
const FREQ_CAP_KEY = "atv-am-last-pop";

function isPlayerPage(pathname: string) {
  return pathname.startsWith("/watch/");
}

function freqCapMs(pathname: string) {
  return isPlayerPage(pathname) ? CAP_PLAYER_MS : CAP_BROWSE_MS;
}

function isCapped(pathname: string) {
  try {
    const last = Number(localStorage.getItem(FREQ_CAP_KEY) || 0);
    return Date.now() - last < freqCapMs(pathname);
  } catch {
    return false;
  }
}

function stampCap() {
  try { localStorage.setItem(FREQ_CAP_KEY, String(Date.now())); } catch { /* ignore */ }
}

/**
 * AdsMaven popunder — fires on all pages (including the video player) but is
 * frequency-capped so binge watchers aren't hit on every episode.
 * Deferred until first user interaction so it never blocks LCP / HLS startup.
 */
export function AdsMavenAds() {
  const pathname = usePathname();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (injectedRef.current) return;

    const inject = () => {
      if (injectedRef.current) return;
      if (isCapped(pathname)) return;
      injectedRef.current = true;
      stampCap();

      // On player pages wait an extra 3 s after interaction so the tap
      // isn't the one that started playback — feels less intrusive.
      const delay = isPlayerPage(pathname) ? 3000 : 0;
      window.setTimeout(() => {
        const ins = document.createElement("ins");
        ins.className = "eas6a97888e";
        ins.dataset.zoneid = POPUNDER_ZONE_ID;
        document.body.appendChild(ins);

        const script = document.createElement("script");
        script.async = true;
        script.setAttribute("data-cfasync", "false");
        script.src = "//a.magsrv.com/ad-provider.js";
        document.head.appendChild(script);

        script.onload = () => {
          try {
            const w = window as unknown as Record<string, unknown>;
            if (!w["AdProvider"]) w["AdProvider"] = [];
            (w["AdProvider"] as Array<unknown>).push({ serve: {} });
          } catch {
            // Ad blocker present — content is unaffected.
          }
        };
      }, delay);
    };

    const opts: AddEventListenerOptions = { passive: true, once: true };
    window.addEventListener("click", inject, opts);
    window.addEventListener("touchstart", inject, opts);

    // Fallback for visits with no interaction (fast readers, return visitors).
    const timer = window.setTimeout(inject, 5000);

    return () => {
      window.removeEventListener("click", inject);
      window.removeEventListener("touchstart", inject);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
