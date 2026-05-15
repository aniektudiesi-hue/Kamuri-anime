"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Download, Heart, Menu, Repeat2, Search, ShieldCheck, UserRound, Wifi } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSettings } from "@/lib/settings";

const nav = [
  { href: "/popular", label: "Browse" },
  { href: "/new-releases", label: "New Releases" },
  { href: "/top-rated", label: "Top Rated" },
  { href: "/schedule", label: "Schedule" },
];

export function MobileMenu({ isLoggedIn, isAdminOwner }: { isLoggedIn: boolean; isAdminOwner: boolean }) {
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  return (
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
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
