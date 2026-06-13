"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Bump this id whenever the message changes so the banner re-shows for everyone
// who dismissed the previous one.
const ANNOUNCEMENT_ID = "atvplus-back-app-migration-2026-06";
const DISMISS_KEY = `atvplus-announcement-${ANNOUNCEMENT_ID}`;

export function AnnouncementBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore — banner just reappears next visit, harmless
    }
  };

  return (
    <div className="relative z-[60] border-b border-[#c4182a]/30 bg-gradient-to-r from-[#c4182a]/18 via-[#0c0c0e] to-[#c4182a]/10">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2 lg:px-6">
        <span className="hidden shrink-0 rounded-md bg-[#c4182a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:inline-block">
          We&apos;re back
        </span>
        <p className="flex-1 text-[12px] leading-snug text-white/85 sm:text-[12.5px]">
          <span aria-hidden="true">👋 </span>
          <span className="font-semibold text-white">Hello dear user — AnimeTV+ is back, enjoy!</span>{" "}
          We&apos;re launching apps for <span className="font-medium text-white">Mac, Windows &amp; Android</span> soon — when
          they&apos;re out, please install the app, as we&apos;ll be moving service from the website to the app. We&apos;re
          actively fixing any errors and reopened the site so you don&apos;t have to wait. Thank you!{" "}
          <span aria-hidden="true">💛</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-md p-1 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
