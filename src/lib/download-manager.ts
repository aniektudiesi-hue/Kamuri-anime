"use client";

import { useEffect, useState } from "react";
import {
  type DownloadQuality,
  type OfflineMetadata,
  offlineId,
  saveOfflineDownload,
} from "@/lib/offline-downloads";
import type { StreamResponse } from "@/lib/types";

export type DownloadStatus = "queued" | "downloading" | "saving" | "done" | "error";

export type DownloadJob = {
  id: string;
  malId: string;
  episode: number;
  title: string;
  poster?: string;
  quality: DownloadQuality;
  progress: number;
  message: string;
  status: DownloadStatus;
  startedAt: number;
};

type Listener = (jobs: DownloadJob[]) => void;

// Lives at module scope so a download keeps running and reporting progress even
// after the user navigates away from the watch page to My Lists. One source of
// truth for both the watch-page button and the My Lists downloads section.
const jobs = new Map<string, DownloadJob>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<Listener>();

function snapshot(): DownloadJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.startedAt - a.startedAt);
}

function emit() {
  const snap = snapshot();
  listeners.forEach((listener) => listener(snap));
}

function update(id: string, patch: Partial<DownloadJob>) {
  const current = jobs.get(id);
  if (!current) return;
  jobs.set(id, { ...current, ...patch });
  emit();
}

export function getDownloadJobs(): DownloadJob[] {
  return snapshot();
}

export function getDownloadJob(id: string): DownloadJob | undefined {
  return jobs.get(id);
}

export function subscribeDownloads(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function cancelDownload(id: string) {
  controllers.get(id)?.abort();
}

export function dismissDownloadJob(id: string) {
  const job = jobs.get(id);
  if (job && (job.status === "downloading" || job.status === "saving" || job.status === "queued")) {
    controllers.get(id)?.abort();
  }
  jobs.delete(id);
  controllers.delete(id);
  emit();
}

export function startDownload(
  stream: StreamResponse,
  metadata: OfflineMetadata,
  quality: DownloadQuality,
): string {
  const id = offlineId(metadata.malId, metadata.episode);
  const existing = jobs.get(id);
  if (existing && existing.status !== "error" && existing.status !== "done") return id;

  const controller = new AbortController();
  controllers.set(id, controller);
  jobs.set(id, {
    id,
    malId: metadata.malId,
    episode: metadata.episode,
    title: metadata.title,
    poster: metadata.poster,
    quality,
    progress: 0,
    message: "Queued",
    status: "queued",
    startedAt: Date.now(),
  });
  emit();

  saveOfflineDownload(
    stream,
    metadata,
    controller.signal,
    (progress, message) => {
      update(id, {
        progress,
        message,
        status: progress >= 95 ? "saving" : "downloading",
      });
    },
    quality,
  )
    .then(() => {
      update(id, { progress: 100, message: "Saved offline", status: "done" });
      window.dispatchEvent(new Event("atv:downloads-updated"));
    })
    .catch((error: unknown) => {
      if ((error as Error)?.name === "AbortError") {
        jobs.delete(id);
        controllers.delete(id);
        emit();
        return;
      }
      update(id, {
        status: "error",
        message: error instanceof Error ? error.message : "Download failed",
      });
    })
    .finally(() => {
      controllers.delete(id);
    });

  return id;
}

/** Subscribe a React component to the live job list. */
export function useDownloadJobs(): DownloadJob[] {
  const [items, setItems] = useState<DownloadJob[]>(() => getDownloadJobs());
  useEffect(() => subscribeDownloads(setItems), []);
  return items;
}
