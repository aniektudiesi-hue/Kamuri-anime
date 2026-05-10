"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "dark" | "light";

type AppSettings = {
  autoFetchWhileWatching: boolean;
  autoResume: boolean;
  theme: ThemeMode;
};

type SettingsContextValue = AppSettings & {
  setAutoFetchWhileWatching: (value: boolean) => void;
  setAutoResume: (value: boolean) => void;
  setTheme: (value: ThemeMode) => void;
};

const SETTINGS_KEY = "anime-tv-settings-v1";

const DEFAULT_SETTINGS: AppSettings = {
  autoFetchWhileWatching: false,
  autoResume: true,
  theme: "dark",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setAutoFetchWhileWatching: (autoFetchWhileWatching) =>
        setSettings((current) => ({ ...current, autoFetchWhileWatching })),
      setAutoResume: (autoResume) =>
        setSettings((current) => ({ ...current, autoResume })),
      setTheme: (theme) => setSettings((current) => ({ ...current, theme })),
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
