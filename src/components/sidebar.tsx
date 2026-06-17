"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SidebarContent = dynamic(
  () => import("@/components/sidebar-content").then((module) => module.SidebarContent),
  {
    ssr: false,
    loading: () => <SidebarSkeleton />,
  },
);

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const showSidebar = useDesktopSidebar();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
      {/* Content now spans the FULL width — the rail (Playback Settings, Browse
          Genres, Top Anime…) is no longer a permanent column that eats space. */}
      <div className="min-w-0">{children}</div>

      {showSidebar ? (
        <>
          {/* Edge-reveal trigger: a thin hover strip pinned to the right edge.
              Move the mouse into the corner/edge and the rail slides in. */}
          <div
            className="fixed right-0 top-0 z-40 hidden h-full w-3 lg:block"
            onMouseEnter={() => setOpen(true)}
            aria-hidden="true"
          />
          {/* Subtle handle so the hidden rail is discoverable (fades out when open). */}
          <div
            className={`pointer-events-none fixed right-0 top-1/2 z-40 hidden h-16 w-1 -translate-y-1/2 rounded-l bg-white/15 transition-opacity duration-300 lg:block ${open ? "opacity-0" : "opacity-100"}`}
            aria-hidden="true"
          />
          {/* Sliding overlay rail — only mounts its content while open. */}
          <div
            className={`fixed right-0 top-[64px] z-40 hidden h-[calc(100dvh-64px)] w-[296px] transform border-l border-white/[0.06] bg-[#070708] shadow-[-24px_0_60px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out lg:block ${open ? "translate-x-0" : "translate-x-full"}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="no-scrollbar h-full overflow-y-auto overscroll-contain p-3">
              {open ? <SidebarContent /> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SidebarSkeleton() {
  return <div className="h-[1860px] rounded-2xl border border-white/[0.05] bg-[#0d1020]/35" />;
}

function useDesktopSidebar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setShow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return show;
}
