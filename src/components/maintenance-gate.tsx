"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Kairo } from "@/components/mascot/kairo";

const MAINTENANCE_ON = true;
const MAINTENANCE_END = new Date("2026-06-15T13:45:00+05:30").getTime();

function useCountdown(target: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, done: remaining <= 0 };
}

export function MaintenanceGate() {
  if (!MAINTENANCE_ON) return null;

  const { h, m, s, done } = useCountdown(MAINTENANCE_END);

  if (done) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black px-6 text-center">
      <Image src="/logo-full.png" alt="animeTVplus" width={1495} height={402} priority className="h-10 w-auto object-contain" />
      <Kairo mood="sleepy" size={180} priority className="mt-8" />
      <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
        We&apos;re finalizing things
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/55">
        animeTV<span className="text-[#c4182a]">plus</span> is getting a major upgrade. Kairo&apos;s putting the finishing touches — we&apos;ll be back shortly.
      </p>

      <div className="mt-8 flex gap-4">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black tabular-nums text-white">{String(h).padStart(2, "0")}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Hours</span>
        </div>
        <span className="mt-1 text-3xl font-black text-white/20">:</span>
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black tabular-nums text-white">{String(m).padStart(2, "0")}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Minutes</span>
        </div>
        <span className="mt-1 text-3xl font-black text-white/20">:</span>
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black tabular-nums text-white">{String(s).padStart(2, "0")}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Seconds</span>
        </div>
      </div>

      <div className="mt-7 h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#c4182a]" />
      </div>
    </div>
  );
}
