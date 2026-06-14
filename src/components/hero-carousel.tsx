"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { imageCdnUrl } from "@/lib/image-cdn";
import type { Anime } from "@/lib/types";
import { animeId, animePath, bannerOf, episodeCount, posterOf, titleOf, watchPath } from "@/lib/utils";

const HERO_AUTO_ADVANCE_MS = 6000;
const HERO_INITIAL_AUTO_DELAY_MS = 7000;

export type HeroCrData = Record<string, { detail_banner?: string; title_logo?: string; synopsis?: string; hero_focus?: string }>;

export function HeroCarousel({ items = [], loading, crData = {} }: { items?: Anime[]; loading?: boolean; crData?: HeroCrData }) {
  const [index, setIndex] = useState(0);
  const [flipKey, setFlipKey] = useState(0);
  const timerRef = useRef<number | undefined>(undefined);
  const len = Math.max(items.length, 1);
  const current = items[index % len];

  function goTo(next: number, direction: 1 | -1 = 1) {
    if (!items.length) return;
    const clamped = ((next % items.length) + items.length) % items.length;
    void direction;
    setFlipKey((value) => value + 1);
    setIndex(clamped);
  }

  useEffect(() => {
    if (!items.length) return;
    const firstTimer = window.setTimeout(() => {
      goTo(index + 1, 1);
      timerRef.current = window.setInterval(() => {
        setIndex((value) => (value + 1) % items.length);
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
      <div className="relative h-[560px] overflow-hidden bg-[#050506] md:h-[620px] lg:h-[calc(100vh-64px)] lg:min-h-[620px] lg:max-h-[720px]">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#0e0e10] to-[#050506]" />
        <div className="absolute bottom-0 left-0 right-0 h-[180px] bg-gradient-to-t from-[#050506] to-transparent" />
        <div className="absolute left-6 top-1/2 max-w-[480px] -translate-y-1/2 space-y-5 lg:left-20">
          <div className="h-[100px] w-[320px] rounded-lg bg-white/[0.05]" />
          <div className="h-4 w-64 rounded bg-white/[0.04]" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-white/[0.03]" />
            <div className="h-3 w-4/5 rounded bg-white/[0.03]" />
            <div className="h-3 w-3/5 rounded bg-white/[0.03]" />
          </div>
          <div className="flex gap-3 pt-2">
            <div className="h-[52px] w-[220px] rounded bg-white/[0.05]" />
            <div className="h-[52px] w-[52px] rounded bg-white/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const title = titleOf(current);
  const count = episodeCount(current);
  const id = animeId(current);
  const malId = String(current.mal_id || current.anime_id || current.id || "");
  const cr = crData[malId];
  const heroSrc = imageCdnUrl(cr?.detail_banner || bannerOf(current, "banner-lg"), "banner-lg");
  const titleLogo = imageCdnUrl(cr?.title_logo || "", "thumb");
  const synopsis = cr?.synopsis || current.overview || "";
  const genres = current.genres?.slice(0, 4) ?? [];
  const score = current.score ? Number(current.score).toFixed(1) : "";

  return (
    <section className="relative h-[clamp(420px,56vw,680px)] w-full overflow-hidden bg-black">

      {/* Key art. Our backdrop_wide is ~2.52:1; in this 16:9 hero object-cover crops the
          SIDES, so object-position right shows the cast — exactly how Crunchyroll frames it. */}
      <div
        key={`bg-${index}`}
        className={`absolute inset-0 ${flipKey > 0 ? "animate-[heroBackdropTurn_0.82s_cubic-bezier(0.2,0.8,0.18,1)]" : ""}`}
      >
        {heroSrc ? (
          <Image
            src={heroSrc}
            alt=""
            fill
            loading="eager"
            unoptimized
            fetchPriority={index === 0 ? "high" : "auto"}
            sizes="(max-width: 639px) 1px, 100vw"
            className="object-cover motion-safe:will-change-transform"
            style={{ objectPosition: "10% center" }}
          />
        ) : null}
      </div>

      {/* Hero scrim. Stronger + wider on the left so the text column is always on a
          dark base — some Crunchyroll keyarts have the SERIES TITLE baked into the
          art, and a weak scrim let that bleed through behind our own title/synopsis
          (the faint duplicate-title glitch). Two left stops + an earlier bottom fade
          keep the content readable regardless of the underlying keyart. */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 72%, #000 100%), linear-gradient(90deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.8) 26%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0) 64%)",
        }}
      />

      {/* Content — vertically centered left column, Crunchyroll style */}
      <div
        key={`info-${index}`}
        className="absolute left-6 top-[41%] z-10 max-w-[460px] -translate-y-1/2 animate-[slideUp_0.5s_cubic-bezier(0.22,1,0.36,1)] sm:left-10 lg:left-16 lg:max-w-[480px]"
      >
        {/* Title logo or text — hard-clamped so it never dominates */}
        {titleLogo ? (
          <img
            src={titleLogo}
            alt={`${title} logo`}
            loading="eager"
            className="mb-5 block w-auto object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
            style={{ maxWidth: "min(360px, 28vw)", maxHeight: "104px" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }}
          />
        ) : null}
        <h1 className={`mb-4 text-[1.8rem] font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] sm:text-[2.2rem] lg:text-[2.8rem] ${titleLogo ? "hidden" : ""}`}>
          {title}
        </h1>

        {/* Metadata row — CR style: genres · score · episodes */}
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-white/60 lg:text-[14px]">
          {score ? (
            <span className="flex items-center gap-1 text-[#d8b56a]">
              <Star size={12} className="fill-[#d8b56a]" />
              {score}
            </span>
          ) : null}
          {score && genres.length > 0 ? <span className="text-white/30">·</span> : null}
          {genres.map((g, i) => (
            <span key={g}>
              {i > 0 ? <span className="mr-2 text-white/30">·</span> : null}
              {g}
            </span>
          ))}
          {count > 0 && (genres.length > 0 || score) ? <span className="text-white/30">·</span> : null}
          {count > 0 ? <span>{count} Episodes</span> : null}
        </div>

        {/* Synopsis — 3 lines, editorial feel */}
        {synopsis ? (
          <p className="mb-8 line-clamp-3 max-w-[480px] text-[14px] leading-[1.55] text-white/75 lg:text-[16px] lg:leading-[1.5]">
            {synopsis}
          </p>
        ) : <div className="mb-8" />}

        {/* Buttons — filled primary + unified square icon button system */}
        <div className="flex items-center gap-3">
          <Link
            href={watchPath(current, id, 1)}
            className="inline-flex h-[52px] items-center gap-3 rounded-[2px] bg-[#c4182a] px-7 text-[15px] font-extrabold uppercase tracking-[0.02em] text-white transition-all duration-200 hover:bg-[#d8273a] active:translate-y-px lg:h-[56px]"
          >
            <Play size={17} fill="currentColor" />
            Start Watching E1
          </Link>
          <Link
            href={animePath(current, id)}
            aria-label="Add to watchlist"
            className="grid h-[52px] w-[52px] place-items-center rounded-[2px] border border-white/[0.22] bg-white/[0.04] text-white/70 transition-all duration-200 hover:border-white/40 hover:bg-white/[0.08] hover:text-white lg:h-[56px] lg:w-[56px]"
          >
            <Bookmark size={20} />
          </Link>
        </div>

        {/* Pill dots */}
        {items.length > 1 ? (
          <div className="mt-10 flex items-center gap-2 lg:mt-12">
            {items.slice(0, 8).map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => goTo(i, i > index ? 1 : -1)}
                className={`h-[7px] rounded-full transition-all duration-300 lg:h-[8px] ${
                  i === index
                    ? "w-[40px] bg-[#c4182a] lg:w-[48px]"
                    : "w-[18px] bg-white/30 hover:bg-white/50 lg:w-[22px]"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Prev/Next arrows — plain chevrons, no border */}
      {items.length > 1 ? (
        <>
          <button
            aria-label="Previous"
            onClick={() => goTo(index - 1, -1)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 p-2 text-white/50 transition-all duration-200 hover:text-white lg:left-5"
          >
            <ChevronLeft size={30} strokeWidth={2.5} />
          </button>
          <button
            aria-label="Next"
            onClick={() => goTo(index + 1, 1)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 p-2 text-white/50 transition-all duration-200 hover:text-white lg:right-5"
          >
            <ChevronRight size={30} strokeWidth={2.5} />
          </button>
        </>
      ) : null}
    </section>
  );
}

export function MobileHeroBanner({ items = [], loading, crData = {} }: { items?: Anime[]; loading?: boolean; crData?: HeroCrData }) {
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
      <section ref={sectionRef} className="relative min-h-[520px] overflow-hidden sm:hidden">
        <div className="absolute inset-0 animate-pulse bg-[#0e0e10]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/35 to-transparent" />
        <div className="absolute inset-x-4 bottom-6">
          <div className="h-[90px] w-[60%] rounded-md bg-white/[0.08]" />
          <div className="mt-4 h-3 w-2/3 rounded-full bg-white/[0.07]" />
          <div className="mt-4 flex gap-2.5">
            <div className="h-12 flex-1 rounded bg-white/[0.1]" />
            <div className="h-12 w-12 rounded bg-white/[0.07]" />
          </div>
        </div>
      </section>
    );
  }

  if (!current) return null;

  const id = animeId(current);
  const title = titleOf(current);
  const malId = String(current.mal_id || current.anime_id || current.id || "");
  const cr = crData[malId];
  const poster = posterOf(current, "poster-md");
  const banner = bannerOf(current, "banner-sm");
  const bgSrc = cr?.detail_banner || banner || poster;
  const titleLogo = cr?.title_logo || "";
  const count = episodeCount(current);
  const genres = current.genres?.slice(0, 3) ?? [];

  return (
    <section ref={sectionRef} className="relative min-h-[520px] overflow-hidden bg-[#050506] sm:hidden">
      {/* Full-bleed keyart — character framed to the right, like Crunchyroll mobile */}
      <div className="absolute inset-0">
        {bgSrc ? (
          <Image
            key={`${id}-${index}`}
            src={bgSrc}
            alt=""
            fill
            priority={index === 0}
            unoptimized
            fetchPriority={index === 0 ? "high" : "auto"}
            loading={index === 0 ? undefined : "lazy"}
            sizes="100vw"
            className="animate-[fadeIn_0.4s_ease] object-cover object-[62%_center]"
          />
        ) : null}
        {/* Bottom-heavy gradient so the title/CTA stays readable */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(5,5,6,0.12) 0%, rgba(5,5,6,0.05) 32%, rgba(5,5,6,0.78) 78%, #050506 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,5,6,0.55) 0%, rgba(5,5,6,0.08) 55%, rgba(5,5,6,0) 100%)" }} />
      </div>

      {/* Bottom-left content — lifted above the bottom nav for breathing room */}
      <div className="absolute inset-x-5 bottom-24 z-10">
        {titleLogo ? (
          <img
            src={titleLogo}
            alt={`${title} logo`}
            loading="eager"
            className="mb-3 max-h-[78px] w-auto max-w-[52vw] object-contain object-left drop-shadow-[0_3px_18px_rgba(0,0,0,0.7)]"
            style={{ width: "min(52vw, 200px)" }}
          />
        ) : (
          <h1 className="mb-3 line-clamp-2 text-[26px] font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {title}
          </h1>
        )}

        {/* Short metadata — one line */}
        <div className="mb-3.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] font-medium text-white/70">
          <span>Sub | Dub</span>
          {count > 0 ? <><span className="text-white/35">·</span><span>{count} Ep</span></> : null}
          {genres.length ? <><span className="text-white/35">·</span><span className="truncate text-white/55">{genres.join(", ")}</span></> : null}
        </div>

        {/* Primary CTA + watchlist icon */}
        <div className="flex items-center gap-2.5">
          <Link
            href={watchPath(current, id, 1)}
            className="inline-flex h-[44px] flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#c4182a] text-[13px] font-extrabold uppercase tracking-[0.02em] text-white"
          >
            <Play size={15} fill="currentColor" />
            Start Watching
          </Link>
          <Link
            href={animePath(current, id)}
            aria-label={`View details for ${title}`}
            className="grid h-[44px] w-[44px] place-items-center rounded-[2px] border border-white/[0.22] bg-white/[0.04] text-white/75"
          >
            <Bookmark size={18} />
          </Link>
        </div>

        {/* Dots */}
        {items.length > 1 ? (
          <div className="mt-4 flex gap-1.5">
            {items.slice(0, 6).map((_, i) => (
              <button
                key={i}
                aria-label={`Hero slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className="grid h-5 place-items-center"
              >
                <span className={`h-[6px] rounded-full transition-all ${i === index ? "w-7 bg-[#c4182a]" : "w-[6px] bg-white/40"}`} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
