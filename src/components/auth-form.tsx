"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { api } from "@/lib/api";
import { extractToken, useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "./button";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { isLoggedIn, setSession, user } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const body = {
      username,
      password,
      email: `${username}@animetv.app`,
    };

    try {
      const response = await openUsername(body, mode);
      const token = extractToken(response);
      if (!token) throw new Error("The API did not return an auth token.");
      setSession(token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mx-auto mt-14 w-full max-w-md rounded-[30px] border border-white/[0.085] bg-panel/92 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#cf2442]">animeTVplus account</p>
      <h1 className="text-3xl font-black tracking-tight text-white">{isLoggedIn ? "Switch username" : mode === "login" ? "Login" : "Create account"}</h1>
      <p className="mt-2 text-sm leading-6 text-white/42">
        {isLoggedIn
          ? `Current profile: ${user?.username || user?.email || "Account"}. Sign in with another username to switch.`
          : "Use your username and password to sync watchlist and exact watch history on phone and PC."}
      </p>
      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Username
          <Input name="username" required autoComplete="username" className="h-12 rounded-2xl border-white/[0.09] bg-panel-strong px-4 text-white placeholder:text-white/24 focus-visible:ring-[#cf2442]/30" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            name="password"
            required
            minLength={4}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Enter password" : ""}
            className="h-12 rounded-2xl border-white/[0.09] bg-panel-strong px-4 text-white placeholder:text-white/24 focus-visible:ring-[#cf2442]/30"
          />
        </label>
      </div>
      {error ? <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p> : null}
      <Button disabled={loading} className="mt-6 w-full">
        {loading ? "Working..." : isLoggedIn ? "Switch profile" : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      {mode === "login" ? (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setError("");
            setLoading(true);
            const form = formRef.current;
            const data = form ? new FormData(form) : new FormData();
            const username = String(data.get("username") || "");
            const password = String(data.get("password") || "");
            try {
              const response = await api.recover({ username, new_password: password });
              const token = extractToken(response);
              if (!token) throw new Error("The API did not return an auth token.");
              setSession(token);
              router.push("/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Recovery failed.");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-black text-white/70 transition hover:border-[#cf2442]/35 hover:text-white disabled:opacity-50"
        >
          Recover old username
        </button>
      ) : null}
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link className="font-semibold text-accent-2" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Register" : "Login"}
        </Link>
      </p>
    </form>
  );
}

async function openUsername(body: Record<string, string>, mode: "login" | "register") {
  try {
    return mode === "register" ? await api.register(body) : await api.login(body);
  } catch (error) {
    throw error;
  }
}
