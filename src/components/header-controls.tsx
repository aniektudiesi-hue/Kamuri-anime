"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Clock3, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavDrawer } from "@/components/nav-drawer";
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
  const { isLoggedIn, user } = useAuth();
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
      {/* Header keeps ONLY: History + Profile (Search lives in the header itself).
          Everything else moved into the slide-out NavDrawer. Icons are large + spaced. */}
      <div className="hidden items-center gap-2 sm:flex">
        <Link
          href="/history"
          aria-label="Watch History"
          title="Watch History"
          className="grid h-[40px] w-[40px] place-items-center rounded-full text-white/85 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
        >
          <Clock3 size={22} strokeWidth={2.1} />
        </Link>

        <NavDrawer
          trigger={
            <button
              type="button"
              aria-label="Account menu"
              className="grid h-[40px] w-[40px] place-items-center rounded-full text-white/85 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
            >
              {isLoggedIn ? (
                <Avatar className="h-[30px] w-[30px] border border-[#c4182a]/35 bg-[#c4182a]">
                  {prefs.photo ? <AvatarImage src={prefs.photo} alt={profileName} /> : null}
                  <AvatarFallback className="bg-[#c4182a] text-[12px] font-black text-white">{userInitial}</AvatarFallback>
                </Avatar>
              ) : (
                <UserRound size={22} strokeWidth={2.1} />
              )}
            </button>
          }
        />
      </div>

      {showMobileMenu ? <MobileMenu isAdminOwner={isAdminOwner} isLoggedIn={isLoggedIn} /> : null}
    </>
  );
}
