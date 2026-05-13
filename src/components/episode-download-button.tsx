"use client";

import { CheckCircle2, Download, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { offlineId, promotePrefetchToOffline, saveOfflineDownload, type OfflineDownload } from "@/lib/offline-downloads";
import type { StreamResponse } from "@/lib/types";

type DownloadState = "idle" | "preparing" | "downloading" | "saving" | "done" | "error";

export function EpisodeDownloadButton({
  stream,
  malId,
  episode,
  title,
  poster,
  server,
  prefetch,
}: {
  stream?: StreamResponse;
  malId: string;
  episode: number;
  title: string;
  poster?: string;
  server?: string;
  prefetch?: {
    progress: number;
    message: string;
    ready: boolean;
  };
}) {
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const busy = state === "preparing" || state === "downloading" || state === "saving";
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;

  async function startDownload() {
    if (!src || busy) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setState("preparing");
    setProgress(0);
    setMessage("Preparing download");

    try {
      let item: OfflineDownload | undefined;

      if (prefetch?.ready) {
        setState("saving");
        setProgress(100);
        setMessage("Saving cached episode");
        item = await promotePrefetchToOffline(offlineId(malId, episode));
      }

      if (!item) {
        item = await saveOfflineDownload(stream!, {
          malId,
          episode,
          title,
          poster,
          server,
        }, controller.signal, (nextProgress, nextMessage) => {
          setState("downloading");
          setProgress(nextProgress);
          setMessage(nextMessage);
        });
      }

      setState("done");
      setProgress(100);
      setMessage("Saved offline");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setState("idle");
        setProgress(0);
        setMessage("");
        return;
      }
      setState("error");
      setMessage(error instanceof Error ? error.message : "Download failed");
    } finally {
      abortRef.current = null;
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-3xl border border-white/[0.055] bg-[#0d1020] p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Offline</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
        disabled={!src || busy}
          onClick={startDownload}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#cf2442] px-4 text-sm font-bold text-white shadow-lg shadow-[#cf2442]/15 transition hover:bg-[#dc2d4b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === "done" ? <CheckCircle2 size={16} /> : <Download size={16} />}
          {busy ? "Saving offline" : state === "done" ? "Saved offline" : prefetch?.ready ? "Save offline" : "Save offline"}
        </button>

        {busy ? (
          <button
            type="button"
            onClick={cancelDownload}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/[0.07] bg-[#141828] text-white/45 transition hover:text-white"
            aria-label="Cancel download"
          >
            <XCircle size={16} />
          </button>
        ) : null}
      </div>

      {state !== "idle" || prefetch ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${state === "error" ? "bg-red-400" : "bg-[#c8ced8]"}`}
              style={{ width: `${Math.max(4, state === "idle" ? prefetch?.progress ?? 0 : progress)}%` }}
            />
          </div>
          <p className={`mt-2 text-xs ${state === "error" ? "text-red-300" : "text-white/35"}`}>
            {state === "idle"
              ? prefetch?.ready
                ? "Cached. Tap Save offline to keep it."
                : prefetch?.message || "Caching while you watch"
              : message || "Working"}
            {state === "idle" && prefetch && !prefetch.ready ? ` - ${Math.round(prefetch.progress)}%` : ""}
            {busy && progress ? ` - ${Math.round(progress)}%` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/25">Tap Save offline when you want to keep this episode on this device.</p>
      )}
    </div>
  );
}
