"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { HISTORY_UPDATED_EVENT, rememberedHistory } from "@/lib/utils";

const OPEN_PATHS = new Set(["/login", "/register"]);
const DISMISSED_COUNT_KEY = "animeTVplus-guest-history-prompt-dismissed-count";

export function AuthRequiredGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoggedIn, isReady } = useAuth();
  const isOpen = OPEN_PATHS.has(pathname);
  const [historyCount, setHistoryCount] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!isReady || isLoggedIn || isOpen) {
      setShowPrompt(false);
      return;
    }

    const syncPrompt = () => {
      const count = rememberedHistory(4).length;
      const dismissedAtCount = Number(window.sessionStorage.getItem(DISMISSED_COUNT_KEY) || 0);
      setHistoryCount(count);
      setShowPrompt(count > 2 && dismissedAtCount < count);
    };

    syncPrompt();
    window.addEventListener(HISTORY_UPDATED_EVENT, syncPrompt);
    window.addEventListener("storage", syncPrompt);
    return () => {
      window.removeEventListener(HISTORY_UPDATED_EVENT, syncPrompt);
      window.removeEventListener("storage", syncPrompt);
    };
  }, [isLoggedIn, isOpen, isReady, pathname]);

  function dismissPrompt() {
    window.sessionStorage.setItem(DISMISSED_COUNT_KEY, String(historyCount));
    setShowPrompt(false);
  }

  const returnTo = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;

  return (
    <>
      {children}
      {showPrompt ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/68 px-4 text-white backdrop-blur-sm">
          <section className="relative w-full max-w-md rounded-[1.75rem] border border-white/[0.1] bg-[#090b14]/96 p-5 text-center shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              aria-label="Close login prompt"
              onClick={dismissPrompt}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/60 hover:text-white"
            >
              <X size={16} />
            </button>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e11d48] shadow-lg shadow-[#e11d48]/25">
              <Play size={22} fill="white" />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ff6b86]">Keep your watch history</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Sign in to sync your anime</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/58">
              You have started building watch history on this device. Create an account or sign in to keep it safe across devices.
            </p>
            <div className="mt-6 grid gap-3">
              <Link
                href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
                className="grid h-12 place-items-center rounded-2xl bg-[#e11d48] text-sm font-black text-white shadow-lg shadow-[#e11d48]/20"
              >
                Register and sync
              </Link>
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="grid h-12 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.06] text-sm font-black text-white"
              >
                Sign in
              </Link>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-white/45 hover:text-white"
            >
              <Lock size={13} /> Continue as guest for now
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
