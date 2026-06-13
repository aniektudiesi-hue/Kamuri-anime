"use client";

import { useEffect, useState } from "react";
import { BufferingScreen } from "@/components/buffering-screen";

const MIN_VISIBLE_MS = 520;
const MAX_VISIBLE_MS = 2200;
const BOOT_SEEN_KEY = "animeTVplus-boot-seen-v1";
const ROUTE_MIN_VISIBLE_MS = 280;
// Safety cap only — normally the loader exits the instant the detail page fires
// `atv:hero-ready` (banner + season ready). Kept high so the branded buffer
// persists through a slow detail fetch instead of flashing a half-loaded page.
const ROUTE_MAX_VISIBLE_MS = 3500;

export function BootLoader() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cleanupActive = () => undefined;

    const unlock = () => {
      document.documentElement.classList.remove("atv-boot-lock");
      document.body.classList.remove("atv-boot-lock");
    };

    const startLoader = ({
      markBootSeen,
      minVisibleMs,
      maxVisibleMs,
    }: {
      markBootSeen: boolean;
      minVisibleMs: number;
      maxVisibleMs: number;
    }) => {
      cleanupActive();
      const startedAt = performance.now();
      let finished = false;
      let minTimer: number | undefined;
      let exitTimer: number | undefined;
      let maxTimer: number | undefined;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (markBootSeen) window.sessionStorage.setItem(BOOT_SEEN_KEY, "1");
        const remaining = Math.max(0, minVisibleMs - (performance.now() - startedAt));
        window.clearTimeout(minTimer);
        minTimer = window.setTimeout(() => {
          setExiting(true);
          exitTimer = window.setTimeout(() => {
            if (markBootSeen) window.sessionStorage.setItem(BOOT_SEEN_KEY, "1");
            setVisible(false);
            unlock();
          }, 220);
        }, remaining);
      };

      document.documentElement.classList.add("atv-boot-lock");
      document.body.classList.add("atv-boot-lock");
      setExiting(false);
      setVisible(true);
      window.addEventListener("atv:hero-ready", finish, { once: true });
      maxTimer = window.setTimeout(finish, maxVisibleMs);

      cleanupActive = () => {
        window.removeEventListener("atv:hero-ready", finish);
        window.clearTimeout(minTimer);
        window.clearTimeout(exitTimer);
        window.clearTimeout(maxTimer);
        unlock();
      };
    };

    const handleRouteStart = () => {
      startLoader({
        markBootSeen: false,
        minVisibleMs: ROUTE_MIN_VISIBLE_MS,
        maxVisibleMs: ROUTE_MAX_VISIBLE_MS,
      });
    };

    window.addEventListener("atv:route-buffer-start", handleRouteStart);
    if (window.sessionStorage.getItem(BOOT_SEEN_KEY) === "1") {
      unlock();
    } else {
      startLoader({
        markBootSeen: true,
        minVisibleMs: MIN_VISIBLE_MS,
        maxVisibleMs: MAX_VISIBLE_MS,
      });
    }

    return () => {
      window.removeEventListener("atv:route-buffer-start", handleRouteStart);
      cleanupActive();
      unlock();
    };
  }, []);

  if (!visible) return null;

  return <BufferingScreen exiting={exiting} />;
}
