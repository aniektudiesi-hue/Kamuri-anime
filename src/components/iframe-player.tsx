"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PLAYER_BASE = "https://animetv-player.onrender.com";

// Comma-separated list of player server URLs, ordered by preference.
// The component races them all on first load and caches the fastest one.
const PLAYER_SERVERS: string[] = (
  process.env.NEXT_PUBLIC_PLAYER_SERVERS || DEFAULT_PLAYER_BASE
)
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const FASTEST_KEY = "atv-fastest-player";
const FASTEST_TTL = 4 * 60 * 60 * 1000; // 4 h

function cachedServer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FASTEST_KEY);
    if (!raw) return null;
    const { url, ts } = JSON.parse(raw) as { url: string; ts: number };
    if (Date.now() - ts < FASTEST_TTL && PLAYER_SERVERS.includes(url)) return url;
  } catch { /* ignore */ }
  return null;
}

async function detectFastest(): Promise<string> {
  if (PLAYER_SERVERS.length === 1) return PLAYER_SERVERS[0];
  const results = await Promise.allSettled(
    PLAYER_SERVERS.map(async (url) => {
      const t = performance.now();
      const ctrl = new AbortController();
      const tid = window.setTimeout(() => ctrl.abort(), 2500);
      try {
        await fetch(`${url}/health`, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
        return { url, ms: performance.now() - t };
      } finally {
        window.clearTimeout(tid);
      }
    }),
  );
  const winner = results
    .filter((r): r is PromiseFulfilledResult<{ url: string; ms: number }> => r.status === "fulfilled")
    .sort((a, b) => a.value.ms - b.value.ms)[0]?.value?.url ?? PLAYER_SERVERS[0];
  try {
    window.localStorage.setItem(FASTEST_KEY, JSON.stringify({ url: winner, ts: Date.now() }));
  } catch { /* ignore */ }
  return winner;
}

export function IframePlayer({
  malId,
  episode,
  type = "sub",
  title,
  poster,
  initialTime = 0,
}: {
  malId: string;
  episode: string | number;
  type?: "sub" | "dub";
  title: string;
  poster?: string;
  initialTime?: number;
}) {
  // Start with cached server immediately (no loading stall).
  // Background-refresh the cache so the NEXT load uses the latest fastest.
  const [playerBase, setPlayerBase] = useState<string>(
    () => cachedServer() ?? PLAYER_SERVERS[0],
  );
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    detectFastest().then((fastest) => {
      // Only swap the src if a genuinely faster server was found and the
      // current src hasn't started buffering (i.e. user hasn't played yet).
      if (fastest !== playerBase) setPlayerBase(fastest);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_PLAYER_BASE || playerBase).replace(/\/$/, "");
    const url = new URL(`/player/${encodeURIComponent(malId)}/${encodeURIComponent(String(episode))}`, base);
    url.searchParams.set("type", type);
    if (poster) url.searchParams.set("poster", poster);
    if (initialTime > 1) {
      url.searchParams.set("t", String(Math.floor(initialTime)));
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("skipIntro", "1");
    }
    return url.toString();
  }, [episode, initialTime, malId, playerBase, poster, type]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <iframe
        key={src}
        src={src}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0 bg-black"
      />
    </div>
  );
}
