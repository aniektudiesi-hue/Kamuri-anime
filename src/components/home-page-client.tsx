"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Flame, Play, Radio, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HeroCarousel, MobileHeroBanner } from "@/components/hero-carousel";
import { SidebarLayout } from "@/components/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { AiringScheduleItem, Anime, HomeInitialData } from "@/lib/types";
import { animeId, episodeCount, episodeLabel, posterOf, rememberAnime, titleOf } from "@/lib/utils";

export function HomePageClient({ initialData }: { initialData: HomeInitialData }) {
  const [banners, thumbnails, recent, topRated] = useQueries({
    queries: [
      { queryKey: ["banners"], queryFn: api.banners, initialData: initialData.banners, staleTime: 1000 * 60 * 60 },
      { queryKey: ["thumbnails"], queryFn: api.thumbnails, initialData: initialData.thumbnails, staleTime: 1000 * 60 * 60 },
      { queryKey: ["recently-added"], queryFn: api.recentlyAdded, initialData: initialData.recent, staleTime: 1000 * 60 * 45 },
      { queryKey: ["top-rated"], queryFn: api.topRated, initialData: initialData.topRated, staleTime: 1000 * 60 * 60 },
    ],
  });

  return (
    <AppShell>
      <div className="hidden sm:block">
        <HeroCarousel items={banners.data} loading={banners.isLoading && !initialData.banners.length} />
      </div>
      <MobileHeroBanner
        items={banners.data || thumbnails.data}
        loading={(banners.isLoading && !initialData.banners.length) && (thumbnails.isLoading && !initialData.thumbnails.length)}
      />

      <SidebarLayout>
        <BigSection
          title="Popular Today"
          icon={<Flame size={14} className="text-[#cf2442]" />}
          items={thumbnails.data}
          loading={thumbnails.isLoading && !initialData.thumbnails.length}
          viewAllHref="/popular"
        />

        <BigSection
          title="New Episodes"
          icon={<Radio size={14} className="text-[#c8ced8]" />}
          items={recent.data}
          loading={recent.isLoading && !initialData.recent.length}
          viewAllHref="/new-releases"
        />

        <BigSection
          title="Top Rated All Time"
          icon={<Trophy size={14} className="text-[#d8b56a]" />}
          items={topRated.data}
          loading={topRated.isLoading && !initialData.topRated.length}
          viewAllHref="/top-rated"
        />

        <AiringScheduleSection items={initialData.schedule} />
      </SidebarLayout>

      <HomeSeoSection />
    </AppShell>
  );
}

function SectionHeader({
  title,
  icon,
  count,
  viewAllHref,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-7 w-1 rounded-full bg-[#cf2442] shadow-[0_0_18px_rgba(207,36,66,0.44)]" />
        <span className="grid h-8 w-8 place-items-center rounded-2xl border border-white/[0.075] bg-white/[0.045]">{icon}</span>
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
          <p className="mt-0.5 hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55 sm:block">
            Curated for fast watching
          </p>
        </div>
        {count ? (
          <span className="rounded-full border border-white/[0.1] bg-white/[0.08] px-2.5 py-1 text-[11px] font-black text-white/78">
            {count}
          </span>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          aria-label={`View all ${title}`}
          className="hidden items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-black text-white/68 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white sm:flex"
        >
          View All {title} <ChevronRight size={13} />
        </Link>
      ) : null}
    </div>
  );
}

function BigSection({
  title,
  icon,
  items,
  loading,
  viewAllHref,
}: {
  title: string;
  icon?: ReactNode;
  items?: Anime[];
  loading?: boolean;
  viewAllHref?: string;
}) {
  const allItems = items ?? [];
  const visibleItems = allItems.slice(0, 18);

  return (
    <section className="content-visibility-auto border-t border-white/[0.055] py-8 first:border-t-0">
      <SectionHeader
        title={title}
        icon={icon}
        count={!loading && allItems.length > 0 ? allItems.length : undefined}
        viewAllHref={viewAllHref}
      />

      <div className="no-scrollbar scroll-strip -mx-1 flex gap-3 overflow-x-auto px-1 pb-3 sm:gap-4">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-[132px] shrink-0 sm:w-[154px]">
                <Skeleton className="aspect-[2/3] rounded-2xl bg-[#141828]" style={{ animationDelay: `${i * 20}ms` }} />
                <Skeleton className="mt-3 h-3 w-4/5 rounded-full bg-[#141828]" />
                <Skeleton className="mt-1.5 h-2.5 w-2/5 rounded-full bg-[#0d1020]" />
              </div>
            ))
          : visibleItems.map((anime, i) => (
              <AnimeGridCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i < 6} />
            ))}
      </div>

      {!loading && allItems.length > visibleItems.length && viewAllHref ? (
        <div className="mt-2 flex justify-center sm:hidden">
          <Link
            href={viewAllHref}
            aria-label={`See more ${title}`}
            className="rounded-full border border-white/[0.09] bg-white/[0.055] px-4 py-2 text-xs font-black text-white/72"
          >
            See more {title}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AnimeGridCard({ anime, priority }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const poster = posterOf(anime);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const statusKey = (anime.status || "").toLowerCase();

  return (
    <article className="card-lift scroll-card group w-[132px] shrink-0 sm:w-[154px]">
      <Link href={`/anime/${id}`} onClick={() => rememberAnime(anime)} className="block">
        <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#141828] shadow-[0_18px_45px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.055] transition group-hover:ring-[#cf2442]/28" data-loaded={imageLoaded || imageFailed}>
          {poster && !imageFailed ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width:640px) 33vw, (max-width:1024px) 25vw, 20vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              className={`object-cover transition duration-700 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <PosterFallback title={title} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/8 to-transparent" />
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.12] to-transparent" />
          </div>

          {statusKey === "currently_airing" && (
            <span className="absolute right-1.5 top-1.5 flex h-5 items-center gap-1 rounded-full bg-[#cf2442]/22 px-2 text-[8px] font-black text-[#ffd7dd] ring-1 ring-[#cf2442]/30">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#cf2442]" />
              AIRING
            </span>
          )}

          {count > 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/76 px-2 py-1 text-[8px] font-black text-white/82 backdrop-blur-md">
              EP {count}
            </span>
          )}

          {anime.score ? (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/76 px-2 py-1 text-[8px] font-black text-[#d8b56a] backdrop-blur-md">
              <Star size={7} className="fill-[#d8b56a]" />
              {Number(anime.score).toFixed(1)}
            </span>
          ) : null}

          <div className="absolute inset-0 flex items-center justify-center bg-black/42 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#cf2442] shadow-lg shadow-[#cf2442]/30">
              <Play size={14} fill="white" className="text-white" />
            </span>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-[12px] font-bold leading-4 text-white/84 transition group-hover:text-white">{title}</h3>
          <p className="mt-1 text-[10px] font-semibold text-white/64">{episodeLabel(anime)}</p>
        </div>
      </Link>
    </article>
  );
}

function AiringScheduleSection({ items }: { items: AiringScheduleItem[] }) {
  const days = useMemo(() => buildScheduleDays(items), [items]);
  const todayKey = dayKey(new Date());
  const defaultKey = days.find((day) => day.key === todayKey)?.key || days[0]?.key || todayKey;
  const [activeDay, setActiveDay] = useState(defaultKey);
  const active = days.find((day) => day.key === activeDay) || days[0];

  if (!items.length) return null;

  return (
    <section className="content-visibility-auto border-t border-white/[0.05] py-6">
      <SectionHeader
        title="Monthly Airing Schedule"
        icon={<CalendarDays size={14} className="text-[#cf2442]" />}
        count={items.length}
      />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day.key}
            onClick={() => setActiveDay(day.key)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition ${
              activeDay === day.key
                ? "border-[#cf2442]/40 bg-[#cf2442]/16 text-white shadow-lg shadow-[#cf2442]/10"
                : "border-white/[0.08] bg-[#0d1020] text-white/64 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            <span className="block text-[11px] font-black uppercase tracking-wide">{day.short}</span>
            <span className="mt-0.5 block text-[10px] font-semibold text-white/62">{day.items.length} episodes</span>
          </button>
        ))}
      </div>

      {active ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {active.items.map((item) => (
            <ScheduleCard
              key={`${item.id}-${item.episode}-${item.airingAt}`}
              item={item}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ScheduleCard({ item }: { item: AiringScheduleItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const poster = posterOf(item.anime);
  const title = titleOf(item.anime);

  return (
    <Link
      href={`/anime/${item.id}`}
      onClick={() => rememberAnime(item.anime)}
      className="scroll-card group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-[#111421]/72 p-2 transition hover:-translate-y-0.5 hover:border-[#f43f5e]/30 hover:bg-[#171b2a]"
    >
      <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]" data-loaded={Boolean(poster && !imageFailed) || imageFailed}>
        {poster && !imageFailed ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="72px"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PosterFallback title={title} />
        )}
      </div>
      <div className="min-w-0 py-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#f43f5e]">
          {formatAiringTime(item.airingAt)}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-white/82 group-hover:text-white">
          {title}
        </h3>
        <p className="mt-1 text-xs font-semibold text-white/64">Episode {item.episode}</p>
      </div>
    </Link>
  );
}

function PosterFallback({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_28%_18%,rgba(207,36,66,0.25),transparent_34%),linear-gradient(145deg,#171b2d,#080a12)]">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.06] text-lg font-black text-white/70 shadow-2xl shadow-black/35">
        {initials || "AT"}
      </div>
    </div>
  );
}

function HomeSeoSection() {
  const links = [
    { label: "Watch free anime online", href: "/free-anime" },
    { label: "New anime releases", href: "/new-releases" },
    { label: "Currently airing anime", href: "/airing" },
    { label: "Top rated anime", href: "/top-rated" },
    { label: "Anime schedule", href: "/schedule" },
  ];

  return (
    <section className="mx-auto max-w-screen-2xl px-4 pb-4 pt-2 lg:px-6">
      <div className="rounded-3xl border border-white/[0.055] bg-[#0d1020]/68 p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">AnimeTV Plus</p>
        <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-white sm:text-3xl">
          Watch anime online with fast browsing, HD playback, and fresh episode discovery.
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/68">
          animeTv helps viewers find licensed anime access, free anime discovery, subbed anime, dubbed anime,
          top rated shows, newly released episodes, and monthly airing schedules from one clean streaming interface.
          Browse titles, open anime detail pages, continue from watch history, and switch between available servers quickly.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/72 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildScheduleDays(items: AiringScheduleItem[]) {
  const grouped = new Map<string, AiringScheduleItem[]>();
  for (const item of items) {
    const key = dayKey(new Date(item.airingAt * 1000));
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return Array.from(grouped.entries()).map(([key, dayItems]) => ({
    key,
    short: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    items: dayItems.sort((a, b) => a.airingAt - b.airingAt),
  }));
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAiringTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
