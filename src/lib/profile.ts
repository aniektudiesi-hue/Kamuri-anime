"use client";

import { useEffect, useMemo, useState } from "react";

export type ProfilePrefs = {
  displayName?: string;
  photo?: string;
};

function profileKey(identity?: string | null) {
  const clean = (identity || "guest").trim().toLowerCase() || "guest";
  return `anime-tv-profile:${clean}`;
}

function readPrefs(key: string): ProfilePrefs {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as ProfilePrefs;
  } catch {
    return {};
  }
}

export function useProfilePrefs(identity?: string | null) {
  const key = useMemo(() => profileKey(identity), [identity]);
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => readPrefs(key));

  useEffect(() => {
    setPrefs(readPrefs(key));
  }, [key]);

  const savePrefs = (next: ProfilePrefs) => {
    const normalized = {
      displayName: next.displayName?.trim() || undefined,
      photo: next.photo || undefined,
    };
    window.localStorage.setItem(key, JSON.stringify(normalized));
    setPrefs(normalized);
    window.dispatchEvent(new CustomEvent("anime-tv-profile-updated"));
  };

  useEffect(() => {
    const onUpdate = () => setPrefs(readPrefs(key));
    window.addEventListener("anime-tv-profile-updated", onUpdate);
    return () => window.removeEventListener("anime-tv-profile-updated", onUpdate);
  }, [key]);

  return { prefs, savePrefs };
}

export function displayProfileName(accountName?: string | null, displayName?: string | null) {
  return displayName?.trim() || accountName?.trim() || "Account";
}
