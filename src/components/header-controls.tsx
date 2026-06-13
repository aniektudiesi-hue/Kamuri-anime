"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Clock3, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavDrawer } from "@/components/nav-drawer";
import { useAuth } from "@/lib/auth";
import { countryLabel, loadEdgeSession, originLabel, regionLabel, storedCatalogOrigin, storedCatalogRegion, storedCountry } from "@/lib/edge-region";
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
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [origin, setOrigin] = useState("");
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
    setRegion(storedCatalogRegion());
    setCountry(storedCountry());
    setOrigin(storedCatalogOrigin());
    loadEdgeSession().then((session) => {
      if (session?.region) setRegion(session.region);
      if (session?.country) setCountry(session.country);
      if (session?.origin) setOrigin(session.origin);
    });
  }, []);

  const serverLabel = mounted
    ? originLabel(origin) || regionLabel(region) || countryLabel(country) || "India Render"
    : "India Render";
  const serverTitle = [
    `Fastest catalog server: ${serverLabel}`,
    origin,
    country ? countryLabel(country) : "",
  ].filter(Boolean).join(" - ");

  return (
    <>
      {/* Header keeps ONLY: History + Profile (Search lives in the header itself).
          Everything else moved into the slide-out NavDrawer. Icons are large + spaced. */}
      <div className="hidden items-center gap-2 sm:flex">
        <span
          title={serverTitle}
          suppressHydrationWarning
          className="hidden h-[28px] max-w-[116px] items-center rounded-sm border border-white/[0.08] bg-white/[0.045] px-2 text-[10px] font-black uppercase leading-none text-[#c8ced8]/78 md:inline-flex"
        >
          <span className="truncate" suppressHydrationWarning>{serverLabel}</span>
        </span>
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
              aria-label={`Account menu. Catalog server ${serverLabel}`}
              title={serverTitle}
              className="flex h-[48px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-full px-1 text-white/85 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white"
            >
              {isLoggedIn ? (
                <Avatar className="h-[28px] w-[28px] border border-[#c4182a]/35 bg-[#c4182a]">
                  {prefs.photo ? <AvatarImage src={prefs.photo} alt={profileName} /> : null}
                  <AvatarFallback className="bg-[#c4182a] text-[12px] font-black text-white">{userInitial}</AvatarFallback>
                </Avatar>
              ) : (
                <UserRound size={21} strokeWidth={2.1} />
              )}
              <span className="max-w-[54px] truncate text-[9px] font-black uppercase leading-none tracking-[0.02em] text-[#c8ced8]/70 md:hidden">
                {serverLabel}
              </span>
            </button>
          }
        />
      </div>

      {showMobileMenu ? <MobileMenu isAdminOwner={isAdminOwner} isLoggedIn={isLoggedIn} /> : null}
    </>
  );
}
