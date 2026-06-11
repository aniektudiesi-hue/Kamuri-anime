"use client";

import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const stripRef = useRef<HTMLDivElement | null>(null);
  // Which arrows are usable (Crunchyroll only shows an arrow when you can scroll that way).
  const [edges, setEdges] = useState({ left: false, right: false });

  const recompute = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    recompute();
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", recompute); ro.disconnect(); };
  }, [recompute, items, loading]);

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    // Page by ~90% of the visible width — same "almost-a-screenful" feel as CR.
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: "smooth" });
  }, []);

  return (
    <section className="content-visibility-auto group/row mx-auto max-w-screen-2xl px-4 py-7 lg:px-6">
      {/* Section header */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl font-black tracking-tight text-white">
            <span className="h-[18px] w-1 rounded-full bg-[#e11d2a]" />
            {title}
          </h2>
          {subtitle ? <p className="mt-1 pl-[18px] text-sm text-white/35">{subtitle}</p> : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white/40 transition-colors hover:text-[#ff4a68]"
          >
            View all <ChevronRight size={15} />
          </Link>
        ) : null}
      </div>

      {/* Carousel — edge fades + hover arrows like Crunchyroll */}
      <div className="relative">
        {/* left/right edge fade masks */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#05060a] to-transparent transition-opacity duration-300 ${edges.left ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#05060a] to-transparent transition-opacity duration-300 ${edges.right ? "opacity-100" : "opacity-0"}`}
        />

        {/* arrows: fade in on row hover, only when scrollable that way */}
        <RowArrow side="left"  show={edges.left}  onClick={() => scrollByPage(-1)} />
        <RowArrow side="right" show={edges.right} onClick={() => scrollByPage(1)} />

        <div ref={stripRef} className="no-scrollbar scroll-strip -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
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
      </div>
    </section>
  );
}

function RowArrow({ side, show, onClick }: { side: "left" | "right"; show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      className={`absolute top-0 z-20 hidden h-full w-12 place-items-center text-white
        opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 md:grid
        ${side === "left" ? "left-0 bg-gradient-to-r from-black/55 to-transparent" : "right-0 bg-gradient-to-l from-black/55 to-transparent"}
        ${show ? "" : "pointer-events-none !opacity-0"}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-black/70 ring-1 ring-white/15 backdrop-blur-sm transition hover:scale-110 hover:bg-[#e11d2a] hover:ring-[#e11d2a]">
        {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
      </span>
    </button>
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
        <section className="content-visibility-auto mx-auto max-w-screen-2xl px-4 py-7 lg:px-6">
          <div className="mb-4 h-6 w-40 rounded-full bg-[#141828]" />
          <div className="no-scrollbar scroll-strip flex gap-4 overflow-x-auto pb-2">
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
      <div className="aspect-[2/3] animate-pulse rounded-lg bg-[#141828]" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-[#141828]" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[#0d1020]" />
    </div>
  );
}
