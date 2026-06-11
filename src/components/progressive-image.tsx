"use client";

import Image from "next/image";

type Props = {
  /** Deprecated — low-res blur layer removed for speed. Kept for caller compatibility. */
  lowSrc?: string;
  /** Full-quality URL. */
  highSrc: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Extra classes for the <img> (e.g. group-hover scale). */
  imgClassName?: string;
  onFail?: () => void;
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
  alt,
  sizes,
  priority = false,
  className = "",
  imgClassName = "",
  onFail,
}: Props) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <Image
        src={highSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        onError={() => onFail?.()}
        className={`object-cover ${imgClassName}`}
      />
    </div>
  );
}
