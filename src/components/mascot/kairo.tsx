"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Kairo — the AnimeTVPlus brand mascot/guide.
 *
 * Drop transparent PNG stickers into /public/kairo/ with these exact names:
 *   welcome.png   excited.png   searching.png   notfound.png
 *   offline.png   sleepy.png    support.png     empty.png
 *
 * Until a sticker exists, Kairo renders a branded red A-mark fallback so the UI
 * never shows a broken image. Theme: red / black / white only (no orange).
 */
export type KairoMood =
  | "welcome"
  | "excited"
  | "searching"
  | "notfound"
  | "offline"
  | "sleepy"
  | "support"
  | "empty";

const SRC: Record<KairoMood, string> = {
  welcome: "/kairo/welcome.png",
  excited: "/kairo/excited.png",
  searching: "/kairo/searching.png",
  notfound: "/kairo/notfound.png",
  offline: "/kairo/offline.png",
  sleepy: "/kairo/sleepy.png",
  support: "/kairo/support.png",
  empty: "/kairo/empty.png",
};

export function Kairo({
  mood,
  size = 120,
  className = "",
  priority = false,
}: {
  mood: KairoMood;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <KairoFallback size={size} className={className} />;
  return (
    // Plain <img> (not next/image) so a missing sticker degrades to the fallback
    // instead of throwing in the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[mood]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={`select-none object-contain ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Branded placeholder shown until the real Kairo sticker PNG is added. */
function KairoFallback({ size, className }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-[#0c0c0e] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 64 64" fill="none">
        <path d="M32 11 L53 53 L11 53 Z" fill="#d11226" />
        <path d="M21 51 L31 31 L35 35.5 L26 51 Z" fill="#fff" />
      </svg>
    </span>
  );
}

/**
 * KairoState — a full empty/error/loading panel: sticker + heading + subtext +
 * optional CTA. Use for no-results, offline, server-waking, empty watchlist, etc.
 */
export function KairoState({
  mood,
  title,
  subtitle,
  action,
  size = 150,
  className = "",
}: {
  mood: KairoMood;
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-4 py-14 text-center ${className}`}>
      <Kairo mood={mood} size={size} priority />
      <div>
        <p className="text-[17px] font-bold text-white">{title}</p>
        {subtitle ? <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/45">{subtitle}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="mt-1 rounded-[3px] bg-[#c4182a] px-5 py-2.5 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#d8273a]"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Inline guide line: small Kairo + a message. For loaders/help strips. */
export function KairoLine({
  mood,
  children,
  className = "",
}: {
  mood: KairoMood;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Kairo mood={mood} size={40} />
      <span className="text-sm font-medium text-white/70">{children}</span>
    </div>
  );
}
