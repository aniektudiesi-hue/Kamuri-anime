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
 * decode. No separate low-res blur preview (that doubled requests). The image is
 * held at opacity-0 until it has FULLY decoded (onLoad), then fades in over the
 * shimmer placeholder — so the user never sees a half-streamed image painting
 * top-to-bottom (the "adhuri image / kat-kat ke load" artifact on slow PNGs).
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
  // The shimmer is held back ~180ms so cached / prewarmed images (which decode
  // almost instantly) NEVER flash a "loading" state — search should feel like
  // nothing loaded at all. Only a genuinely slow image reveals the shimmer.
  const [showShimmer, setShowShimmer] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setShowShimmer(false);
    setCurrentSrc(highSrc);
    const timer = window.setTimeout(() => setShowShimmer(true), 180);
    return () => window.clearTimeout(timer);
  }, [highSrc]);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#111217] ${className}`}>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,#111217_0%,#191b23_42%,#111217_78%)] bg-[length:220%_100%] transition-opacity duration-150 ${loaded || !showShimmer ? "opacity-0" : "animate-[shimmer_1.15s_ease-in-out_infinite] opacity-25"}`}
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
        className={`object-cover transition-opacity duration-300 ease-out ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
      />
    </div>
  );
}
