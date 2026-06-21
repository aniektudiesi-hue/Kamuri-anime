"use client";

import { CheckCircle2, ChevronDown, Download, XCircle } from "lucide-react";
import { useState } from "react";
import {
  cancelDownload,
  startDownload,
  useDownloadJobs,
} from "@/lib/download-manager";
import { offlineId, type DownloadQuality } from "@/lib/offline-downloads";
import type { StreamResponse } from "@/lib/types";

const QUALITIES: { value: DownloadQuality; label: string; note: string }[] = [
  { value: 720, label: "720p", note: "HD • larger file" },
  { value: 360, label: "360p", note: "Data saver" },
];

// Native Android shell bridge (injected as window.AndroidApp by the app).
type AndroidBridge = {
  isNativeApp?: () => boolean;
  downloadEpisode?: (malId: string, episode: number, title: string, poster: string) => void;
  openDownloads?: () => void;
};
function androidBridge(): AndroidBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { AndroidApp?: AndroidBridge }).AndroidApp;
}

export function EpisodeDownloadButton({
  stream,
  malId,
  episode,
  title,
  poster,
  thumbnail,
  server,
  prefetch,
}: {
  stream?: StreamResponse;
  malId: string;
  episode: number;
  title: string;
  poster?: string;
  thumbnail?: string;
  server?: string;
  prefetch?: {
    progress: number;
    message: string;
    ready: boolean;
  };
}) {
  const [quality, setQuality] = useState<DownloadQuality>(720);
  const [qualityOpen, setQualityOpen] = useState(false);
  const jobs = useDownloadJobs();
  const id = offlineId(malId, episode);
  const job = jobs.find((j) => j.id === id);

  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  const busy = job?.status === "downloading" || job?.status === "saving" || job?.status === "queued";
  const done = job?.status === "done";
  const progress = job?.progress ?? (prefetch?.progress ?? 0);
  const message = job?.message ?? "";

  // In the native Android app, downloads are handled by the Kotlin engine
  // (background, real file storage, notification). Hand off via the bridge.
  const bridge = androidBridge();
  const isNativeApp = Boolean(bridge?.isNativeApp?.());

  function begin() {
    if (busy) return;
    if (isNativeApp && bridge?.downloadEpisode) {
      // The native picker asks sub/dub + quality, then resolves + downloads.
      bridge.downloadEpisode(String(malId), episode, title, poster || thumbnail || "");
      return;
    }
    if (!stream || !src) return;
    startDownload(stream, { malId, episode, title, poster, thumbnail, server }, quality);
  }

  return (
    <div className="rounded-3xl border border-white/[0.055] bg-[#0d1020] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Offline</p>
        {/* Quality picker — 1080p is intentionally never offered for offline. */}
        <div className="relative">
          <button
            type="button"
            disabled={busy || done}
            onClick={() => setQualityOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-[#141828] px-3 py-1.5 text-xs font-bold text-white/80 transition hover:border-white/20 disabled:opacity-45"
          >
            {QUALITIES.find((q) => q.value === quality)?.label}
            <ChevronDown size={13} className={qualityOpen ? "rotate-180 transition" : "transition"} />
          </button>
          {qualityOpen && !busy && !done ? (
            <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#161a2b] shadow-2xl shadow-black/60">
              {QUALITIES.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  onClick={() => { setQuality(q.value); setQualityOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition hover:bg-white/[0.05] ${quality === q.value ? "text-[#ff6b82]" : "text-white/80"}`}
                >
                  <span className="text-[13px] font-bold">{q.label}</span>
                  <span className="text-[10px] font-medium text-white/35">{q.note}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={(!src && !isNativeApp) || busy || done}
          onClick={begin}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#cf2442] px-4 text-sm font-bold text-white shadow-lg shadow-[#cf2442]/15 transition hover:bg-[#dc2d4b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {done ? <CheckCircle2 size={16} /> : <Download size={16} />}
          {done ? "Saved offline" : busy ? "Saving offline" : isNativeApp ? "Download" : `Download ${quality}p`}
        </button>

        {busy ? (
          <button
            type="button"
            onClick={() => cancelDownload(id)}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.07] bg-[#141828] text-white/45 transition hover:text-white"
            aria-label="Cancel download"
          >
            <XCircle size={16} />
          </button>
        ) : null}
      </div>

      {job || prefetch ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${job?.status === "error" ? "bg-red-400" : "bg-[#cf2442]"}`}
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <p className={`mt-2 text-xs ${job?.status === "error" ? "text-red-300" : "text-white/35"}`}>
            {job ? message : prefetch?.ready ? "Cached. Tap Download to keep it." : prefetch?.message || "Caching while you watch"}
            {progress > 0 && progress < 100 ? ` - ${Math.round(progress)}%` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/25">Pick a quality, then tap Download to save this episode on your device.</p>
      )}
    </div>
  );
}
