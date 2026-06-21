"use client";

import { useMemo } from "react";

const DEFAULT_PLAYER_BASE = "https://animetv-player.onrender.com";

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
  const src = useMemo(() => {
    const base = (process.env.NEXT_PUBLIC_PLAYER_BASE || DEFAULT_PLAYER_BASE).replace(/\/$/, "");
    const url = new URL(`/player/${encodeURIComponent(malId)}/${encodeURIComponent(String(episode))}`, base);
    url.searchParams.set("type", type);
    if (poster) url.searchParams.set("poster", poster);
    if (initialTime > 1) {
      url.searchParams.set("t", String(Math.floor(initialTime)));
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("skipIntro", "1");
    }
    return url.toString();
  }, [episode, initialTime, malId, poster, type]);

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
