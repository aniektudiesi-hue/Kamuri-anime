"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MobileBottomNav = dynamic(
  () => import("@/components/mobile-bottom-nav").then((module) => module.MobileBottomNav),
  { ssr: false },
);

export function MobileBottomNavGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setEnabled(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return enabled ? <MobileBottomNav /> : null;
}
