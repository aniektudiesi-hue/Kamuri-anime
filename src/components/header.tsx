"use client";

import Link from "next/link";
import { Clock3, Heart, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { SearchBox } from "./search-box";

const nav = [
  { href: "/history", label: "History", icon: Clock3 },
  { href: "/watchlist", label: "Watchlist", icon: Heart },
];

export function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <AnimeTvLogo />
          <span className="hidden text-lg font-black tracking-wide sm:block">animeTv</span>
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-white/10 hover:text-white">
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>

        {isLoggedIn ? (
          <button onClick={logout} className="hidden h-10 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-white/10 hover:text-white sm:flex">
            <LogOut size={16} />
            {user?.username || user?.email || "Logout"}
          </button>
        ) : (
          <Link href="/login" className="hidden h-10 items-center gap-2 rounded-md bg-panel-strong px-3 text-sm font-semibold hover:bg-white/10 sm:flex">
            <UserRound size={16} />
            Login
          </Link>
        )}

        <button aria-label="Open menu" onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-md bg-panel-strong lg:hidden">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-panel px-4 py-3 lg:hidden">
          <div className="grid gap-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-white/10 hover:text-white">
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
            <Link href="/search" className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-white/10 hover:text-white">
              <Search size={16} />
              Search
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AnimeTvLogo() {
  return (
    <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-md border border-white/10 bg-[#11131d] shadow-[0_0_24px_rgba(255,83,112,0.28)]">
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),transparent_28%),linear-gradient(135deg,#ff3f6e,#7c5cff_55%,#28d6ff)]" />
      <span className="absolute bottom-1 left-1 right-1 h-3 rounded-full bg-black/35" />
      <span className="relative grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-black text-[#11131d]">
        TV
      </span>
    </span>
  );
}
