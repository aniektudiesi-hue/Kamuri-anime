import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { getHomeInitialData } from "@/lib/home-server";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { animeId, animePath, posterOf, titleOf } from "@/lib/utils";

export const revalidate = 900;
export const metadata = buildPageMetadata({
  title: "Monthly Anime Release Schedule",
  description: "See this month's anime release schedule and upcoming airing episodes on animeTVplus.",
  path: "/schedule",
});

export default async function SchedulePage() {
  const { schedule } = await getHomeInitialData({ fullSchedule: true });
  const grouped = groupByDay(schedule);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${monthLabel} Anime Release Schedule on ${SITE_NAME}`,
    url: absoluteUrl("/schedule"),
    description: "Monthly anime airing schedule with episode links and release times.",
  };

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
          <header className="mb-7 max-w-3xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">
              Monthly schedule
            </p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              {monthLabel} Anime Release Schedule
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/46 sm:text-base">
              Follow every known airing episode for the current month. This schedule refreshes automatically as the month changes.
            </p>
          </header>

          {grouped.length ? (
            <nav
              aria-label="Schedule days"
              className="sticky top-[76px] z-20 -mx-4 mb-5 border-y border-white/[0.055] bg-[#06070d]/88 px-4 py-3 backdrop-blur-xl sm:top-[82px] lg:mx-0 lg:rounded-2xl lg:border lg:bg-[#0d1020]/82"
            >
              <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto">
                {grouped.map((group) => (
                  <Link
                    key={group.key}
                    href={`#${group.key}`}
                    className={`shrink-0 snap-start rounded-xl border px-3 py-2 text-left transition ${
                      group.isToday
                        ? "border-[#cf2442]/45 bg-[#cf2442]/18 text-white shadow-lg shadow-[#cf2442]/12"
                        : "border-white/[0.075] bg-white/[0.045] text-white/68 hover:border-white/[0.14] hover:text-white"
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase tracking-widest">
                      {group.isToday ? "Today" : group.weekday}
                    </span>
                    <span className="mt-0.5 block text-xs font-bold">{group.shortLabel}</span>
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}

          <div className="space-y-7">
            {grouped.length ? grouped.map((group) => (
              <section key={group.key} id={group.key} className="scroll-mt-36">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-[#cf2442]" />
                  <h2 className="text-lg font-black text-white">{group.label}</h2>
                  <span className="rounded-lg bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold text-white/30">
                    {group.items.length} episodes
                  </span>
                </div>
                <div className="grid gap-2">
                  {group.items.map((item) => {
                    const title = titleOf(item.anime);
                    const poster = posterOf(item.anime);
                    const id = animeId(item.anime) || item.id;
                    return (
                      <Link
                        key={`${id}-${item.episode}-${item.airingAt}`}
                        href={animePath(item.anime, id)}
                        className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#0d1020] p-2 transition hover:border-white/[0.13] hover:bg-[#15192a]"
                      >
                        <div className="relative h-16 w-14 overflow-hidden rounded-xl bg-[#141828]">
                          {poster ? <Image src={poster} alt="" fill sizes="56px" className="object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-bold text-white/86">{title}</p>
                          <p className="mt-1 text-xs text-white/34">Episode {item.episode}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-xl bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white/46">
                          <Clock3 size={13} />
                          {formatTime(item.airingAt)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0d1020] p-8 text-center text-white/40">
                The schedule is refreshing. Try again soon.
              </div>
            )}
          </div>
        </div>
      </SidebarLayout>
    </AppShell>
  );
}

function groupByDay(items: Awaited<ReturnType<typeof getHomeInitialData>>["schedule"]) {
  type ScheduleGroup = {
    key: string;
    label: string;
    shortLabel: string;
    weekday: string;
    dayValue: string;
    isToday: boolean;
    items: typeof items;
  };
  const groups = new Map<string, ScheduleGroup>();
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const todayValue = dayFormatter.format(new Date());
  for (const item of items) {
    const date = new Date(item.airingAt * 1000);
    const dayValue = dayFormatter.format(date);
    const label = new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date);
    const shortLabel = new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("en", {
      weekday: "short",
      timeZone: "Asia/Kolkata",
    }).format(date);
    const existing = groups.get(dayValue);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(dayValue, {
        key: `day-${dayValue}`,
        label,
        shortLabel,
        weekday,
        dayValue,
        isToday: dayValue === todayValue,
        items: [item],
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    const aPast = a.dayValue < todayValue;
    const bPast = b.dayValue < todayValue;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return a.dayValue.localeCompare(b.dayValue);
  });
}

function formatTime(airingAt: number) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(airingAt * 1000));
}
