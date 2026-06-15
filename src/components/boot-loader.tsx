"use client";

import { useEffect, useState } from "react";
import { BufferingScreen } from "@/components/buffering-screen";

// Safety cap — the buffer normally exits the instant the detail page fires
// `atv:hero-ready` (data + hero image painted). This just guarantees it can
// never hang if a backend/image is slow. Kept slightly above the detail page's
// own 4s escape so they line up.
const ROUTE_MAX_VISIBLE_MS = 4500;

export function BootLoader() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let exitTimer: number | undefined;
    let maxTimer: number | undefined;

    const unlock = () => {
      document.documentElement.classList.remove("atv-boot-lock");
      document.body.classList.remove("atv-boot-lock");
    };

    const finish = () => {
      window.clearTimeout(maxTimer);
      setExiting(true);
      exitTimer = window.setTimeout(() => {
        setVisible(false);
        setExiting(false);
        unlock();
      }, 220);
    };

    const handleStart = () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(maxTimer);
      window.removeEventListener("atv:hero-ready", finish);
      document.documentElement.classList.add("atv-boot-lock");
      document.body.classList.add("atv-boot-lock");
      setExiting(false);
      setVisible(true);
      // Exit the moment the destination page is fully ready (its hero image has
      // painted), or after the safety cap — whichever comes first.
      window.addEventListener("atv:hero-ready", finish, { once: true });
      maxTimer = window.setTimeout(finish, ROUTE_MAX_VISIBLE_MS);
    };

    window.addEventListener("atv:route-buffer-start", handleStart);
    return () => {
      window.removeEventListener("atv:route-buffer-start", handleStart);
      window.removeEventListener("atv:hero-ready", finish);
      window.clearTimeout(exitTimer);
      window.clearTimeout(maxTimer);
      unlock();
    };
  }, []);

  if (!visible) return null;
  return <BufferingScreen exiting={exiting} />;
}
