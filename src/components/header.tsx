"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Download, Heart, LogOut, Menu, Moon, Repeat2, Sun, UserRound, Wifi, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { SearchBox } from "./search-box";

const nav = [
  { href: "/popular", label: "Browse" },
  { href: "/new-releases", label: "New Releases" },
  { href: "/top-rated", label: "Top Rated" },
  { href: "/schedule", label: "Schedule" },
];

export function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Main bar — single blur layer, never repaints */}
      <div className="border-b border-white/[0.06] bg-[#06070d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 lg:px-6">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo.svg" alt="animeTv" width={36} height={36} priority className="drop-shadow-[0_12px_28px_rgba(200,34,61,0.22)]" />
            <span className="hidden text-[16px] font-black tracking-tight text-white sm:block">
                anime<span className="text-[#c8223d]">Tv</span>
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
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#c8223d] text-[9px] font-black text-white">
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
                className="ml-1 flex h-8 items-center gap-2 rounded-lg bg-[#c8223d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#d62a47]"
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
            <div className="my-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
              {isLoggedIn ? (
                <>
                  <div className="mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/65">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#c8223d] text-[10px] font-black text-white">
                      {(user?.username || user?.email || "U")[0].toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{user?.username || user?.email || "Account"}</span>
                  </div>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <Repeat2 size={15} />
                    Switch username
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => settings.setAutoFetchWhileWatching(!settings.autoFetchWhileWatching)}
                className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-white/55"
              >
                <span className="flex items-center gap-3"><Wifi size={15} /> Deep buffer</span>
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${settings.autoFetchWhileWatching ? "bg-[#c8223d]" : "bg-white/[0.12]"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${settings.autoFetchWhileWatching ? "translate-x-4" : ""}`} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => settings.setAutoResume(!settings.autoResume)}
                className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-white/55"
              >
                <span className="flex items-center gap-3"><Clock3 size={15} /> Auto resume</span>
                <span className={`h-5 w-9 rounded-full p-0.5 transition ${settings.autoResume ? "bg-[#c8223d]" : "bg-white/[0.12]"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition ${settings.autoResume ? "translate-x-4" : ""}`} />
                </span>
              </button>
              <button
                type="button"
                onClick={() => settings.setTheme(settings.theme === "dark" ? "light" : "dark")}
                className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium text-white/55"
              >
                <span className="flex items-center gap-3">
                  {settings.theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
                  {settings.theme === "dark" ? "Dark mode" : "Light mode"}
                </span>
                      <span className="text-xs font-bold text-[#c8223d]">Switch</span>
              </button>
            </div>
            {!isLoggedIn && (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#c8223d] text-sm font-semibold text-white"
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
