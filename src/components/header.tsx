"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, Download, Heart, LogOut, Search, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { displayProfileName, useProfilePrefs } from "@/lib/profile";
import { cn } from "@/lib/utils";

const MobileMenu = dynamic(
  () => import("@/components/mobile-menu").then((module) => module.MobileMenu),
  { ssr: false },
);

const nav = [
  { href: "/popular", label: "Browse" },
  { href: "/new-releases", label: "New Releases" },
  { href: "/top-rated", label: "Top Rated" },
  { href: "/schedule", label: "Schedule" },
];

export function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const pathname = usePathname();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const accountName = user?.username || user?.email || "";
  const { prefs } = useProfilePrefs(accountName);
  const profileName = displayProfileName(accountName, prefs.displayName);
  const userInitial = (profileName || "U")[0].toUpperCase();
  const isAdminOwner = (user?.username || "").trim().toLowerCase() === "kali";

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const sync = () => setShowMobileMenu(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/[0.075] bg-[#05060a]/90 shadow-[0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#05060a]/76">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:h-[72px] lg:px-6">
          <Link href="/" aria-label="animeTv home" className="group flex shrink-0 items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.045] shadow-[0_18px_40px_rgba(0,0,0,0.38)] transition group-hover:border-[#e11d48]/40">
              <Image src="/logo.svg" alt="" width={34} height={34} priority className="drop-shadow-[0_0_22px_rgba(225,29,72,0.32)]" />
            </span>
            <span className="hidden text-[18px] font-black tracking-tight text-white sm:block">
              anime<span className="text-[#e11d48]">Tv</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-xl px-4 py-2 text-sm font-bold transition hover:bg-white/[0.055] hover:text-white",
                    active ? "text-white" : "text-white/48",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-[#e11d48] shadow-[0_0_18px_rgba(225,29,72,0.55)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mx-auto hidden max-w-2xl flex-1 sm:block">
            <Link
              href="/search"
              aria-label="Search anime"
              className="flex h-11 items-center gap-2 rounded-full border border-white/[0.075] bg-[#0d1020]/86 px-4 text-[15px] font-semibold text-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#e11d48]/35 hover:bg-[#111421]/92 hover:text-white/55 sm:h-12"
            >
              <Search size={16} className="shrink-0 text-white/32" />
              <span>Search anime...</span>
            </Link>
          </div>

          <div className="hidden items-center gap-1.5 sm:flex">
            <HeaderIcon href="/history" label="Watch History" icon={<Clock3 size={18} />} />
            <HeaderIcon href="/watchlist" label="My Watchlist" icon={<Heart size={18} />} />
            <HeaderIcon href="/downloads" label="Downloads" icon={<Download size={18} />} />
            {isAdminOwner ? <HeaderIcon href="/8527330761" label="Admin Control" icon={<ShieldCheck size={18} />} /> : null}

            {isLoggedIn ? (
              <div className="ml-2 flex items-center gap-1.5">
                <Link
                  href="/profile"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.045] px-2.5 pr-3 text-white/72 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <Avatar className="h-7 w-7 border border-[#e11d48]/30 bg-[#e11d48]">
                    {prefs.photo ? <AvatarImage src={prefs.photo} alt={profileName} /> : null}
                    <AvatarFallback className="bg-[#e11d48] text-[11px] font-black text-white">{userInitial}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[92px] truncate text-sm font-bold lg:block">{profileName}</span>
                </Link>
                <button
                  type="button"
                  aria-label="Logout"
                  onClick={logout}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/38 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <Button
                asChild
                className="ml-2 h-10 rounded-xl bg-[#e11d48] px-5 text-sm font-black text-white shadow-[0_14px_36px_rgba(225,29,72,0.28)] hover:bg-[#f43f5e]"
              >
                <Link href="/login">
                  <UserRound size={16} />
                  Sign In
                </Link>
              </Button>
            )}
          </div>

          <Link
            href="/search"
            aria-label="Search anime"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-white/70 transition hover:bg-white/[0.08] hover:text-white sm:hidden"
          >
            <Search size={18} />
          </Link>

          {showMobileMenu ? <MobileMenu isAdminOwner={isAdminOwner} isLoggedIn={isLoggedIn} /> : null}
        </div>
      </div>
    </header>
  );
}

function HeaderIcon({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-xl text-white/42 transition hover:bg-white/[0.06] hover:text-white"
    >
      {icon}
    </Link>
  );
}
