"use client";

import Link from "next/link";
import { Bookmark, Clock3, Download, LogOut, Settings, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { displayProfileName, useProfilePrefs } from "@/lib/profile";

/**
 * NavDrawer — the slide-out account/navigation panel (Crunchyroll user-menu style).
 * Triggered by the header avatar. Holds everything we pulled OUT of the header:
 * Profile, Watchlist, Downloads, History, Settings, Admin, Log out — big, spaced rows.
 */
export function NavDrawer({ trigger }: { trigger: ReactNode }) {
  const { isLoggedIn, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const accountName = user?.username || user?.email || "";
  const { prefs } = useProfilePrefs(accountName);
  const profileName = displayProfileName(accountName, prefs.displayName);
  const userInitial = (profileName || "U")[0].toUpperCase();
  const isAdminOwner = (user?.username || "").trim().toLowerCase() === "kali";

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-dvh w-[86vw] max-w-[340px] flex-col gap-0 border-white/[0.07] bg-[#070708] p-0 text-white shadow-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-white/[0.06] p-5 text-left">
          <SheetTitle asChild>
            <Link href={isLoggedIn ? "/profile" : "/login"} onClick={close} className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border border-[#c4182a]/35 bg-[#c4182a]">
                {prefs.photo ? <AvatarImage src={prefs.photo} alt={profileName} /> : null}
                <AvatarFallback className="bg-[#c4182a] text-base font-black text-white">{userInitial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-white">{isLoggedIn ? profileName : "Guest"}</p>
                <p className="text-[12px] font-medium text-[#e11d2a]">{isLoggedIn ? "View profile" : "Sign in to sync"}</p>
              </div>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <DrawerRow href="/watchlist" label="Watchlist" icon={Bookmark} close={close} />
          <DrawerRow href="/history" label="History" icon={Clock3} close={close} />
          <DrawerRow href="/downloads" label="Downloads" icon={Download} close={close} />
          <DrawerRow href="/profile" label="Profile" icon={UserRound} close={close} />
          <DrawerRow href="/settings" label="Settings" icon={Settings} close={close} />
          {isAdminOwner ? <DrawerRow href="/8527330761" label="Admin Control" icon={ShieldCheck} close={close} /> : null}
        </nav>

        <div className="shrink-0 border-t border-white/[0.06] p-3">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => { logout(); close(); }}
              className="flex h-12 w-full items-center gap-4 rounded-lg px-4 text-[15px] font-semibold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <LogOut size={22} strokeWidth={2.1} />
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#c4182a] text-[14px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#d8273a]"
            >
              <UserRound size={18} />
              Sign In
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerRow({ href, label, icon: Icon, close }: { href: string; label: string; icon: LucideIcon; close: () => void }) {
  return (
    <Link
      href={href}
      onClick={close}
      className="flex h-12 items-center gap-4 rounded-lg px-4 text-[15px] font-semibold text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white"
    >
      <Icon size={22} strokeWidth={2.1} className="shrink-0 text-white/50" />
      {label}
    </Link>
  );
}
