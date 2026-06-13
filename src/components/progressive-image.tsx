"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Props = {
  /** Deprecated — low-res blur layer removed for speed. Kept for caller compatibility. */
  lowSrc?: string;
  /** Full-quality URL. */
  highSrc: string;
  /** Optional backup URL used if highSrc fails. */
  fallbackSrc?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  className?: string;
  /** Extra classes for the <img> (e.g. group-hover scale). */
  imgClassName?: string;
  onFail?: () => void;
  onLoad?: () => void;
};

/**
 * Image loader — renders the full-res image directly with the browser's native
 * progressive decode. We intentionally do NOT load a separate low-res blur
 * preview (that doubled network requests and made loads feel slow) and we do NOT
 * gate visibility behind an onLoad opacity fade. On the pure-black theme an
 * un-painted image area is just black, then the picture pops in as it decodes.
 */
export function ProgressiveImage({
  highSrc,
  fallbackSrc,
  alt,
  sizes,
  priority = false,
  loading,
  className = "",
  imgClassName = "",
  onFail,
  onLoad,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(highSrc);

  useEffect(() => {
    setLoaded(false);
    setCurrentSrc(highSrc);
  }, [highSrc]);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#111217] ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-[linear-gradient(110deg,#111217_0%,#191b23_42%,#111217_78%)] bg-[length:220%_100%] transition-opacity duration-200 ${loaded ? "opacity-0" : "animate-[shimmer_1.15s_ease-in-out_infinite] opacity-100"}`}
      />
      <Image
        src={currentSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        loading={loading ?? (priority ? "eager" : "lazy")}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setLoaded(false);
            setCurrentSrc(fallbackSrc);
            return;
          }
          setLoaded(true);
          onFail?.();
        }}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className={`object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
      />
    </div>
  );
}
