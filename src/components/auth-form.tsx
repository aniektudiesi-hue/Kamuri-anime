"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { extractToken, useAuth } from "@/lib/auth";
import { Button } from "./button";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { isLoggedIn, setSession, user } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    const body = {
      username,
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
    <form onSubmit={submit} className="mx-auto mt-12 w-full max-w-md rounded-md border border-white/10 bg-panel p-6">
      <h1 className="text-3xl font-black">{isLoggedIn ? "Switch username" : mode === "login" ? "Login" : "Create account"}</h1>
      <p className="mt-2 text-sm text-muted">
        {isLoggedIn
          ? `Current profile: ${user?.username || user?.email || "Account"}. Enter another username to switch.`
          : "Enter your username to sync watchlist and exact watch history on phone and PC."}
      </p>
      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Username
          <input name="username" required autoComplete="username" className="h-11 rounded-md border border-white/10 bg-panel-strong px-3 text-white" />
        </label>
      </div>
      {error ? <p className="mt-4 rounded-md border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p> : null}
      <Button disabled={loading} className="mt-6 w-full">
        {loading ? "Working..." : isLoggedIn ? "Switch profile" : mode === "login" ? "Continue" : "Create account"}
      </Button>
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
    const message = error instanceof Error ? error.message : "";
    if (mode === "login" && /not found|401/i.test(message)) return api.register(body);
    if (mode === "register" && /taken|409/i.test(message)) return api.login(body);
    throw error;
  }
}
