"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Download, Heart, LogOut, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { SearchBox } from "./search-box";

const nav = [
  { href: "/search?q=trending", label: "Browse" },
  { href: "/search?q=spring+2026", label: "New Releases" },
  { href: "/search?q=top+rated", label: "Top Rated" },
];

export function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Main bar — single blur layer, never repaints */}
      <div className="border-b border-white/[0.06] bg-[#06070d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 lg:px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo.svg" alt="animeTv" width={32} height={32} priority />
            <span className="hidden text-[15px] font-black tracking-tight text-white sm:block">
              anime<span className="text-[#e8336a]">Tv</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <div className="mx-auto hidden max-w-lg flex-1 sm:block">
            <SearchBox />
          </div>

          {/* Right actions */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <Link
              href="/history"
              title="Watch History"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Clock3 size={17} />
            </Link>
            <Link
              href="/watchlist"
              title="My Watchlist"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Heart size={17} />
            </Link>
            <Link
              href="/downloads"
              title="Downloads"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Download size={17} />
            </Link>

            {isLoggedIn ? (
              <button
                onClick={logout}
                className="ml-1 flex h-8 items-center gap-2 rounded-lg bg-white/[0.05] px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e8336a] text-[9px] font-black text-white">
                  {(user?.username || user?.email || "U")[0].toUpperCase()}
                </span>
                <span className="hidden max-w-[80px] truncate lg:block">
                  {user?.username || user?.email || "Account"}
                </span>
                <LogOut size={12} className="text-white/30" />
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-1 flex h-8 items-center gap-2 rounded-lg bg-[#e8336a] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <UserRound size={14} />
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05] text-white/60 lg:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>

        {/* Mobile search — same layer, no extra blur */}
        <div className="border-t border-white/[0.06] px-4 py-2.5 sm:hidden">
          <SearchBox />
        </div>
      </div>

      {/* Mobile nav drawer — solid, no backdrop-blur */}
      {open ? (
        <div className="border-b border-white/[0.06] bg-[#0a0c16] lg:hidden">
          <div className="space-y-0.5 px-4 py-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Clock3 size={15} />
              History
            </Link>
            <Link
              href="/watchlist"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Heart size={15} />
              Watchlist
            </Link>
            <Link
              href="/downloads"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Download size={15} />
              Downloads
            </Link>
            {!isLoggedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#e8336a] text-sm font-semibold text-white"
              >
                <UserRound size={14} />
                Sign In
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
