"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * VastPreroll — a self-contained pre-roll ad overlay. Fetches our VAST proxy,
 * parses the first linear MP4 creative, plays it muted (mobile-safe) with a Skip
 * button, fires impression/tracking pixels, then calls onDone(). On ANY failure
 * (no ad, parse error, load timeout) it calls onDone() fast so content is never
 * blocked. Frequency is capped by the caller.
 */

const SKIP_AFTER_SEC = 5;
const LOAD_TIMEOUT_MS = 6000;

type Parsed = {
  media: string;
  impressions: string[];
  tracking: Record<string, string[]>;
  clickThrough?: string;
  skipOffsetSec: number;
};

function firePixels(urls: string[] | undefined) {
  (urls || []).forEach((u) => {
    if (!u) return;
    const img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.src = u.replace(/\[?CACHEBUSTING\]?|\[timestamp\]/gi, String(Date.now()));
  });
}

function parseVast(xml: string): Parsed | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return null;
    const mediaNodes = Array.from(doc.querySelectorAll("MediaFile"));
    const candidates = mediaNodes
      .map((m) => ({ url: (m.textContent || "").trim(), type: (m.getAttribute("type") || "").toLowerCase(), w: Number(m.getAttribute("width")) || 0 }))
      .filter((m) => m.url && (m.type.includes("mp4") || m.url.includes(".mp4")));
    if (!candidates.length) return null;
    // prefer the largest creative up to 1280px wide
    candidates.sort((a, b) => a.w - b.w);
    const pick = candidates.filter((c) => c.w <= 1280).pop() || candidates[0];

    const tracking: Record<string, string[]> = {};
    doc.querySelectorAll("Tracking").forEach((t) => {
      const ev = t.getAttribute("event") || "";
      (tracking[ev] ||= []).push((t.textContent || "").trim());
    });
    const skipAttr = doc.querySelector("Linear")?.getAttribute("skipoffset") || "";
    const m = skipAttr.match(/(\d+):(\d+):(\d+)/);
    const skipOffsetSec = m ? Number(m[2]) * 60 + Number(m[3]) : SKIP_AFTER_SEC;

    return {
      media: pick.url,
      impressions: Array.from(doc.querySelectorAll("Impression")).map((i) => (i.textContent || "").trim()),
      tracking,
      clickThrough: (doc.querySelector("ClickThrough")?.textContent || "").trim() || undefined,
      skipOffsetSec,
    };
  } catch {
    return null;
  }
}

export function VastPreroll({ onDone }: { onDone: () => void }) {
  const [ad, setAd] = useState<Parsed | null>(null);
  const [remaining, setRemaining] = useState(SKIP_AFTER_SEC);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // Fetch + parse the tag (with a hard timeout so content never hangs).
  useEffect(() => {
    let alive = true;
    const timeout = window.setTimeout(finish, LOAD_TIMEOUT_MS);
    fetch("/api/vast", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((xml) => {
        if (!alive) return;
        const parsed = xml ? parseVast(xml) : null;
        if (!parsed) { window.clearTimeout(timeout); finish(); return; }
        window.clearTimeout(timeout);
        setAd(parsed);
        setRemaining(Math.max(0, parsed.skipOffsetSec || SKIP_AFTER_SEC));
      })
      .catch(() => { if (alive) { window.clearTimeout(timeout); finish(); } });
    return () => { alive = false; window.clearTimeout(timeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Skip countdown once the ad is playing.
  useEffect(() => {
    if (!ad) return;
    if (remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [ad, remaining]);

  if (!ad) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={ad.media}
        autoPlay
        muted={muted}
        playsInline
        className="h-full w-full object-contain"
        onLoadedData={() => firePixels(ad.impressions)}
        onPlay={() => firePixels(ad.tracking.start)}
        onError={finish}
        onEnded={() => { firePixels(ad.tracking.complete); finish(); }}
      />

      {/* Click-through (advertiser) — covers the video but sits under the controls */}
      {ad.clickThrough ? (
        <a
          href={ad.clickThrough}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => firePixels(ad.tracking.click)}
          className="absolute inset-0"
          aria-label="Visit advertiser"
        />
      ) : null}

      {/* Ad label */}
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white/85">
        Ad
      </span>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={() => { setMuted((m) => !m); }}
        aria-label={muted ? "Unmute ad" : "Mute ad"}
        className="absolute bottom-3 left-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/65 text-white/90 hover:bg-black/80"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Skip / countdown */}
      {remaining > 0 ? (
        <span className="absolute bottom-3 right-3 z-10 rounded bg-black/70 px-3 py-2 text-[13px] font-semibold text-white/80">
          Skip in {remaining}s
        </span>
      ) : (
        <button
          type="button"
          onClick={() => { firePixels(ad.tracking.skip); finish(); }}
          className="absolute bottom-3 right-3 z-10 rounded bg-white/95 px-4 py-2 text-[13px] font-extrabold text-black transition-colors hover:bg-white"
        >
          Skip Ad ▸
        </button>
      )}
    </div>
  );
}
