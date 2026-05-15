"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const GUEST_STARTED_AT_KEY = "animetvplus_guest_started_at";
const REGISTER_AFTER_MS = 2 * 60 * 1000;

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

    const now = Date.now();
    const stored = Number.parseInt(localStorage.getItem(GUEST_STARTED_AT_KEY) || "0", 10);
    const startedAt = Number.isFinite(stored) && stored > 0 ? stored : now;
    if (!stored) localStorage.setItem(GUEST_STARTED_AT_KEY, String(startedAt));

    const redirectToRegister = () => {
      const returnTo = `${pathname}${window.location.search}`;
      router.replace(`/register?returnTo=${encodeURIComponent(returnTo)}`);
    };

    const remaining = REGISTER_AFTER_MS - (now - startedAt);
    if (remaining <= 0) {
      redirectToRegister();
      return;
    }

    const timer = window.setTimeout(redirectToRegister, remaining);
    return () => window.clearTimeout(timer);
  }, [isLoggedIn, pathname, router]);

  return null;
}
