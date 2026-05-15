import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flame, Play, Radio, Star, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HeroCarousel, MobileHeroBanner } from "@/components/hero-carousel";
import { SidebarLayout } from "@/components/sidebar";
import type { AiringScheduleItem, Anime, HomeInitialData } from "@/lib/types";
import { animeId, animePath, episodeCount, episodeLabel, posterOf, titleOf } from "@/lib/utils";

export function HomePageClient({ initialData }: { initialData: HomeInitialData }) {
  return (
    <AppShell>
      <div className="hidden sm:block">
        <HeroCarousel items={initialData.banners} loading={!initialData.banners.length} />
      </div>
      <MobileHeroBanner
        items={initialData.banners.length ? initialData.banners : initialData.thumbnails}
        loading={!initialData.banners.length && !initialData.thumbnails.length}
      />

      <SidebarLayout>
        <BigSection
          title="Popular Today"
          icon={<Flame size={14} className="text-[#cf2442]" />}
          items={initialData.thumbnails}
          viewAllHref="/popular"
        />

        <BigSection
          title="New Episodes"
          icon={<Radio size={14} className="text-[#c8ced8]" />}
          items={initialData.recent}
          viewAllHref="/new-releases"
        />

        <BigSection
          title="Top Rated All Time"
          icon={<Trophy size={14} className="text-[#d8b56a]" />}
          items={initialData.topRated}
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
  icon?: React.ReactNode;
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
          <p className="mt-0.5 hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 sm:block">
            Curated for fast watching
          </p>
        </div>
        {count ? (
          <span className="rounded-full border border-white/[0.1] bg-white/[0.08] px-2.5 py-1 text-[11px] font-black text-white/84">
            {count}
          </span>
        ) : null}
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          aria-label={`View all ${title}`}
          className="hidden items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-black text-white/74 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white sm:flex"
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
  viewAllHref,
}: {
  title: string;
  icon?: React.ReactNode;
  items?: Anime[];
  viewAllHref?: string;
}) {
  const allItems = items ?? [];
  const visibleItems = allItems.slice(0, 10);

  return (
    <section className="content-visibility-auto border-t border-white/[0.055] py-8 first:border-t-0">
      <SectionHeader title={title} icon={icon} count={allItems.length || undefined} viewAllHref={viewAllHref} />

      <div className="no-scrollbar scroll-strip -mx-1 flex gap-3 overflow-x-auto px-1 pb-3 sm:gap-4">
        {visibleItems.map((anime, i) => (
          <AnimeGridCard key={`${animeId(anime)}-${i}`} anime={anime} priority={i === 0} />
        ))}
      </div>

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
  const poster = posterOf(anime, "poster-sm");
  const title = titleOf(anime);
  const count = episodeCount(anime);
  const statusKey = (anime.status || "").toLowerCase();

  return (
    <article className="card-lift scroll-card group w-[132px] shrink-0 sm:w-[154px]">
      <Link href={animePath(anime, id)} className="block">
        <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#141828] shadow-[0_18px_45px_rgba(0,0,0,0.34)] ring-1 ring-white/[0.055] transition group-hover:ring-[#cf2442]/28">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              sizes="(max-width:640px) 33vw, (max-width:1024px) 25vw, 154px"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <PosterFallback title={title} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/8 to-transparent" />

          {statusKey === "currently_airing" && (
            <span className="absolute right-1.5 top-1.5 flex h-5 items-center gap-1 rounded-full bg-[#cf2442]/22 px-2 text-[8px] font-black text-[#ffd7dd] ring-1 ring-[#cf2442]/30">
              <span className="h-1 w-1 rounded-full bg-[#cf2442]" />
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
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#cf2442] shadow-lg shadow-[#cf2442]/30">
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
  const upcoming = items.slice(0, 12);
  if (!upcoming.length) return null;

  return (
    <section className="content-visibility-auto border-t border-white/[0.05] py-6">
      <SectionHeader
        title="Monthly Airing Schedule"
        icon={<CalendarDays size={14} className="text-[#cf2442]" />}
        count={items.length}
        viewAllHref="/schedule"
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((item) => (
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
      className="scroll-card group grid grid-cols-[72px_1fr] gap-3 rounded-2xl border border-white/[0.06] bg-[#111421]/72 p-2 transition hover:-translate-y-0.5 hover:border-[#f43f5e]/30 hover:bg-[#171b2a]"
    >
      <div className="netflix-image-shell relative aspect-[2/3] overflow-hidden rounded-xl bg-[#141828]">
        {poster ? (
          <Image src={poster} alt={title} fill sizes="72px" className="object-cover" loading="lazy" />
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
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff5b78]">AnimeTV Plus</p>
        <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-white sm:text-3xl">
          Watch anime online with fast browsing, HD playback, and fresh episode discovery.
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/72">
          animeTv helps viewers find licensed anime access, free anime discovery, subbed anime, dubbed anime,
          top rated shows, newly released episodes, and monthly airing schedules from one clean streaming interface.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/78 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white"
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
