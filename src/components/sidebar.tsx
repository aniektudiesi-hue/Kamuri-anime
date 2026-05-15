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

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden w-[280px] shrink-0 lg:block">
          <div className="sticky top-[80px]">
            {showSidebar ? <SidebarContent /> : <SidebarSkeleton />}
          </div>
        </div>
      </div>
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
