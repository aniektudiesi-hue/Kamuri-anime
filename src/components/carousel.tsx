"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Crunchyroll-style horizontal carousel: edge fade masks + hover-reveal arrows
 * that page-scroll ~90% of the viewport, shown only when scrollable that way.
 * Wraps any set of cards passed as children.
 */
export function Carousel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    recompute();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", recompute); ro.disconnect(); };
  }, [recompute]);

  const page = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.9), behavior: "smooth" });
  }, []);

  return (
    <div className="group/carousel relative">
      <div className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#05060a] to-transparent transition-opacity duration-300 ${edges.left ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#05060a] to-transparent transition-opacity duration-300 ${edges.right ? "opacity-100" : "opacity-0"}`} />

      <Arrow side="left"  show={edges.left}  onClick={() => page(-1)} />
      <Arrow side="right" show={edges.right} onClick={() => page(1)} />

      <div ref={ref} className={`no-scrollbar scroll-strip flex overflow-x-auto ${className}`}>
        {children}
      </div>
    </div>
  );
}

function Arrow({ side, show, onClick }: { side: "left" | "right"; show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      className={`absolute top-0 z-20 hidden h-full w-12 place-items-center text-white opacity-0 transition-opacity duration-200 group-hover/carousel:opacity-100 md:grid
        ${side === "left" ? "left-0 bg-gradient-to-r from-black/55 to-transparent" : "right-0 bg-gradient-to-l from-black/55 to-transparent"}
        ${show ? "" : "pointer-events-none !opacity-0"}`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-black/70 ring-1 ring-white/15 backdrop-blur-sm transition hover:scale-110 hover:bg-[#e11d2a] hover:ring-[#e11d2a]">
        {side === "left" ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
      </span>
    </button>
  );
}
