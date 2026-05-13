import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";
import { getHomeInitialData } from "@/lib/home-server";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { animeId, posterOf, titleOf } from "@/lib/utils";

export const revalidate = 900;
export const metadata = buildPageMetadata({
  title: "Anime Release Schedule",
  description: "See this week's anime release schedule and upcoming airing episodes on animeTv.",
  path: "/schedule",
});

export default async function SchedulePage() {
  const { schedule } = await getHomeInitialData();
  const grouped = groupByDay(schedule);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Anime Release Schedule on ${SITE_NAME}`,
    url: absoluteUrl("/schedule"),
    description: "Weekly anime airing schedule with episode links and release times.",
  };

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-7">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
          <header className="mb-7 max-w-3xl">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">
              Weekly schedule
            </p>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              Anime Release Schedule
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/46 sm:text-base">
              Follow upcoming anime episodes by day. This page gives Google and viewers a crawlable schedule for airing anime.
            </p>
          </header>

          <div className="space-y-7">
            {grouped.length ? grouped.map((group) => (
              <section key={group.label}>
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
                        href={`/anime/${id}`}
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
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const label = new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(item.airingAt * 1000));
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return Array.from(groups.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
}

function formatTime(airingAt: number) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(airingAt * 1000));
}
