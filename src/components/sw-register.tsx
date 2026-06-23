"use client";

import { useEffect } from "react";

// Registers the root service worker (Monetag native anti-adblock + offline shell
// + progressive playback) and,
// when the app is launched with no connectivity, sends the user straight to the
// offline downloads page — the key hybrid behaviour: the packaged app still
// opens (to your saved episodes) even with no internet.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Cold-launch offline → jump straight to the self-contained downloads shell.
    if (!navigator.onLine && window.location.pathname !== "/offline.html") {
      window.location.replace("/offline.html");
      return;
    }

    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
