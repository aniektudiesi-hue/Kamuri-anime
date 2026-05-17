"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { User } from "./types";

const TOKEN_KEY = "kairostream_token";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isReady: boolean;
  setSession: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setIsReady(true);
  }, []);

  const me = useQuery({
    queryKey: ["me", token],
    queryFn: () => api.me(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: me.data ?? null,
      isLoggedIn: Boolean(token),
      isReady,
      setSession(nextToken) {
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.removeItem("animetvplus_guest_started_at");
        setToken(nextToken);
        setIsReady(true);
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setIsReady(true);
      },
    }),
    [isReady, me.data, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function extractToken(response: Record<string, unknown>) {
  return String(response.access_token || response.token || response.jwt || response.accessToken || "");
}
