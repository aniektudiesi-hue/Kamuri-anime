"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Kairo } from "@/components/mascot/kairo";

const MAINTENANCE_ON = false;
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

type SurveyChoice = "close" | "ads";

function SurveyPopup() {
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("atv-survey-vote")) {
      setVoted(true);
    }
  }, []);

  async function castVote(choice: SurveyChoice) {
    setSubmitting(true);
    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      localStorage.setItem("atv-survey-vote", choice);
      setVoted(true);
    } catch {
      setVoted(true);
    }
    setSubmitting(false);
  }

  if (voted) {
    return (
      <div className="mt-10 w-full max-w-md rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-5 backdrop-blur-sm">
        <p className="text-sm font-semibold text-emerald-400">Thank you for your feedback!</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/40">
          Your opinion matters to us. We&apos;ll make the best decision for everyone.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 w-full max-w-md rounded-xl border border-[#c4182a]/20 bg-[#c4182a]/[0.04] px-6 py-6 backdrop-blur-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c4182a]">We need your help</p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
        We are paying heavy server costs without any revenue. Without support, we won&apos;t be able to keep
        animeTV<span className="text-[#c4182a]">plus</span> running.
      </p>
      <p className="mt-3 text-sm font-semibold text-white">What should we do?</p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => castVote("ads")}
          className="group flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] disabled:opacity-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/40 text-sm font-black text-emerald-400 transition group-hover:border-emerald-400 group-hover:bg-emerald-500/10">
            1
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Run ads in moderation</p>
            <p className="mt-0.5 text-[11px] text-white/35">Keep the service alive with minimal, non-intrusive ads</p>
          </div>
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => castVote("close")}
          className="group flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-red-500/30 hover:bg-red-500/[0.06] disabled:opacity-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-red-500/40 text-sm font-black text-red-400 transition group-hover:border-red-400 group-hover:bg-red-500/10">
            2
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Close the service</p>
            <p className="mt-0.5 text-[11px] text-white/35">Shut down animetvplus permanently</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export function MaintenanceGate() {
  if (!MAINTENANCE_ON) return null;

  const { h, m, s, done } = useCountdown(MAINTENANCE_END);

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-y-auto bg-black px-6 py-10 text-center">
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

      <SurveyPopup />
    </div>
  );
}
