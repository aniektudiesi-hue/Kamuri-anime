"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const VISIT_COUNT_KEY = "animetvplus_visit_count";
const REGISTER_AFTER_VISITS = 4;

const OPEN_PATHS = [
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/dmca",
  "/licensing",
  "/admin",
  "/8527330761",
];

export function VisitGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn || OPEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return;
    }

    const current = Number.parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10);
    const next = Number.isFinite(current) ? current + 1 : 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(next));

    if (next > REGISTER_AFTER_VISITS) {
      const returnTo = `${pathname}${window.location.search}`;
      router.replace(`/register?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [isLoggedIn, pathname, router]);

  return null;
}
