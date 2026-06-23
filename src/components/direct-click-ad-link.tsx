"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const AD_SCRIPT_ID = "atv-effectivecpmnetwork-zone";
const AD_SCRIPT_SRC = "https://pl29847637.effectivecpmnetwork.com/09/a6/85/09a685d2ea6aadb616655a48d61f7f4c.js";
const SKIP_PREFIXES = ["/watch/", "/embed/", "/offline/"];

function trackAdEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  try {
    window.dispatchEvent(new CustomEvent("atv-ad-event", { detail: { name, ...params } }));
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", name, params);
  } catch {
    // Analytics must never block navigation or playback.
  }
}

/**
 * Interaction ad tag.
 * Revert point: remove <DirectClickAdLink /> from layout and delete this file.
 */
export function DirectClickAdLink() {
  const pathname = usePathname();

  useEffect(() => {
    if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      document.getElementById(AD_SCRIPT_ID)?.remove();
      return;
    }
    if (document.getElementById(AD_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = AD_SCRIPT_ID;
    script.dataset.cfasync = "false";
    script.async = true;
    script.src = AD_SCRIPT_SRC;
    script.onload = () => trackAdEvent("ad_tag_loaded", { path: pathname, network: "effectivecpmnetwork" });
    script.onerror = () => trackAdEvent("ad_tag_failed", { path: pathname, network: "effectivecpmnetwork" });

    const host = [document.documentElement, document.body].filter(Boolean).pop();
    host?.appendChild(script);
  }, [pathname]);

  return null;
}
