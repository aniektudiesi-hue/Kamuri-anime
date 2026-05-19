"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "dark";

type AppSettings = {
  autoFetchWhileWatching: boolean;
  autoResume: boolean;
  theme: ThemeMode;
};

type StoredSettings = Partial<AppSettings> & {
  prefetchVersion?: number;
};

type SettingsContextValue = AppSettings & {
  setAutoFetchWhileWatching: (value: boolean) => void;
  setAutoResume: (value: boolean) => void;
  setTheme: (value: ThemeMode) => void;
};

const SETTINGS_KEY = "anime-tv-settings-v1";
const PREFETCH_SETTINGS_VERSION = 2;

const DEFAULT_SETTINGS: AppSettings = {
  autoFetchWhileWatching: true,
  autoResume: true,
  theme: "dark",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StoredSettings;
        setSettings({
          ...DEFAULT_SETTINGS,
          autoResume: parsed.autoResume ?? DEFAULT_SETTINGS.autoResume,
          autoFetchWhileWatching:
            parsed.prefetchVersion === PREFETCH_SETTINGS_VERSION
              ? parsed.autoFetchWhileWatching ?? DEFAULT_SETTINGS.autoFetchWhileWatching
              : true,
          theme: "dark",
        });
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...settings, theme: "dark", prefetchVersion: PREFETCH_SETTINGS_VERSION }),
    );
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setAutoFetchWhileWatching: (autoFetchWhileWatching) =>
        setSettings((current) => ({ ...current, autoFetchWhileWatching })),
      setAutoResume: (autoResume) =>
        setSettings((current) => ({ ...current, autoResume })),
      setTheme: () => setSettings((current) => ({ ...current, theme: "dark" })),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
