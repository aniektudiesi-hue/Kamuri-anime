"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Star, TvIcon, Info } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { Anime } from "@/lib/types";
import { animeId, animePath, bannerOf, episodeCount, posterOf, titleOf, watchPath } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  currently_airing: "Airing Now",
  finished_airing: "Completed",
  not_yet_aired: "Upcoming",
};

const HERO_AUTO_ADVANCE_MS = 3000;
const HERO_INITIAL_AUTO_DELAY_MS = 7000;

export function HeroCarousel({ items = [], loading }: { items?: Anime[]; loading?: boolean }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [flipKey, setFlipKey] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const len = Math.max(items.length, 1);
  const current = items[index % len];

  function goTo(next: number, direction: 1 | -1 = 1) {
    if (!items.length) return;
    const clamped = ((next % items.length) + items.length) % items.length;
    setDir(direction);
    setFlipKey((value) => value + 1);
    setIndex(clamped);
  }

  useEffect(() => {
    if (!items.length) return;
    const firstTimer = window.setTimeout(() => {
      goTo(index + 1, 1);
      timerRef.current = window.setInterval(() => {
        setIndex((value) => (value + 1) % items.length);
        setDir(1);
        setFlipKey((value) => value + 1);
      }, HERO_AUTO_ADVANCE_MS);
    }, HERO_INITIAL_AUTO_DELAY_MS);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(timerRef.current);
    };
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const banner = bannerOf(current, "banner-lg");
  const poster = posterOf(current, "poster-lg");
  const title = titleOf(current);
  const count = episodeCount(current);
  const id = animeId(current);
  const statusKey = (current.status || "").toLowerCase();
  const statusLabel = STATUS_LABEL[statusKey] || (current.status ? current.status.replace(/_/g, " ") : "");

  return (
    <section className="relative h-[76vh] max-h-[700px] min-h-[460px] overflow-hidden bg-[#05060b]">

      {/* Background image */}
      <div key={`bg-${index}`} className="absolute inset-0 animate-[heroBackdropTurn_0.82s_cubic-bezier(0.2,0.8,0.18,1)]">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={100}
            sizes="100vw"
            className="object-cover object-center opacity-72 motion-safe:will-change-transform"
          />
        ) : null}
      </div>

      {/* Translucent overlays — lighter so the image shows through */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05060b]/96 via-[#05060b]/58 to-[#05060b]/12" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05060b]/90 via-[#05060b]/10 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#05060b]/46 to-transparent" style={{ height: "34%" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,rgba(207,36,66,0.14),transparent_34%)]" />

      {/* Content grid */}
      <div className="relative mx-auto flex h-full max-w-screen-2xl items-center gap-8 px-6 py-16 lg:px-16">

        {/* Left: metadata + CTAs */}
        <div key={`info-${index}`} className="flex-1 max-w-3xl animate-[slideUp_0.6s_cubic-bezier(0.22,1,0.36,1)]">

          {/* Status + meta badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {statusLabel ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                statusKey === "currently_airing"
                  ? "bg-[#cf2442]/18 text-[#ffd7dd] ring-1 ring-[#cf2442]/30"
                  : statusKey === "not_yet_aired"
                    ? "bg-[#c8ced8]/12 text-[#dce2ea] ring-1 ring-[#c8ced8]/18"
                    : "bg-white/[0.07] text-white/50 ring-1 ring-white/10"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  statusKey === "currently_airing" ? "bg-[#cf2442] animate-pulse" : "bg-current"
                }`} />
                {statusLabel}
              </span>
            ) : null}
            {current.score ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d8b56a]/15 px-3 py-1 text-[11px] font-bold text-[#d8b56a] ring-1 ring-[#d8b56a]/25">
                <Star size={11} className="fill-[#d8b56a]" />
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
          <h1 className="mb-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">
            {title}
          </h1>

          {/* CTA buttons */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={watchPath(current, id, 1)}
              className="shine group inline-flex h-[52px] items-center gap-2.5 rounded-full bg-[#cf2442] px-7 text-sm font-black text-white shadow-xl shadow-[#cf2442]/28 transition hover:bg-[#dc2d4b] hover:shadow-[#cf2442]/36 hover:shadow-2xl"
            >
              <Play size={18} fill="currentColor" />
              Watch Now
            </Link>
            <Link
              href={animePath(current, id)}
              aria-label={`More details about ${title}`}
              className="inline-flex h-[52px] items-center gap-2.5 rounded-full border border-white/[0.12] bg-white/[0.06] px-7 text-sm font-black text-white backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
            >
              <Info size={16} />
              More About {title.length > 22 ? `${title.slice(0, 22)}...` : title}
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
                      ? "w-8 h-[5px] bg-[#cf2442] shadow-[0_0_18px_rgba(207,36,66,0.45)]"
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
            key={`poster-${index}-${flipKey}`}
            className="hero-book-stage hidden lg:block relative w-[250px] xl:w-[306px] shrink-0"
          >
            <div className="hero-book-page hero-book-page-a" />
            <div className="hero-book-page hero-book-page-b" />
            <div
              className="hero-book-card relative aspect-[2/3] w-full overflow-hidden rounded-[34px] shadow-[0_34px_110px_rgba(0,0,0,0.72)] ring-1 ring-white/12"
              style={{ "--book-start": dir === 1 ? "-34deg" : "34deg", "--book-shift": dir === 1 ? "-28px" : "28px" } as CSSProperties}
            >
              <Image src={poster} alt={title} fill sizes="280px" priority quality={90} className="object-cover" />
              {/* Glow */}
              <div className="absolute inset-0 rounded-3xl ring-2 ring-inset ring-white/[0.08]" />
              <div className="hero-book-sheen" />
            </div>
            <div className="absolute -bottom-6 left-1/2 h-px w-3/4 -translate-x-1/2 bg-white/20 blur-sm" />
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#05060b] to-transparent" />
    </section>
  );
}

export function MobileHeroBanner({ items = [], loading }: { items?: Anime[]; loading?: boolean }) {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const len = Math.max(items.length, 1);
  const current = items[index % len];

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!items.length || !isVisible || document.hidden) return;
    const firstTimer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % items.length);
      const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), HERO_AUTO_ADVANCE_MS);
      timerRef.current = timer;
    }, HERO_INITIAL_AUTO_DELAY_MS);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(timerRef.current);
    };
  }, [items.length, isVisible]);

  if (loading) {
    return (
      <section ref={sectionRef} className="relative -mt-1 min-h-[360px] overflow-hidden pb-4 sm:hidden">
        <div className="absolute inset-0 animate-pulse bg-[#141828]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/35 to-transparent" />
        <div className="relative flex min-h-[360px] items-end px-4">
          <div className="w-full rounded-2xl border border-white/[0.1] bg-black/30 p-3.5 shadow-2xl shadow-black/35 backdrop-blur-2xl">
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
  const poster = posterOf(current, "poster-md");
  const banner = bannerOf(current, "banner-sm");
  const count = episodeCount(current);

  return (
    <section ref={sectionRef} className="relative -mt-1 min-h-[365px] overflow-hidden pb-3 sm:hidden">
      <div className="absolute inset-0 bg-[#080a12]">
        {banner || poster ? (
          <Image
            key={`${id}-${index}`}
            src={banner || poster}
            alt=""
            fill
            priority={index === 0}
            fetchPriority={index === 0 ? "high" : "auto"}
            loading={index === 0 ? undefined : "lazy"}
            quality={96}
            sizes="100vw"
            className="object-cover opacity-85"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06070d] via-[#06070d]/42 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#06070d]/80 to-transparent" />
      </div>

      <div className="relative flex min-h-[365px] items-end px-4">
        <div className="w-[92%] max-w-[350px] rounded-2xl border border-white/[0.1] bg-[#090b13]/24 p-3 shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#cf2442]/24 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#f2c6cd] ring-1 ring-[#cf2442]/30">
              Featured
            </span>
            {count > 0 ? (
              <span className="rounded-full bg-white/[0.12] px-2.5 py-1 text-[10px] font-bold text-white/70 ring-1 ring-white/15">
                {count} Episodes
              </span>
            ) : null}
          </div>

          <h1 className="line-clamp-2 text-lg font-black leading-tight text-white drop-shadow-xl">
            {title}
          </h1>

          <div className="mt-3 flex gap-2">
            <Link
              href={watchPath(current, id, 1)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#cf2442] text-sm font-black text-white shadow-lg shadow-[#cf2442]/22"
            >
              <Play size={16} fill="currentColor" />
              Watch
            </Link>
            <Link
              href={animePath(current, id)}
              aria-label={`View details for ${title}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.1] px-3.5 text-sm font-bold text-white/85 backdrop-blur-xl"
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
                    i === index ? "w-7 bg-[#cf2442]" : "w-1.5 bg-white/25"
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
