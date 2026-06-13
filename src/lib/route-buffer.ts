"use client";

export function startRouteBuffer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("atv:route-buffer-start"));
}
