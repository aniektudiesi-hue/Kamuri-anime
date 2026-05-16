"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";

const OPEN_PATHS = new Set(["/login", "/register"]);

export function AuthRequiredGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const isOpen = OPEN_PATHS.has(pathname);

  if (isLoggedIn || isOpen) return <>{children}</>;

  const returnTo = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(225,29,72,0.16),transparent_34%),linear-gradient(180deg,#080911,#03040a)] px-4 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/[0.09] bg-[#090b14]/92 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e11d48] shadow-lg shadow-[#e11d48]/25">
          <Play size={24} fill="white" />
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.25em] text-[#ff6b86]">animeTVplus members only</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Create an account to continue</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/58">
          Register or sign in to use animeTVplus, sync watch history, chat live, and keep your profile across devices.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href={`/register?returnTo=${encodeURIComponent(returnTo)}`}
            className="grid h-12 place-items-center rounded-2xl bg-[#e11d48] text-sm font-black text-white shadow-lg shadow-[#e11d48]/20"
          >
            Register now
          </Link>
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="grid h-12 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.06] text-sm font-black text-white"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-white/40">
          <Lock size={13} /> Access is locked until login.
        </p>
      </section>
    </main>
  );
}
