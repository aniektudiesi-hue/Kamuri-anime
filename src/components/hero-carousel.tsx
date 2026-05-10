"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Star, TvIcon, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Anime } from "@/lib/types";
import { animeId, bannerOf, episodeCount, posterOf, titleOf } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  currently_airing: "Airing Now",
  finished_airing: "Completed",
  not_yet_aired: "Upcoming",
};

export function HeroCarousel({ items = [], loading }: { items?: Anime[]; loading?: boolean }) {
  const [index, setIndex] = useState(0);
  const [, setPrev] = useState(-1);
  const [, setDir] = useState<1 | -1>(1);
  const timerRef = useRef<number | undefined>(undefined);
  const len = Math.max(items.length, 1);
  const current = items[index % len];

  function goTo(next: number, direction: 1 | -1 = 1) {
    if (!items.length) return;
    const clamped = ((next % items.length) + items.length) % items.length;
    setPrev(index);
    setDir(direction);
    setIndex(clamped);
  }

  useEffect(() => {
    if (!items.length) return;
    timerRef.current = window.setInterval(() => goTo(index + 1, 1), 8000);
    return () => window.clearInterval(timerRef.current);
  }, [items.length, index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="relative h-[88vh] max-h-[760px] min-h-[520px] overflow-hidden bg-[#06070d]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#0d1020] to-[#06070d]" />
        <div className="absolute inset-0 flex items-end">
          <div className="w-full max-w-screen-2xl px-6 py-16 lg:px-16">
            <div className="max-w-lg space-y-5">
              <div className="h-3 w-28 rounded-full bg-white/[0.07]" />
              <div className="h-14 w-4/5 rounded-2xl bg-white/[0.07]" />
              <div className="h-4 w-full rounded-full bg-white/[0.05]" />
              <div className="h-4 w-3/4 rounded-full bg-white/[0.05]" />
              <div className="flex gap-3 pt-2">
                <div className="h-12 w-36 rounded-2xl bg-white/[0.07]" />
                <div className="h-12 w-28 rounded-2xl bg-white/[0.05]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const banner = bannerOf(current);
  const poster = posterOf(current);
  const title = titleOf(current);
  const count = episodeCount(current);
  const id = animeId(current);
  const statusKey = (current.status || "").toLowerCase();
  const statusLabel = STATUS_LABEL[statusKey] || (current.status ? current.status.replace(/_/g, " ") : "");

  return (
    <section className="relative h-[72vh] max-h-[640px] min-h-[420px] overflow-hidden bg-[#06070d]">

      {/* Background image */}
      <div key={`bg-${index}`} className="absolute inset-0 animate-[fadeIn_0.7s_ease]">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-60"
          />
        ) : null}
      </div>

      {/* Translucent overlays — lighter so the image shows through */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#06070d]/90 via-[#06070d]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#06070d]/80 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06070d]/30 to-transparent" style={{ height: "30%" }} />

      {/* Content grid */}
      <div className="relative mx-auto flex h-full max-w-screen-2xl items-center gap-8 px-6 py-16 lg:px-16">

        {/* Left: metadata + CTAs */}
        <div key={`info-${index}`} className="flex-1 max-w-2xl animate-[slideUp_0.6s_cubic-bezier(0.22,1,0.36,1)]">

          {/* Status + meta badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {statusLabel ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                statusKey === "currently_airing"
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
                  : statusKey === "not_yet_aired"
                    ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/25"
                    : "bg-white/[0.07] text-white/50 ring-1 ring-white/10"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  statusKey === "currently_airing" ? "bg-emerald-400 animate-pulse" : "bg-current"
                }`} />
                {statusLabel}
              </span>
            ) : null}
            {current.score ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f0b429]/15 px-3 py-1 text-[11px] font-bold text-[#f0b429] ring-1 ring-[#f0b429]/25">
                <Star size={11} className="fill-[#f0b429]" />
                {Number(current.score).toFixed(2)} rating
              </span>
            ) : null}
            {count > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/50 ring-1 ring-white/10">
                <TvIcon size={11} />
                {count} Episodes
              </span>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="mb-4 text-3xl font-black leading-[1.1] tracking-tight text-white drop-shadow-2xl sm:text-4xl lg:text-5xl">
            {title}
          </h1>

          {/* UX copy / tagline */}
          <p className="mb-8 max-w-md text-base leading-relaxed text-white/50">
            Stream every episode in crystal-clear quality — sub &amp; dub — with adaptive servers, instant subtitle support, and seamless watch history.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/watch/${id}/1`}
              className="shine group inline-flex h-12 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#e8336a] to-[#7c4dff] px-6 text-sm font-bold text-white shadow-xl shadow-[#e8336a]/30 transition hover:opacity-90 hover:shadow-[#e8336a]/50 hover:shadow-2xl"
            >
              <Play size={18} fill="currentColor" />
              Watch Now
            </Link>
            <Link
              href={`/anime/${id}`}
              className="inline-flex h-12 items-center gap-2.5 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-6 text-sm font-bold text-white transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <Info size={16} />
              More Info
            </Link>
          </div>

          {/* Episode progress dots */}
          {items.length > 1 ? (
            <div className="mt-10 flex items-center gap-2">
              {items.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => goTo(i, i > index ? 1 : -1)}
                  className={`rounded-full transition duration-400 ${
                    i === index
                      ? "w-7 h-[5px] bg-gradient-to-r from-[#e8336a] to-[#7c4dff]"
                      : "w-[5px] h-[5px] bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Right: floating poster */}
        {poster ? (
          <div
            key={`poster-${index}`}
            className="hidden lg:block relative w-[240px] xl:w-[280px] shrink-0 animate-[slideUp_0.7s_cubic-bezier(0.22,1,0.36,1)_0.1s_both]"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-3xl shadow-2xl shadow-black/70 ring-1 ring-white/10">
              <Image src={poster} alt={title} fill sizes="280px" priority className="object-cover" />
              {/* Glow */}
              <div className="absolute inset-0 rounded-3xl ring-2 ring-inset ring-white/[0.08]" />
            </div>
            {/* Decorative glow beneath poster */}
            <div className="absolute -bottom-6 left-1/2 h-20 w-3/4 -translate-x-1/2 rounded-full bg-[#e8336a]/20 blur-3xl" />
          </div>
        ) : null}
      </div>

      {/* Prev/Next arrows */}
      {items.length > 1 ? (
        <div className="absolute bottom-8 right-6 flex gap-2 lg:right-16">
          <button
            aria-label="Previous"
            onClick={() => goTo(index - 1, -1)}
            className="glass grid h-10 w-10 place-items-center rounded-xl text-white/60 transition hover:scale-105 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Next"
            onClick={() => goTo(index + 1, 1)}
            className="glass grid h-10 w-10 place-items-center rounded-xl text-white/60 transition hover:scale-105 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : null}

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#06070d] to-transparent" />
    </section>
  );
}

export function MobileHeroBanner({ items = [], loading }: { items?: Anime[]; loading?: boolean }) {
  const [index, setIndex] = useState(0);
  const len = Math.max(items.length, 1);
  const current = items[index % len];

  useEffect(() => {
    if (!items.length) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (loading) {
    return (
      <section className="relative -mt-1 min-h-[420px] overflow-hidden pb-6 sm:hidden">
        <div className="absolute inset-0 animate-pulse bg-[#141828]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/35 to-transparent" />
        <div className="relative flex min-h-[420px] items-end px-4">
          <div className="w-full rounded-[28px] border border-white/[0.1] bg-white/[0.07] p-4 shadow-2xl shadow-black/35 backdrop-blur-2xl">
            <div className="mb-3 h-3 w-24 rounded-full bg-white/[0.12]" />
            <div className="h-8 w-4/5 rounded-xl bg-white/[0.12]" />
            <div className="mt-4 flex gap-2">
              <div className="h-11 flex-1 rounded-2xl bg-white/[0.12]" />
              <div className="h-11 w-24 rounded-2xl bg-white/[0.08]" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!current) return null;

  const id = animeId(current);
  const title = titleOf(current);
  const poster = posterOf(current);
  const banner = bannerOf(current);
  const count = episodeCount(current);

  return (
    <section className="relative -mt-1 min-h-[430px] overflow-hidden pb-4 sm:hidden">
      <div className="absolute inset-0 bg-[#080a12]">
        {banner || poster ? (
          <Image
            key={`${id}-${index}`}
            src={banner || poster}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-85"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/42 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#06070d]/80 to-transparent" />
      </div>

      <div className="relative flex min-h-[430px] items-end px-4">
        <div className="w-[92%] max-w-[360px] rounded-3xl border border-white/[0.1] bg-[#090b13]/28 p-3.5 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#e8336a]/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#ff8db2] ring-1 ring-[#e8336a]/30">
              Featured
            </span>
            {count > 0 ? (
              <span className="rounded-full bg-white/[0.12] px-2.5 py-1 text-[10px] font-bold text-white/70 ring-1 ring-white/15">
                {count} Episodes
              </span>
            ) : null}
          </div>

          <h1 className="line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-xl">
            {title}
          </h1>

          <div className="mt-3 flex gap-2">
            <Link
              href={`/watch/${id}/1`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e8336a] to-[#7c4dff] text-sm font-black text-white shadow-lg shadow-[#e8336a]/25"
            >
              <Play size={16} fill="currentColor" />
              Watch
            </Link>
            <Link
              href={`/anime/${id}`}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/[0.14] bg-white/[0.1] px-3.5 text-sm font-bold text-white/85 backdrop-blur-xl"
            >
              Details
            </Link>
          </div>

          {items.length > 1 ? (
            <div className="mt-3 flex gap-1.5">
              {items.slice(0, 5).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Featured ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-7 bg-[#e8336a]" : "w-1.5 bg-white/25"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
