"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { api } from "@/lib/api";
import { extractToken, useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Kairo } from "@/components/mascot/kairo";
import { Button } from "./button";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { isLoggedIn, setSession, user } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const body = { username, password, email: `${username}@animetv.app` };

    try {
      const response = await openUsername(body, mode);
      const token = extractToken(response);
      if (!token) throw new Error("The API did not return an auth token.");
      setSession(token);
      // Kairo welcomes the user, then we redirect.
      setWelcomeName(username || "back");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";
      const dest = returnTo.startsWith("/") ? returnTo : "/";
      setTimeout(() => router.push(dest), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setLoading(false);
    }
  }

  // Kairo welcome interstitial
  if (welcomeName) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <Kairo mood="welcome" size={172} priority className="animate-[slideUp_0.5s_cubic-bezier(0.22,1,0.36,1)]" />
        <h1 className="mt-5 text-3xl font-black tracking-tight text-white">
          Welcome{welcomeName !== "back" ? "," : " back"} <span className="text-[#c4182a]">{welcomeName !== "back" ? welcomeName : ""}</span>
        </h1>
        <p className="mt-2 text-sm text-white/45">Kairo&apos;s getting your library ready…</p>
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full w-full animate-pulse rounded-full bg-[#c4182a]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-center px-6 sm:mt-16">
      {/* Brand + mascot */}
      <Image src="/logo-full.png" alt="animeTVplus" width={1495} height={402} priority className="h-9 w-auto object-contain" />
      <div className="mt-7 flex items-center gap-3">
        <Kairo mood="excited" size={56} priority />
        <div className="text-left">
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isLoggedIn ? "Switch username" : mode === "login" ? "Welcome back" : "Join animeTVplus"}
          </h1>
          <p className="text-[13px] text-white/45">
            {isLoggedIn ? `Signed in as ${user?.username || "Account"}` : "Sync your watchlist & history everywhere"}
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="mt-7 w-full">
        <div className="grid gap-3.5">
          <label className="grid gap-1.5 text-[13px] font-semibold text-white/70">
            Username
            <Input name="username" required autoComplete="username" className="h-12 rounded-xl border-white/[0.1] bg-white/[0.04] px-4 text-white placeholder:text-white/24 focus-visible:ring-[#c4182a]/40" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold text-white/70">
            Password
            <Input
              name="password"
              required
              minLength={4}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "Enter password" : "Choose a password"}
              className="h-12 rounded-xl border-white/[0.1] bg-white/[0.04] px-4 text-white placeholder:text-white/24 focus-visible:ring-[#c4182a]/40"
            />
          </label>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-red-400/25 bg-red-950/25 p-3 text-sm text-red-200">{error}</p> : null}
        <Button disabled={loading} className="mt-5 h-12 w-full rounded-xl bg-[#c4182a] text-[15px] font-bold hover:bg-[#d8273a]">
          {loading ? "Working…" : isLoggedIn ? "Switch profile" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-white/45">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link className="font-semibold text-[#e11d2a] hover:text-[#ff3b52]" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}

async function openUsername(body: Record<string, string>, mode: "login" | "register") {
  try {
    return mode === "register" ? await api.register(body) : await api.login(body);
  } catch (error) {
    if (mode === "login" && error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("username not found") || message.includes("invalid username or password")) {
        return api.recover(body);
      }
    }
    throw error;
  }
}
