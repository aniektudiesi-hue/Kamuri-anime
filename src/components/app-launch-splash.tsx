"use client";

import { useEffect } from "react";
import { hideNativeSplash, setupHardwareBack, setupStatusBar } from "@/lib/native";

// No web overlay any more — the layout paints directly (fast, no scroll-lock,
// no LCP-blocking cover). On the packaged app the NATIVE splash covers cold
// start; we just hide it once the first meaningful paint is ready, and wire the
// native status bar + hardware back button.
export function AppLaunchSplash() {
  useEffect(() => {
    setupStatusBar();
    const teardownBack = setupHardwareBack();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      hideNativeSplash();
    };
    window.addEventListener("atv:hero-ready", finish, { once: true });
    const onLoad = () => window.setTimeout(finish, 250);
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    const safety = window.setTimeout(finish, 4000);

    return () => {
      teardownBack();
      window.removeEventListener("atv:hero-ready", finish);
      window.removeEventListener("load", onLoad);
      window.clearTimeout(safety);
    };
  }, []);

  return null;
}
