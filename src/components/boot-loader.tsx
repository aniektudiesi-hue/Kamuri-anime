"use client";

import { useEffect, useState } from "react";
import { BufferingScreen } from "@/components/buffering-screen";

export function BootLoader() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const handleStart = () => {
      document.documentElement.classList.add("atv-boot-lock");
      document.body.classList.add("atv-boot-lock");
      setExiting(false);
      setVisible(true);
    };

    window.addEventListener("atv:route-buffer-start", handleStart);
    return () => window.removeEventListener("atv:route-buffer-start", handleStart);
  }, []);

  if (!visible) return null;
  return <BufferingScreen exiting={exiting} />;
}
