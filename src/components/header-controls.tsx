"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Clock3, Download, Heart, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { displayProfileName, useProfilePrefs } from "@/lib/profile";

const MobileMenu = dynamic(
  () => import("@/components/mobile-menu").then((module) => module.MobileMenu),
  {
    ssr: false,
    loading: () => (
      <span className="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.045] lg:hidden" />
    ),
  },
);

export function HeaderControls() {
  const { isLoggedIn, user, logout } = useAuth();
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
    <>
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

      {showMobileMenu ? <MobileMenu isAdminOwner={isAdminOwner} isLoggedIn={isLoggedIn} /> : null}
    </>
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
