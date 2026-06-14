import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  Heart,
  History,
  MessageSquare,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "animeTVplus Android App Download",
  description:
    "Download the animeTVplus Android app for HD anime streaming, synced watch history, watchlist, airing schedule, live chat, and offline episode downloads.",
  path: "/android-app",
});

const features = [
  {
    icon: Play,
    title: "HD streaming",
    body: "Fast servers, clean playback controls, subtitles, server switching, and a premium player built for phones.",
  },
  {
    icon: CalendarDays,
    title: "Airing schedule",
    body: "Monthly anime drops grouped by date, with today selected automatically so new episodes are easy to find.",
  },
  {
    icon: History,
    title: "Synced watch history",
    body: "Resume from the latest timestamp across sessions without duplicate anime rows cluttering your library.",
  },
  {
    icon: Download,
    title: "Offline downloads",
    body: "Save episodes on your device and keep watching even when the connection disappears.",
  },
  {
    icon: Heart,
    title: "Watchlist",
    body: "Keep favorites ready for later with server-synced library data tied to your account.",
  },
  {
    icon: MessageSquare,
    title: "Live chat",
    body: "Talk with animeTVplus viewers while exploring anime, schedules, and watch sessions.",
  },
];

const screenshots = [
  {
    src: "/android-app/screens/3.jpeg",
    title: "Airing schedule",
    body: "Current day, clean episode rows, release time, and poster-first cards.",
  },
  {
    src: "/android-app/screens/5.jpeg",
    title: "Watch history",
    body: "Resume instantly from the exact timestamp you left off.",
  },
  {
    src: "/android-app/screens/4.jpeg",
    title: "Live chat",
    body: "A dedicated anime community panel with fast message entry.",
  },
  {
    src: "/android-app/screens/2.jpeg",
    title: "Watchlist",
    body: "Saved anime, quick remove, and clean library navigation.",
  },
  {
    src: "/android-app/screens/1.jpeg",
    title: "Profile drawer",
    body: "Profile, downloads, history, watchlist, schedule, search, and chat in one place.",
  },
];

const trust = ["Clean UI", "No popups", "No ads", "Synced account", "Offline ready", "Android APK"];

export default function AndroidAppPage() {
  return (
    <AppShell>
      <div className="relative isolate overflow-hidden bg-[#05060a] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(225,29,72,0.28),transparent_34%),radial-gradient(circle_at_82%_8%,rgba(255,255,255,0.09),transparent_26%),linear-gradient(180deg,#05060a_0%,#080911_46%,#05060a_100%)]" />
          <div className="absolute inset-x-0 top-0 h-[620px] bg-[linear-gradient(90deg,rgba(5,6,10,0.96),rgba(5,6,10,0.42),rgba(5,6,10,0.98))]" />
        </div>

        <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-screen-2xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e11d48]/30 bg-[#e11d48]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-[#ff4f70]">
              <Sparkles size={14} />
              animeTVplus for Android
            </div>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
              Stream anime like it belongs on your phone.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/62 sm:text-lg">
              Download the animeTVplus APK for smooth HD anime playback, synced history, watchlist, monthly airing schedule, live chat, and offline episodes in a sharp red-black Android experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-[#e11d48]/70 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white/85 shadow-[0_20px_55px_rgba(225,29,72,0.22)]"
              >
                <Download size={20} />
                Available soon
              </button>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/[0.11] bg-white/[0.045] px-6 py-4 text-sm font-black text-white/82 transition hover:border-white/20 hover:bg-white/[0.075]"
              >
                <Smartphone size={20} />
                Explore features
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {trust.map((item) => (
                <span key={item} className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/58">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[650px]">
            <div className="absolute -inset-8 rounded-[48px] bg-[#e11d48]/18 blur-3xl" />
            <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#0d1020]/70 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.58)] backdrop-blur-xl">
              <Image
                src="/android-app/apk_advertise.jpeg"
                alt="animeTVplus Android app promotional poster"
                width={1076}
                height={1600}
                priority
                className="h-auto w-full rounded-[26px] object-cover"
              />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ff4f70]">built for watching</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
              Everything from the website, tuned for Android.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-2xl border border-white/[0.07] bg-[#0d1020]/82 p-5 shadow-[0_22px_55px_rgba(0,0,0,0.28)]">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#e11d48]/28 bg-[#e11d48]/12 text-[#ff4f70]">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/54">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#ff4f70]">screenshots</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                A premium anime app, not a web wrapper.
              </h2>
            </div>
            <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white/75 px-4 py-3 text-sm font-black text-[#07080d]/70">
              <Download size={17} />
              Available soon
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {screenshots.map((shot, index) => (
              <article
                key={shot.src}
                className="group rounded-[28px] border border-white/[0.07] bg-[#0d1020]/74 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.34)] transition hover:-translate-y-1 hover:border-[#e11d48]/35"
              >
                <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-black">
                  <Image
                    src={shot.src}
                    alt={`${shot.title} screenshot in animeTVplus Android app`}
                    width={920}
                    height={2048}
                    className="aspect-[9/19] w-full object-cover object-top transition duration-500 group-hover:scale-[1.025]"
                    sizes="(min-width: 1280px) 18vw, (min-width: 768px) 42vw, 92vw"
                  />
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff4f70]">0{index + 1}</p>
                  <h3 className="mt-1 text-base font-black text-white">{shot.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-white/48">{shot.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-screen-2xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-5 rounded-[32px] border border-[#e11d48]/24 bg-[linear-gradient(135deg,rgba(225,29,72,0.22),rgba(13,16,32,0.92)_42%,rgba(5,6,10,0.96))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.48)] md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <div className="flex items-center gap-2 text-[#ff4f70]">
                <ShieldCheck size={20} />
                <span className="text-[11px] font-black uppercase tracking-[0.22em]">safe apk download</span>
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                Install once. Watch anywhere.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                The APK is hosted directly on animeTVplus. Keep your anime library, schedule, watchlist, downloads, and chat one tap away.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <button type="button" disabled className="inline-flex cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-[#e11d48]/70 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white/85 shadow-[0_20px_55px_rgba(225,29,72,0.22)]">
                <Download size={20} />
                Available soon
              </button>
              <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-black/24 px-4 py-3 text-xs font-bold text-white/54">
                <WifiOff size={16} />
                Offline episodes supported
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
