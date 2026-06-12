"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "atvp_adnotice_dismissed_v1";

export function AdNoticeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 text-center shadow-2xl">
        <h2 className="text-lg font-bold text-white">A quick note from the team</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Our views and server requests have grown massively recently, so we&apos;re no longer able to keep serving everything completely ad-free.
          We&apos;ll do our best to keep ads light and not ruin your experience.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Please consider disabling your ad blocker for this site — it helps us keep the lights on. Continued ad blocking may force us to
          permanently shut down the service.
        </p>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-[#c4182a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a8141f]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
