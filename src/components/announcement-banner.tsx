"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const ANNOUNCEMENT_ID = "atvplus-server-work-india-only-2026-06-15";
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
      // ignore; the banner can reappear next visit.
    }
  };

  return (
    <div className="relative z-[60] border-b border-amber-400/25 bg-[#0b0b0d]">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2.5 lg:px-6">
        <span className="hidden shrink-0 items-center gap-1.5 rounded-md bg-amber-400/12 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200 sm:inline-flex">
          <AlertTriangle size={13} />
          Server update
        </span>
        <p className="flex-1 text-[12px] leading-snug text-white/82 sm:text-[12.5px]">
          <span className="font-semibold text-white">We are working on our regional servers right now.</span>{" "}
          The site is temporarily using the India backend only. You may experience slower loading or delays in some areas,
          but we are fixing it and service will improve shortly.
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
