"use client";

import Link from "next/link";
import { Bookmark, ChevronRight, Clock3, Download, ShieldAlert, UserRound, Wifi, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useSettings } from "@/lib/settings";

export default function SettingsPage() {
  const settings = useSettings();

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#c4182a]">Preferences</p>
        <h1 className="text-3xl font-black tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-sm font-medium text-white/45">Tune playback, content, and your library.</p>

        {/* Content */}
        <h2 className="mb-1 mt-10 text-[12px] font-bold uppercase tracking-widest text-white/35">Content</h2>
        <div className="divide-y divide-white/[0.05]">
          <Toggle
            icon={ShieldAlert}
            label="Age restriction"
            desc="Hide mature / adult-rated titles across the app."
            checked={settings.ageRestriction}
            onChange={() => settings.setAgeRestriction(!settings.ageRestriction)}
          />
        </div>

        {/* Playback */}
        <h2 className="mb-1 mt-10 text-[12px] font-bold uppercase tracking-widest text-white/35">Playback</h2>
        <div className="divide-y divide-white/[0.05]">
          <Toggle
            icon={Clock3}
            label="Auto-resume"
            desc="Continue episodes from where you left off."
            checked={settings.autoResume}
            onChange={() => settings.setAutoResume(!settings.autoResume)}
          />
          <Toggle
            icon={Wifi}
            label="Deep buffer"
            desc="Pre-fetch more of the stream while watching for smoother playback."
            checked={settings.autoFetchWhileWatching}
            onChange={() => settings.setAutoFetchWhileWatching(!settings.autoFetchWhileWatching)}
          />
        </div>

        {/* Library */}
        <h2 className="mb-1 mt-10 text-[12px] font-bold uppercase tracking-widest text-white/35">Library</h2>
        <div className="divide-y divide-white/[0.05]">
          <NavRow icon={UserRound} label="Profile" href="/profile" />
          <NavRow icon={Bookmark} label="Watchlist" href="/watchlist" />
          <NavRow icon={Clock3} label="History" href="/history" />
          <NavRow icon={Download} label="Downloads" href="/downloads" />
        </div>
      </section>
    </AppShell>
  );
}

function Toggle({
  icon: Icon, label, desc, checked, onChange,
}: { icon: LucideIcon; label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex w-full items-center gap-4 py-4 text-left">
      <Icon size={22} strokeWidth={2} className="shrink-0 text-white/55" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">{label}</span>
        <span className="mt-0.5 block text-[13px] text-white/42">{desc}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${checked ? "bg-[#c4182a]" : "bg-white/[0.16]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function NavRow({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 py-4 text-white/75 transition-colors hover:text-white">
      <Icon size={22} strokeWidth={2} className="shrink-0 text-white/55" />
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <ChevronRight size={18} className="text-white/30" />
    </Link>
  );
}
