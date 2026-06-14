"use client";

import { useEffect } from "react";

const RELOAD_KEY = "animeTVplus-chunk-reload-v1";
const CHUNK_PATTERNS = [
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "error loading css chunk",
  "importing a module script failed",
];

function isChunkFailure(value: unknown) {
  const text = String(
    value instanceof Error
      ? `${value.name} ${value.message} ${value.stack || ""}`
      : typeof value === "object" && value
        ? JSON.stringify(value)
        : value || "",
  ).toLowerCase();
  return CHUNK_PATTERNS.some((pattern) => text.includes(pattern));
}

function reloadOnce() {
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  const previous = window.sessionStorage.getItem(RELOAD_KEY);
  if (previous === current) return;
  window.sessionStorage.setItem(RELOAD_KEY, current);
  window.location.reload();
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkFailure(event.error || event.message)) reloadOnce();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkFailure(event.reason)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
