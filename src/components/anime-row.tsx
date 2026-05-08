"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimeCard } from "./anime-card";
import type { Anime } from "@/lib/types";
import { animeId } from "@/lib/utils";

type RowProps = {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  items?: Anime[];
  loading?: boolean;
  priorityCards?: boolean;
};

export function AnimeRow({ title, subtitle, viewAllHref, items, loading, priorityCards = false }: RowProps) {
  return (
    <section className="mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
      {/* Section header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-white/35">{subtitle}</p> : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white/40 transition-colors hover:text-white"
          >
            View all <ChevronRight size={15} />
          </Link>
        ) : null}
      </div>

      {/* Horizontal scroll */}
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)
          : items?.map((anime, i) => (
              <AnimeCard
                key={`${animeId(anime)}-${i}`}
                anime={anime}
                priority={priorityCards && i < 4}
              />
            ))}
      </div>
    </section>
  );
}

export function LazyAnimeRow(props: RowProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <AnimeRow {...props} />
      ) : (
        <section className="mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
          <div className="mb-5 h-6 w-40 rounded-full bg-[#141828]" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="w-[160px] shrink-0 sm:w-[180px]">
      <div className="aspect-[2/3] animate-pulse rounded-2xl bg-[#141828]" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-[#141828]" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[#0d1020]" />
    </div>
  );
}
