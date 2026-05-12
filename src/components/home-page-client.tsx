"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Flame, Play, Radio, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HeroCarousel, MobileHeroBanner } from "@/components/hero-carousel";
import { SidebarLayout } from "@/components/sidebar";
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
          icon={<Flame size={14} className="text-[#c8223d]" />}
          items={thumbnails.data}
          loading={thumbnails.isLoading && !initialData.thumbnails.length}
          viewAllHref="/search?q=popular"
        />

        <BigSection
          title="New Episodes"
          icon={<Radio size={14} className="text-[#c8ced8]" />}
          items={recent.data}
          loading={recent.isLoading && !initialData.recent.length}
          viewAllHref="/search?q=airing"
        />

        <BigSection
          title="Top Rated All Time"
          icon={<Trophy size={14} className="text-[#d8b56a]" />}
          items={topRated.data}
          loading={topRated.isLoading && !initialData.topRated.length}
          viewAllHref="/search?q=top+rated"
        />

        <AiringScheduleSection items={initialData.schedule} />
      </SidebarLayout>
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
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-[#c8223d]" />
        {icon}
        <h2 className="text-base font-black text-white">{title}</h2>
        {count ? (
          <span className="rounded-lg bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-white/30">
            {count}
          </span>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-xs font-semibold text-white/35 transition-colors hover:text-white"
        >
          View All <ChevronRight size={13} />
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
  const visibleItems = allItems.slice(0, 36);

  return (
    <section className="content-visibility-auto border-t border-white/[0.05] py-6 first:border-t-0">
      <SectionHeader
        title={title}
        icon={icon}
        count={!loading && allItems.length > 0 ? allItems.length : undefined}
        viewAllHref={viewAllHref}
      />

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {loading
          ? Array.from({ length: 18 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[2/3] animate-pulse rounded-xl bg-[#141828]" style={{ animationDelay: `${i * 20}ms` }} />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" />
                <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#0d1020]" />
              </div>
            ))
          : visibleItems.map((anime, i) => (
              <AnimeGridCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i < 6} />
            ))}
      </div>
    </section>
  );
}

function AnimeGridCard({ anime, priority }: { anime: Anime; priority?: boolean }) {
  const id = animeId(anime);
  const poster = posterOf(anime);
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const statusKey = (anime.status || "").toLowerCase();

  return (
    <article className="card-lift group">
      <Link href={`/anime/${id}`} onClick={() => rememberAnime(anime)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width:640px) 33vw, (max-width:1024px) 25vw, 20vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-[#141828]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {statusKey === "currently_airing" && (
            <span className="absolute right-1.5 top-1.5 flex h-4 items-center gap-1 rounded bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
              <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
              AIRING
            </span>
          )}

          {count > 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-white/80">
              EP {count}
            </span>
          )}

          {anime.score ? (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-[#d8b56a]">
              <Star size={7} className="fill-[#d8b56a]" />
              {Number(anime.score).toFixed(1)}
            </span>
          ) : null}

          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#c8223d] shadow-lg shadow-[#c8223d]/30">
              <Play size={14} fill="white" className="text-white" />
            </span>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-[11px] font-semibold leading-4 text-white/80">{title}</h3>
          <p className="mt-1 text-[10px] text-white/30">{episodeLabel(anime)}</p>
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
        title="Airing Schedule"
        icon={<CalendarDays size={14} className="text-[#c8223d]" />}
        count={items.length}
      />

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day.key}
            onClick={() => setActiveDay(day.key)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition ${
              activeDay === day.key
                ? "border-[#c8223d]/40 bg-[#c8223d]/16 text-white shadow-lg shadow-[#c8223d]/10"
                : "border-white/[0.07] bg-[#0d1020] text-white/45 hover:border-white/[0.14] hover:text-white"
            }`}
          >
            <span className="block text-[11px] font-black uppercase tracking-wide">{day.short}</span>
            <span className="mt-0.5 block text-[10px] font-semibold text-white/35">{day.items.length} episodes</span>
          </button>
        ))}
      </div>

      {active ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {active.items.map((item) => (
            <Link
              key={`${item.id}-${item.episode}-${item.airingAt}`}
              href={`/anime/${item.id}`}
              onClick={() => rememberAnime(item.anime)}
              className="group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-[#0d1020]/70 p-2 transition hover:border-[#c8223d]/30 hover:bg-[#141828]"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
                {posterOf(item.anime) ? (
                  <Image src={posterOf(item.anime)} alt="" fill sizes="72px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 py-1">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#c8223d]">
                  {formatAiringTime(item.airingAt)}
                </p>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-white/82 group-hover:text-white">
                  {titleOf(item.anime)}
                </h3>
                <p className="mt-1 text-xs font-semibold text-white/36">Episode {item.episode}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
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
