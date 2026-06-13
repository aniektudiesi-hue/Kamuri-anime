"use client";

import Image from "next/image";

/**
 * The single, shared full-screen buffering visual (brand logo + spinner ring +
 * pulse bars). Used by both the global route buffer (BootLoader) and the anime
 * detail page splash so the loading state is IDENTICAL and seamless from the
 * moment a card is pressed until the banner + episode list are ready.
 */
export function BufferingScreen({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      className={`atv-boot-loader ${exiting ? "is-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading animeTVplus"
    >
      <div className="atv-boot-mark">
        <Image src="/logo-icon.png" alt="" width={72} height={72} priority className="h-14 w-14 object-contain" />
        <span className="atv-boot-ring" />
      </div>
      <div className="atv-boot-bars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
