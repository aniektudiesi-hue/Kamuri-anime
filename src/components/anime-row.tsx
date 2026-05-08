"use client";

import { useEffect, useRef, useState } from "react";
import { AnimeCard } from "./anime-card";
import type { Anime } from "@/lib/types";
import { animeId } from "@/lib/utils";

export function AnimeRow({ title, items, loading, priorityCards = false }: { title: string; items?: Anime[]; loading?: boolean; priorityCards?: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-7">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {loading
          ? Array.from({ length: 10 }).map((_, index) => <CardSkeleton key={index} />)
          : items?.map((anime, index) => <AnimeCard key={`${animeId(anime)}-${index}`} anime={anime} priority={priorityCards && index < 4} />)}
      </div>
    </section>
  );
}

export function LazyAnimeRow(props: React.ComponentProps<typeof AnimeRow>) {
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
      { rootMargin: "420px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref}>
      {visible ? (
        <AnimeRow {...props} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-7">
          <div className="mb-4 h-7 w-44 rounded bg-panel-strong" />
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 10 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="w-[150px] shrink-0 sm:w-[170px]">
      <div className="aspect-[2/3] animate-pulse rounded-md bg-panel-strong" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-panel-strong" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-panel-strong" />
    </div>
  );
}
