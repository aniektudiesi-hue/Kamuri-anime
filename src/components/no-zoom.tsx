"use client";

import { useEffect } from "react";

// Hard-enforce "no zoom" everywhere the viewport meta can't:
//  - iOS Safari ignores user-scalable=no, so we kill its pinch gesture events.
//  - Multi-touch pinch on other engines.
//  - Desktop Ctrl/⌘ + wheel and Ctrl/⌘ + (+/-/0) keyboard zoom.
export function NoZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
    };

    // iOS Safari pinch
    document.addEventListener("gesturestart", stop as EventListener);
    document.addEventListener("gesturechange", stop as EventListener);
    document.addEventListener("gestureend", stop as EventListener);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("gesturestart", stop as EventListener);
      document.removeEventListener("gesturechange", stop as EventListener);
      document.removeEventListener("gestureend", stop as EventListener);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
