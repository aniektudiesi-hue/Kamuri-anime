"use client";

import { CheckCircle2, Download, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { StreamResponse } from "@/lib/types";

type DownloadState = "idle" | "preparing" | "downloading" | "saving" | "done" | "error";

type Segment = {
  url: string;
  index: number;
};

export function EpisodeDownloadButton({
  stream,
  token,
  malId,
  episode,
  title,
  poster,
  server,
}: {
  stream?: StreamResponse;
  token?: string | null;
  malId: string;
  episode: number;
  title: string;
  poster?: string;
  server?: string;
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
      const fileName = safeFileName(`${title}-episode-${episode}.ts`);
      const blob = await downloadStreamToBlob(src, controller.signal, (nextProgress, nextMessage) => {
        setState("downloading");
        setProgress(nextProgress);
        setMessage(nextMessage);
      });

      triggerBrowserDownload(blob, fileName);

      if (token) {
        setState("saving");
        setMessage("Saving to your account");
        await api.addDownload(token, {
          mal_id: malId,
          anime_id: malId,
          title,
          image_url: poster,
          poster,
          episode,
          episode_num: episode,
          server,
          file_name: fileName,
          downloaded_at: new Date().toISOString(),
        });
      }

      setState("done");
      setProgress(100);
      setMessage(token ? "Downloaded and saved" : "Downloaded");
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
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">Download</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!src || busy}
          onClick={startDownload}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#1ed9cc] to-[#7c4dff] px-4 text-sm font-bold text-white shadow-lg shadow-[#1ed9cc]/10 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {state === "done" ? <CheckCircle2 size={16} /> : <Download size={16} />}
          {busy ? "Downloading" : state === "done" ? "Downloaded" : "Download episode"}
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

      {state !== "idle" ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${state === "error" ? "bg-red-400" : "bg-[#1ed9cc]"}`}
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <p className={`mt-2 text-xs ${state === "error" ? "text-red-300" : "text-white/35"}`}>
            {message || "Working"}{busy && progress ? ` - ${Math.round(progress)}%` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/25">Fetches directly in your browser from the CDN stream.</p>
      )}
    </div>
  );
}

async function downloadStreamToBlob(
  src: string,
  signal: AbortSignal,
  onProgress: (progress: number, message: string) => void,
) {
  if (!isPlaylist(src)) {
    onProgress(25, "Fetching direct video file");
    const response = await fetch(src, { signal });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    onProgress(100, "Video ready");
    return blob;
  }

  const mediaPlaylistUrl = await resolveMediaPlaylist(src, signal);
  const playlistText = await fetchText(mediaPlaylistUrl, signal);
  const segments = parseMediaSegments(playlistText, mediaPlaylistUrl);
  if (!segments.length) throw new Error("No downloadable video segments found");

  const parts = new Array<Blob>(segments.length);
  let completed = 0;
  const concurrency = Math.min(8, segments.length);
  let cursor = 0;

  async function worker() {
    while (cursor < segments.length) {
      const segment = segments[cursor++];
      const response = await fetch(segment.url, { signal });
      if (!response.ok) throw new Error(`Segment ${segment.index + 1} failed (${response.status})`);
      parts[segment.index] = await response.blob();
      completed += 1;
      onProgress((completed / segments.length) * 100, `Fetched ${completed}/${segments.length} parts`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  onProgress(100, "Creating video file");
  return new Blob(parts, { type: "video/mp2t" });
}

async function resolveMediaPlaylist(src: string, signal: AbortSignal) {
  const text = await fetchText(src, signal);
  if (!text.includes("#EXT-X-STREAM-INF")) return src;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const variants: Array<{ score: number; url: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines.slice(i + 1).find((line) => !line.startsWith("#"));
    if (!next) continue;
    variants.push({
      score: variantScore(lines[i]),
      url: new URL(next, src).toString(),
    });
  }

  variants.sort((a, b) => b.score - a.score);
  return variants[0]?.url || src;
}

function parseMediaSegments(playlistText: string, playlistUrl: string) {
  const lines = playlistText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const segments: Segment[] = [];

  for (const line of lines) {
    if (line.startsWith("#EXT-X-MAP")) {
      const match = line.match(/URI="([^"]+)"/);
      if (match?.[1]) {
        segments.push({ url: new URL(match[1], playlistUrl).toString(), index: segments.length });
      }
      continue;
    }
    if (line.startsWith("#")) continue;
    segments.push({ url: new URL(line, playlistUrl).toString(), index: segments.length });
  }

  return segments;
}

async function fetchText(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Playlist failed (${response.status})`);
  return response.text();
}

function isPlaylist(url: string) {
  return /\.m3u8(?:$|[?#])/i.test(url) || /\/m3u8(?:$|[?#])/i.test(url) || /\/proxy\/(?:m3u8|moon)\b/i.test(url);
}

function variantScore(line: string) {
  const resolution = line.match(/RESOLUTION=\d+x(\d+)/i);
  const bandwidth = line.match(/BANDWIDTH=(\d+)/i);
  return Number(resolution?.[1] || 0) * 100000000 + Number(bandwidth?.[1] || 0);
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function safeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
