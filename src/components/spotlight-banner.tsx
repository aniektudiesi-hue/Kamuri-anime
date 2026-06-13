"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchCrCard } from "@/lib/catalog-api";
import { imageCdnUrl } from "@/lib/image-cdn";

/**
 * SpotlightBanner — a wide Crunchyroll-style promo strip for a single title,
 * dropped between the home rows. Pulls the CR keyart + title logo + synopsis by
 * mal id. Red theme. Contained (rounded) so it reads as a feature, not the hero.
 */
export function SpotlightBanner({
  malId,
  label,
  fallbackTitle,
}: {
  malId: string;
  label?: string;
  fallbackTitle?: string;
}) {
  const { data } = useQuery({
    queryKey: ["spotlight", malId],
    queryFn: () => fetchCrCard(malId),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
  });

  const banner = imageCdnUrl(data?.detail_banner, "banner-sm");
  const logo = data?.title_logo;
  const synopsis = data?.synopsis || "";
  const title = fallbackTitle || "";
  if (!banner) return null; // nothing to show until CR art resolves (no layout box)

  return (
    <section className="my-7">
      <Link
        href={`/anime/${malId}`}
        className="group relative block h-[260px] overflow-hidden rounded-2xl bg-black sm:h-[320px] lg:h-[360px]"
      >
        {/* keyart */}
        <Image
          src={banner}
          alt={title}
          fill
          sizes="100vw"
          loading="lazy"
          decoding="async"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          style={{ objectPosition: "82% center" }}
        />
        {/* CR-style scrims: left for text + bottom blend */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 26%, rgba(0,0,0,0.15) 48%, rgba(0,0,0,0) 66%), linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        <div className="absolute inset-y-0 left-0 flex max-w-[460px] flex-col justify-center px-6 sm:px-10 lg:px-12">
          {label ? (
            <span className="mb-3 inline-flex w-fit items-center rounded-full bg-[#c4182a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
              {label}
            </span>
          ) : null}

          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={title}
              loading="lazy"
              className="mb-3 max-h-[88px] w-auto max-w-[260px] object-contain object-left drop-shadow-[0_3px_18px_rgba(0,0,0,0.7)]"
            />
          ) : (
            <h3 className="mb-3 text-2xl font-black tracking-tight text-white drop-shadow-lg sm:text-3xl">{title}</h3>
          )}

          {synopsis ? (
            <p className="mb-4 line-clamp-2 max-w-[400px] text-[13px] leading-[1.5] text-white/70 sm:text-sm">{synopsis}</p>
          ) : null}

          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-[#c4182a] px-5 text-[13px] font-extrabold uppercase tracking-[0.02em] text-white transition-colors duration-200 group-hover:bg-[#d8273a]">
              <Play size={15} fill="currentColor" />
              Start Watching
            </span>
            <span className="grid h-11 w-11 place-items-center rounded-[3px] border border-white/[0.22] bg-white/[0.04] text-white/75 transition-colors duration-200 group-hover:border-white/40 group-hover:text-white">
              <Bookmark size={18} />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
