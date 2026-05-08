"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { Anime } from "@/lib/types";
import { animeId, bannerOf, episodeCount, titleOf } from "@/lib/utils";
import { ButtonLink } from "./button";

export function HeroCarousel({ items = [], loading }: { items?: Anime[]; loading?: boolean }) {
  const [index, setIndex] = useState(0);
  const current = items[index % Math.max(items.length, 1)];

  useEffect(() => {
    if (!items.length) return;
    const timeout = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => window.clearInterval(timeout);
  }, [items.length]);

  if (loading) {
    return <div className="mx-auto mt-4 h-[520px] max-w-7xl animate-pulse rounded-md bg-panel-strong" />;
  }

  if (!current) return null;

  return (
    <section className="relative min-h-[520px] overflow-hidden">
      <div className="absolute inset-0">
        {bannerOf(current) ? <Image src={bannerOf(current)} alt="" fill priority sizes="100vw" className="object-cover" /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090a10_0%,rgba(9,10,16,.86)_38%,rgba(9,10,16,.30)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-end px-4 pb-14 pt-20">
        <div className="max-w-2xl">
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-accent-2">
            <span>Featured</span>
            <span>Score {current.score || "NA"}</span>
            <span>{episodeCount(current) || "?"} Episodes</span>
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-6xl">{titleOf(current)}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base">
            Stream the latest episodes with fast server fallback, instant search, watch history, and a focused dark viewing experience powered by RO-ANIME v3.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`/watch/${animeId(current)}/1`}>
              <Play size={17} fill="currentColor" />
              Watch episode 1
            </ButtonLink>
            <ButtonLink href={`/anime/${animeId(current)}`} variant="panel">
              Details
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-4 hidden gap-2 sm:flex">
        <button aria-label="Previous banner" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)} className="grid h-10 w-10 place-items-center rounded-md bg-black/50 hover:bg-black/70">
          <ChevronLeft size={18} />
        </button>
        <button aria-label="Next banner" onClick={() => setIndex((i) => (i + 1) % items.length)} className="grid h-10 w-10 place-items-center rounded-md bg-black/50 hover:bg-black/70">
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
