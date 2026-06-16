"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock3, Flame, Play, Radio, Star, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { HeroCarousel, MobileHeroBanner, type HeroCrData } from "@/components/hero-carousel";
import { fetchCrCard } from "@/lib/catalog-api";
import { Carousel } from "@/components/carousel";
import { SpotlightBanner } from "@/components/spotlight-banner";
import { Kairo } from "@/components/mascot/kairo";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { rememberSearchCatalog } from "@/lib/search-index";
import type { AiringScheduleItem, Anime, HomeInitialData, LibraryItem } from "@/lib/types";
import { HISTORY_UPDATED_EVENT, animeId, animePath, episodeCount, episodeLabel, posterOf, progressOf, rememberAnime, rememberedAnime, rememberedHistory, titleOf, watchPath } from "@/lib/utils";

const HOME_CACHE_KEY = "animeTVplus-home-cache-v5";
const HOME_CACHE_TTL = 1000 * 60 * 60;
const warmedHomePosters = new Set<string>();

export function HomePageClient({ initialData }: { initialData: HomeInitialData }) {
  const [homeData, setHomeData] = useState(initialData);
  const loadRest = useIdleMount();
  const scheduleQuery = useQuery({
    queryKey: ["home-schedule"],
    queryFn: async () => {
      const response = await fetch("/api/home/schedule", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [] as AiringScheduleItem[];
      const payload = (await response.json()) as { schedule?: AiringScheduleItem[] };
      return payload.schedule ?? [];
    },
    enabled: loadRest,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 12,
  });

  // CR posters are now baked into the section data server-side (home-server.ts),
  // so the grid renders Crunchyroll art on the FIRST paint — no client-side
  // poster swap, no image flicker.

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw) as { expiresAt: number; value: HomeInitialData };
      if (cached.expiresAt > Date.now() && cached.value?.thumbnails?.length) {
        setHomeData((current) => (current.thumbnails.length ? current : cached.value));
      }
    } catch {
      // Cache is only a speed hint.
    }
  }, []);

  useEffect(() => {
    setHomeData(initialData);
    try {
      window.localStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({ expiresAt: Date.now() + HOME_CACHE_TTL, value: initialData }),
      );
    } catch {
      // Best-effort cache.
    }
    rememberSearchCatalog([
      ...initialData.banners,
      ...initialData.thumbnails,
      ...initialData.recent,
      ...initialData.topRated,
      ...(initialData.famousNew ?? []),
      ...(initialData.sports ?? []),
      ...(initialData.selfImprovement ?? []),
      ...initialData.schedule.map((item) => item.anime),
    ]);
  }, [initialData]);

  useEffect(() => {
    warmHomePosters([
      ...homeData.popular,
      ...(homeData.famousNew ?? []),
      ...homeData.thumbnails,
      ...(homeData.sports ?? []),
      ...(homeData.selfImprovement ?? []),
      ...homeData.topRated,
      ...homeData.recent,
    ]);
  }, [homeData]);

  // Spring spotlight: a CR-mapped title from the season, rotated daily (stable
  // between server + client render to avoid a hydration mismatch).
  const springSpotlightId = useMemo(() => {
    const pool = homeData.thumbnails.filter((a) => (a as { cr_mapped?: boolean }).cr_mapped);
    const list = pool.length ? pool : homeData.thumbnails;
    if (!list.length) return "";
    const pick = list[new Date().getDate() % list.length];
    return String(pick.mal_id || pick.anime_id || pick.id || "");
  }, [homeData.thumbnails]);

  return (
    <AppShell>
      <ResponsiveHero homeData={homeData} />
      <ContinueWatchingSection />

      <div className="mx-auto max-w-screen-2xl px-4 lg:px-8">
        {/* Most Popular — the 24 most-watched titles */}
        <BigSection
          title="Most Popular"
          icon={<Flame size={14} className="text-[#c4182a]" />}
          items={homeData.popular}
          viewAllHref="/search?q=Popular"
        />

        <BigSection
          title="Famous New Releases"
          icon={<Radio size={14} className="text-[#c8ced8]" />}
          items={homeData.famousNew ?? []}
          viewAllHref="/search?q=New%20Releases"
        />

        <SpotlightBanner malId="35507" label="Strategy Pick" fallbackTitle="Classroom of the Elite" />

        {/* April 2026 / Spring season */}
        <BigSection
          title="April 2026 Releases"
          icon={<CalendarDays size={14} className="text-[#c8ced8]" />}
          items={homeData.thumbnails}
          viewAllHref="/search?q=Spring%202026"
        />

        <BigSection
          title="Sports Anime"
          icon={<Trophy size={14} className="text-[#d8b56a]" />}
          items={homeData.sports ?? []}
          viewAllHref="/genre/sports"
        />

        {/* Spring 2026 spotlight */}
        {springSpotlightId ? <SpotlightBanner malId={springSpotlightId} label="Spring 2026" /> : null}

        <BigSection
          title="Self Improvement Anime"
          icon={<Star size={14} className="text-[#c4182a]" />}
          items={homeData.selfImprovement ?? []}
          viewAllHref="/search?q=self%20improvement"
        />

        {loadRest ? (
          <>
            {/* Top Picks — loved by fans */}
            <BigSection
              title="Top Picks"
              icon={<Trophy size={14} className="text-[#d8b56a]" />}
              items={homeData.topRated}
              viewAllHref="/search?q=Top%20Rated"
            />

            {/* New Episodes — fresh drops */}
            <BigSection
              title="New Episodes"
              icon={<Radio size={14} className="text-[#c8ced8]" />}
              items={homeData.recent}
              viewAllHref="/search?q=New%20Releases"
            />

            <SpotlightBanner malId="38000" label="Isekai Feature" fallbackTitle="That Time I Got Reincarnated as a Slime" />

            {/* Rom-Com & Harem */}
            <BigSection
              title="Rom-Com & Harem"
              icon={<Star size={14} className="text-[#c4182a]" />}
              items={homeData.romance}
              viewAllHref="/genre/romance"
            />

            {/* Isekai */}
            <BigSection
              title="Isekai Worlds"
              icon={<Flame size={14} className="text-[#c8ced8]" />}
              items={homeData.isekai}
              viewAllHref="/genre/isekai"
            />

            <SpotlightBanner malId="40748" label="Hero Feature" fallbackTitle="Jujutsu Kaisen" />

            <SpotlightBanner malId="31964" label="Training Arc" fallbackTitle="My Hero Academia" />

            {/* Best Healing / Slice of Life */}
            <BigSection
              title="Best Healing Anime"
              icon={<Star size={14} className="text-[#d8b56a]" />}
              items={homeData.healing}
              viewAllHref="/genre/slice-of-life"
            />

            <AiringScheduleSection items={scheduleQuery.data?.length ? scheduleQuery.data : homeData.schedule} />

            <KairoExploreCTA />
          </>
        ) : (
          <DeferredSectionsSkeleton />
        )}
      </div>

      {loadRest ? <HomeSeoSection /> : null}
    </AppShell>
  );
}

function ResponsiveHero({ homeData }: { homeData: HomeInitialData }) {
  const bannerItems = homeData.banners.length ? homeData.banners : homeData.thumbnails;
  const isLoading = !homeData.banners.length && !homeData.thumbnails.length;

  const malIds = useMemo(
    () => bannerItems.slice(0, 8).map((a) => String(a.mal_id || a.anime_id || a.id || "")).filter(Boolean),
    [bannerItems],
  );
  const CR_KEYART = "https://imgsrv.crunchyroll.com/cdn-cgi/image/format=auto,quality=90";
  const initialCrData = useMemo(() => {
    const data: HeroCrData = {};
    for (const anime of bannerItems.slice(0, 8)) {
      const id = String(anime.mal_id || anime.anime_id || anime.id || "");
      if (!id) continue;
      let detailBanner = anime.detail_banner || anime.cr_hero || anime.banner;
      let titleLogo = anime.title_logo;
      const crIdMatch = (detailBanner || titleLogo || "").match(/keyart\/([A-Z0-9]+)-/i);
      if (crIdMatch) {
        const crId = crIdMatch[1];
        if (!detailBanner) detailBanner = `${CR_KEYART},width=1920/keyart/${crId}-backdrop_wide`;
        if (!titleLogo) titleLogo = `${CR_KEYART},width=600/keyart/${crId}-title_logo-en-us`;
      }
      if (!detailBanner) continue;
      data[id] = {
        detail_banner: detailBanner,
        title_logo: titleLogo,
        synopsis: anime.synopsis || anime.overview,
      };
    }
    return data;
  }, [bannerItems]);
  const missingCrIds = useMemo(
    () => malIds.filter((id) => !initialCrData[id]?.title_logo),
    [malIds, initialCrData],
  );

  const crCards = useQuery({
    queryKey: ["hero-cr-live", missingCrIds.join(",")],
    queryFn: async () => {
      const results: HeroCrData = {};
      await Promise.allSettled(
        missingCrIds.map(async (mid) => {
          const card = await fetchCrCard(mid, undefined, true);
          if (card?.detail_banner) {
            results[mid] = { detail_banner: card.detail_banner, title_logo: card.title_logo, synopsis: card.synopsis };
          }
        }),
      );
      return results;
    },
    enabled: missingCrIds.length > 0,
    staleTime: 1000 * 60 * 60,
  });

  const crData = useMemo(() => ({ ...initialCrData, ...(crCards.data || {}) }), [initialCrData, crCards.data]);
  // The desktop hero is reserved for titles that have real Crunchyroll keyart
  // (wide detail banner). Filter the banners down to those, and fall back to
  // raw banners so the hero never waits on late CR detail calls.
  const crBanners = useMemo(() => {
    return homeData.banners.filter((a) => crData[String(a.mal_id || a.anime_id || a.id || "")]?.detail_banner);
  }, [homeData.banners, crData]);
  const heroItems = crBanners.length ? crBanners : (homeData.banners.length ? homeData.banners : bannerItems);
  const heroLoading = !heroItems.length;

  return (
    <>
      <div className="hidden sm:block">
        <HeroCarousel items={heroItems} loading={heroLoading} crData={crData} />
      </div>
      <div className="sm:hidden">
        <MobileHeroBanner items={heroItems.length ? heroItems : bannerItems} loading={heroLoading || isLoading} crData={crData} />
      </div>
    </>
  );
}

function useSmallScreen() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function useIdleMount() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;
    const show = () => setReady(true);
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(show, { timeout: 1200 });
    } else {
      timer = globalThis.setTimeout(show, 650);
    }
    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timer !== undefined) globalThis.clearTimeout(timer);
    };
  }, [ready]);

  return ready;
}

function warmHomePosters(items: Anime[]) {
  if (typeof window === "undefined" || !items.length) return;
  const warm = () => {
    for (const [index, anime] of items.slice(0, 72).entries()) {
      const poster = posterOf(anime, index < 8 ? "poster-md" : "poster-sm");
      if (!poster || warmedHomePosters.has(poster)) continue;
      warmedHomePosters.add(poster);
      const image = new window.Image();
      image.decoding = "async";
      (image as HTMLImageElement & { fetchPriority?: string }).fetchPriority = index < 8 ? "high" : "low";
      image.src = poster;
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 1000 });
  else globalThis.setTimeout(warm, 400);
}

function DeferredSectionsSkeleton() {
  return (
    <div className="border-t border-white/[0.055] py-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-7 w-1 rounded-full bg-[#c4182a]/80" />
        <div className="h-8 w-8 rounded-2xl bg-white/[0.045]" />
        <div className="h-5 w-40 rounded-full bg-white/[0.055]" />
      </div>
      <div className="no-scrollbar flex gap-3 overflow-hidden pb-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="w-[132px] shrink-0 sm:w-[154px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.045]" />
            <div className="mt-2 h-3 w-5/6 rounded-full bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ContinueWatchingSection() {
  const { token } = useAuth();
  const [localItems, setLocalItems] = useState<LibraryItem[]>([]);
  const [imagesReadyKey, setImagesReadyKey] = useState("");

  useEffect(() => {
    const refresh = () => setLocalItems(rememberedHistory(8));
    refresh();
    window.addEventListener(HISTORY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, refresh);
  }, []);

  const serverHistory = useQuery({
    queryKey: ["history", token],
    queryFn: () => api.history(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10,
  });

  const items = useMemo(
    () => mergeHistoryItems(localItems, serverHistory.data).map(enrichHistoryPoster).filter(hasPoster).slice(0, 5),
    [localItems, serverHistory.data],
  );
  const posterKey = useMemo(
    () => items.map((item) => posterOf(item, "poster-sm")).filter(Boolean).join("|"),
    [items],
  );

  useEffect(() => {
    if (!items.length) {
      setImagesReadyKey("");
      return;
    }

    const posters = items.map((item) => posterOf(item, "poster-sm")).filter(Boolean);
    if (!posters.length) {
      setImagesReadyKey(posterKey);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setImagesReadyKey(posterKey);
    }, 1800);

    Promise.allSettled(
      posters.map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new window.Image();
            image.decoding = "async";
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = src;
            if (image.complete) resolve();
          }),
      ),
    ).then(() => {
      if (!cancelled) {
        window.clearTimeout(timer);
        setImagesReadyKey(posterKey);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [items, posterKey]);

  if (!items.length || imagesReadyKey !== posterKey) return null;

  return (
    <section className="mx-auto max-w-screen-2xl px-4 pt-4 lg:px-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-2xl border border-white/[0.075] bg-white/[0.045]">
            <Clock3 size={14} className="text-[#c4182a]" />
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">Watch From Where You Left</h2>
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/48 sm:block">
              Continue instantly
            </p>
          </div>
        </div>
        <Link href="/history" className="rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-black text-white/74">
          History
        </Link>
      </div>

      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 pt-3">
        {items.map((item) => (
          <ContinueCard key={`${item.mal_id || item.anime_id}-${item.episode || item.episode_num}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function ContinueCard({ item }: { item: LibraryItem }) {
  const id = animeId(item);
  const episode = Number(item.episode || item.episode_num || 1);
  const poster = posterOf(item, "poster-sm");
  const title = titleOf(item);
  const progress = progressOf(item);

  return (
    <Link
      href={watchPath(item, id, episode)}
      className="group grid w-[245px] shrink-0 grid-cols-[72px_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-[#111421]/76 p-2 transition hover:border-[#c4182a]/30 hover:bg-[#171b2a] sm:w-[280px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
        {poster ? <Image src={poster} alt={title} fill sizes="72px" className="object-cover" loading="lazy" unoptimized /> : <PosterFallback title={title} />}
      </div>
      <div className="min-w-0 py-1">
        <p className="line-clamp-2 text-sm font-black leading-5 text-white/88 group-hover:text-white">{title}</p>
        <p className="mt-1 text-xs font-bold text-white/54">Episode {episode}{progress > 1 ? ` at ${formatClock(progress)}` : ""}</p>
        <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#c4182a] px-3 text-xs font-black text-white">
          <Play size={12} fill="currentColor" />
          Resume
        </span>
      </div>
    </Link>
  );
}

function SectionHeader({
  title,
  icon,
  count,
  viewAllHref,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center text-[#c4182a]">{icon}</span>
        <h2 className="text-[22px] font-bold tracking-tight text-white">{title}</h2>
        {count ? (
          <span className="text-[13px] font-semibold text-white/40">{count}</span>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          aria-label={`View all ${title}`}
          className="hidden items-center gap-0.5 text-[13px] font-bold uppercase tracking-wide text-white/55 transition hover:text-[#c4182a] sm:flex"
        >
          View All <ChevronRight size={15} />
        </Link>
      ) : null}
    </div>
  );
}

function BigSection({
  title,
  icon,
  items,
  viewAllHref,
}: {
  title: string;
  icon?: React.ReactNode;
  items?: Anime[];
  viewAllHref?: string;
}) {
  const allItems = items ?? [];
  const visibleItems = allItems;

  return (
    <section className="content-visibility-auto py-6 first:pt-3">
      <SectionHeader title={title} icon={icon} count={allItems.length || undefined} viewAllHref={viewAllHref} />

      <Carousel className="-mx-1 gap-4 px-1 pb-3 lg:gap-5">
        {visibleItems.map((anime, i) => (
          <AnimeGridCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i === 0} />
        ))}
      </Carousel>

      {allItems.length > visibleItems.length && viewAllHref ? (
        <div className="mt-2 flex justify-center sm:hidden">
          <Link
            href={viewAllHref}
            aria-label={`See more ${title}`}
            className="rounded-full border border-white/[0.09] bg-white/[0.055] px-4 py-2 text-xs font-black text-white/78"
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
  const poster = posterOf(anime, priority ? "poster-md" : "poster-sm");
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const statusKey = (anime.status || "").toLowerCase();

  return (
    <article className="card-lift scroll-card group w-[150px] shrink-0 sm:w-[172px] lg:w-[196px] xl:w-[222px]">
      <Link href={animePath(anime, id)} onClick={() => rememberAnime(anime)} className="block">
        <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-md bg-[#0c0c0e] shadow-[0_18px_45px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.05] transition group-hover:ring-[#c4182a]/30">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width:640px) 45vw, (max-width:1024px) 28vw, 222px"
              priority={priority}
              unoptimized
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              loading={priority ? undefined : "lazy"}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <PosterFallback title={title} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/8 to-transparent" />

          {statusKey === "currently_airing" && (
            <span className="absolute right-1.5 top-1.5 flex h-5 items-center gap-1 rounded-full bg-[#c4182a]/22 px-2 text-[8px] font-black text-[#ffd7dd] ring-1 ring-[#c4182a]/30">
              <span className="h-1 w-1 rounded-full bg-[#c4182a]" />
              AIRING
            </span>
          )}

          {count > 0 && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/76 px-2 py-1 text-[8px] font-black text-white/88 backdrop-blur-md">
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
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#c4182a] shadow-lg shadow-[#c4182a]/30">
              <Play size={14} fill="white" className="text-white" />
            </span>
          </div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-2 text-[12px] font-bold leading-4 text-white/88 transition group-hover:text-white">{title}</h3>
          <p className="mt-1 text-[10px] font-semibold text-white/68">{episodeLabel(anime)}</p>
        </div>
      </Link>
    </article>
  );
}

function AiringScheduleSection({ items }: { items: AiringScheduleItem[] }) {
  const [now] = useState(() => Date.now());
  const today = items.filter((item) => isTodayInKolkata(item.airingAt));
  const fallbackUpcoming = items.filter((item) => item.airingAt * 1000 >= now);
  const visibleItems = (today.length ? today : fallbackUpcoming.length ? fallbackUpcoming : items).slice(0, 12);
  const title = today.length ? "Airing Today" : "Upcoming Schedule";
  if (!visibleItems.length) return null;

  return (
    <section className="content-visibility-auto border-t border-white/[0.05] py-6">
      <SectionHeader
        title={title}
        icon={<CalendarDays size={14} className="text-[#c4182a]" />}
        count={visibleItems.length}
        viewAllHref="/schedule"
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <ScheduleCard key={`${item.id}-${item.episode}-${item.airingAt}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function ScheduleCard({ item }: { item: AiringScheduleItem }) {
  const poster = posterOf(item.anime, "poster-sm");
  const title = titleOf(item.anime);

  return (
    <Link
      href={animePath(item.anime, item.id)}
      onClick={() => rememberAnime(item.anime)}
      className="scroll-card group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-[#111421]/72 p-2 transition hover:-translate-y-0.5 hover:border-[#f43f5e]/30 hover:bg-[#171b2a]"
    >
      <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
        {poster ? (
          <Image src={poster} alt={title} fill sizes="72px" className="object-cover" loading="lazy" unoptimized />
        ) : (
          <PosterFallback title={title} />
        )}
      </div>
      <div className="min-w-0 py-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#f43f5e]">
          {formatAiringTime(item.airingAt)}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-white/86 group-hover:text-white">
          {title}
        </h3>
        <p className="mt-1 text-xs font-semibold text-white/68">Episode {item.episode}</p>
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
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.06] text-lg font-black text-white/74 shadow-2xl shadow-black/35">
        {initials || "AT"}
      </div>
    </div>
  );
}

function KairoExploreCTA() {
  return (
    <section className="my-10 flex flex-col items-center gap-5 py-10 text-center">
      <Kairo mood="notfound" size={150} />
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Still looking for something to watch?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">Kairo&apos;s got thousands more. Dive into the full catalog and find your next binge.</p>
      </div>
      <Link
        href="/search"
        className="inline-flex h-12 items-center gap-2 rounded-[4px] bg-[#c4182a] px-7 text-[14px] font-extrabold uppercase tracking-[0.02em] text-white transition-colors duration-200 hover:bg-[#d8273a]"
      >
        Explore our full catalog
        <ChevronRight size={18} />
      </Link>
    </section>
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
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff5b78]">animeTVplus</p>
        <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-white sm:text-3xl">
          animetvplus official anime streaming, fast browsing, HD playback, and fresh episode discovery.
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/72">
          animetvplus, also written as animeTVplus, is the official animeTVplus website on animetvplus.xyz. It helps viewers
          find anime streaming pages, free anime discovery, subbed anime, dubbed anime, top rated shows, newly released episodes,
          global anime chat, watch history, watchlists, and monthly airing schedules from one clean streaming interface.
        </p>
        <p className="mt-3 max-w-4xl text-xs font-semibold leading-6 text-white/48">
          Search animeTVplus on Google to find the official animetvplus.xyz anime streaming homepage, anime schedule,
          genre pages, episode pages, and fast HD anime player.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/78 transition hover:border-[#c4182a]/35 hover:bg-[#c4182a]/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatAiringTime(value: number) {
  return new Date(value * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isTodayInKolkata(value: number) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(value * 1000)) === formatter.format(new Date());
}

function mergeHistoryItems(localItems: LibraryItem[], serverItems: LibraryItem[] | undefined) {
  const byId = new Map<string, LibraryItem>();
  [...localItems, ...(serverItems ?? [])].forEach((item) => {
    const id = animeId(item);
    if (!id) return;
    const existing = byId.get(id);
    const existingTime = watchedAt(existing);
    const nextTime = watchedAt(item);
    if (!existing || nextTime >= existingTime) byId.set(id, { ...existing, ...item });
  });
  return Array.from(byId.values()).sort((a, b) => watchedAt(b) - watchedAt(a));
}

function enrichHistoryPoster(item: LibraryItem): LibraryItem {
  const id = animeId(item);
  const remembered = rememberedAnime(id);
  if (!remembered) return item;
  return {
    ...remembered,
    ...item,
    mal_id: String(item.mal_id || remembered.mal_id || remembered.anime_id || id),
    anime_id: String(item.anime_id || remembered.anime_id || remembered.mal_id || id),
    image_url: item.image_url || remembered.image_url || remembered.poster || remembered.image || remembered.thumbnail,
    poster: item.poster || remembered.poster || remembered.image_url,
    image: item.image || remembered.image,
    thumbnail: item.thumbnail || remembered.thumbnail,
    banner: item.banner || remembered.banner,
  };
}

function hasPoster(item: LibraryItem) {
  return Boolean(posterOf(item, "poster-sm"));
}

function watchedAt(item: LibraryItem | undefined) {
  const value = item?.watched_at || item?.created_at;
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
