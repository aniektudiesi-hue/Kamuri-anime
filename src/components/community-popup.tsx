"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";

const GUEST_KEY = "atv-community-popup-v1";
const LOGGEDIN_KEY = "atv-community-popup-loggedin-v1";

export function CommunityPopup() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (typeof window === "undefined") return;
    const key = isLoggedIn ? LOGGEDIN_KEY : GUEST_KEY;
    if (localStorage.getItem(key)) return;
    const timer = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(timer);
  }, [isReady, isLoggedIn]);

  function dismiss() {
    setOpen(false);
    const key = isLoggedIn ? LOGGEDIN_KEY : GUEST_KEY;
    localStorage.setItem(key, Date.now().toString());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="!max-w-sm !bg-[#0a0a0f] !border !border-white/10 !ring-0 !p-0 overflow-hidden">
        {/* gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400" />

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* emoji + headline */}
          <div className="flex flex-col gap-1 text-center">
            <span className="text-3xl">🎉</span>
            <h2 className="text-white font-bold text-lg leading-tight">
              15,000+ Users Worldwide!
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Thank you for being part of the <span className="text-white font-medium">animeTVplus</span> family.
              We&apos;ve grown to over <span className="text-white font-medium">15,000 users</span> across the globe
              and it&apos;s all because of your support. 🙏
            </p>
          </div>

          {/* divider */}
          <div className="border-t border-white/8" />

          {/* body points */}
          <ul className="flex flex-col gap-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-pink-400">📢</span>
              <span>
                <strong className="text-white">Share with friends</strong> — help us grow and keep anime streaming
                free for everyone.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-purple-400">💡</span>
              <span>
                <strong className="text-white">Request any feature</strong> — we build what our community asks for.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-green-400">💚</span>
              <span>
                <strong className="text-white">100% non-profit</strong> — all ad revenue goes directly to server
                costs. Zero profit, all love.
              </span>
            </li>
          </ul>

          {/* Instagram CTA */}
          <a
            href="https://www.instagram.com/animetvplus_official/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Follow @animetvplus_official
          </a>

          <button
            onClick={dismiss}
            className="text-xs text-zinc-600 hover:text-zinc-400 text-center transition-colors"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
