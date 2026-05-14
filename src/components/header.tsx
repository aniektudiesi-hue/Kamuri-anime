"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, Download, Heart, LogOut, Menu, Moon, Repeat2, Search, ShieldCheck, Sun, UserRound, Wifi } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { displayProfileName, useProfilePrefs } from "@/lib/profile";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const accountName = user?.username || user?.email || "";
  const { prefs } = useProfilePrefs(accountName);
  const profileName = displayProfileName(accountName, prefs.displayName);
  const userInitial = (profileName || "U")[0].toUpperCase();
  const isAdminOwner = (user?.username || "").trim().toLowerCase() === "kali";

  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/[0.075] bg-[#05060a]/90 shadow-[0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#05060a]/76">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:h-[72px] lg:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.045] shadow-[0_18px_40px_rgba(0,0,0,0.38)] transition group-hover:border-[#e11d48]/40">
              <Image src="/logo.svg" alt="animeTv" width={34} height={34} priority className="drop-shadow-[0_0_22px_rgba(225,29,72,0.32)]" />
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
            <SearchBox />
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
            aria-label="Search"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-white/70 transition hover:bg-white/[0.08] hover:text-white sm:hidden"
          >
            <Search size={18} />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                size="icon-lg"
                className="rounded-xl border border-white/[0.08] bg-white/[0.045] text-white/70 hover:bg-white/[0.08] hover:text-white lg:hidden"
              >
                <Menu size={19} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[88vw] max-w-[380px] border-white/[0.08] bg-[#080a12]/96 p-0 text-white shadow-2xl backdrop-blur-2xl"
            >
              <SheetHeader className="border-b border-white/[0.07] p-4 text-left">
                <SheetTitle className="flex items-center gap-3 text-white">
                  <Image src="/logo.svg" alt="" width={32} height={32} />
                  anime<span className="-ml-2 text-[#e11d48]">Tv</span>
                </SheetTitle>
                <SheetDescription className="text-white/38">Browse, resume, and tune playback.</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 p-4">
                <div className="grid gap-1.5">
                  {nav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex h-11 items-center rounded-xl px-3 text-sm font-bold text-white/64 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                <Separator className="bg-white/[0.07]" />

                <div className="grid gap-1.5">
                  <MobileLink href="/search" label="Search" icon={<Search size={16} />} close={() => setOpen(false)} />
                  <MobileLink href="/history" label="History" icon={<Clock3 size={16} />} close={() => setOpen(false)} />
                  <MobileLink href="/watchlist" label="Watchlist" icon={<Heart size={16} />} close={() => setOpen(false)} />
                  <MobileLink href="/downloads" label="Downloads" icon={<Download size={16} />} close={() => setOpen(false)} />
                  <MobileLink href="/profile" label="Profile" icon={<UserRound size={16} />} close={() => setOpen(false)} />
                  {isAdminOwner ? (
                    <MobileLink href="/8527330761" label="Admin Control" icon={<ShieldCheck size={16} />} close={() => setOpen(false)} />
                  ) : null}
                  {isLoggedIn ? (
                    <MobileLink href="/login" label="Switch username" icon={<Repeat2 size={16} />} close={() => setOpen(false)} />
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/[0.075] bg-white/[0.04] p-2">
                  {isLoggedIn ? (
                    <div className="mb-1 flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white/72">
                      <Avatar className="h-8 w-8 border border-[#e11d48]/30 bg-[#e11d48]">
                        {prefs.photo ? <AvatarImage src={prefs.photo} alt={profileName} /> : null}
                        <AvatarFallback className="bg-[#e11d48] text-xs font-black text-white">{userInitial}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">{profileName}</span>
                    </div>
                  ) : null}
                  <SettingRow
                    label="Deep buffer"
                    icon={<Wifi size={16} />}
                    checked={settings.autoFetchWhileWatching}
                    onClick={() => settings.setAutoFetchWhileWatching(!settings.autoFetchWhileWatching)}
                  />
                  <SettingRow
                    label="Auto resume"
                    icon={<Clock3 size={16} />}
                    checked={settings.autoResume}
                    onClick={() => settings.setAutoResume(!settings.autoResume)}
                  />
                  <button
                    type="button"
                    onClick={() => settings.setTheme(settings.theme === "dark" ? "light" : "dark")}
                    className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-bold text-white/62 transition hover:bg-white/[0.055] hover:text-white"
                  >
                    <span className="flex items-center gap-3">
                      {settings.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                      {settings.theme === "dark" ? "Dark mode" : "Light mode"}
                    </span>
                    <span className="text-xs font-black text-[#f43f5e]">Switch</span>
                  </button>
                </div>

                {!isLoggedIn ? (
                  <Button asChild className="h-11 w-full rounded-xl bg-[#e11d48] text-sm font-black text-white hover:bg-[#f43f5e]">
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <UserRound size={16} />
                      Sign In
                    </Link>
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HeaderIcon({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="grid h-10 w-10 place-items-center rounded-xl text-white/42 transition hover:bg-white/[0.06] hover:text-white"
        >
          {icon}
        </Link>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="border border-white/[0.08] bg-[#111525] text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function MobileLink({ href, label, icon, close }: { href: string; label: string; icon: ReactNode; close: () => void }) {
  return (
    <Link
      href={href}
      onClick={close}
      className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-white/62 transition hover:bg-white/[0.06] hover:text-white"
    >
      {icon}
      {label}
    </Link>
  );
}

function SettingRow({ label, icon, checked, onClick }: { label: string; icon: ReactNode; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-bold text-white/62 transition hover:bg-white/[0.055] hover:text-white"
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      <span className={`relative h-5 w-9 rounded-full p-0.5 transition ${checked ? "bg-[#e11d48]" : "bg-white/[0.14]"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
