import type { StreamResponse, Subtitle } from "./types";

const DB_NAME = "anime-tv-offline";
const DB_VERSION = 1;
const STORE = "episodes";

export type OfflineDownload = {
  id: string;
  malId: string;
  episode: number;
  title: string;
  poster?: string;
  server?: string;
  playlistText: string;
  segments: Blob[];
  subtitles: Array<{ label?: string; text: string }>;
  size: number;
  downloadedAt: string;
};

export type OfflinePlayable = {
  stream: StreamResponse;
  revoke: () => void;
};

type SegmentResource = {
  placeholder: string;
  url: string;
};

export function offlineId(malId: string, episode: string | number) {
  return `${malId}-${episode}`;
}

export async function listOfflineDownloads() {
  const db = await openDb();
  return new Promise<OfflineDownload[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineDownload[]).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt)));
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineDownload(id: string) {
  const db = await openDb();
  return new Promise<OfflineDownload | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as OfflineDownload | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineDownload(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOfflineDownload(
  stream: StreamResponse,
  metadata: {
    malId: string;
    episode: number;
    title: string;
    poster?: string;
    server?: string;
  },
  signal: AbortSignal,
  onProgress: (progress: number, message: string) => void,
) {
  const src = stream.m3u8_url || stream.stream_url || stream.url;
  if (!src) throw new Error("No stream URL available");
  if (!isPlaylist(src)) throw new Error("Offline downloads need an HLS stream");

  onProgress(1, "Preparing offline stream");
  const mediaPlaylistUrl = await resolveMediaPlaylist(src, signal);
  const playlistText = await fetchText(mediaPlaylistUrl, signal);
  const { playlistText: offlinePlaylist, resources } = rewritePlaylistForOffline(playlistText, mediaPlaylistUrl);
  if (!resources.length) throw new Error("No video chunks found");

  const segments = new Array<Blob>(resources.length);
  let completed = 0;
  let size = 0;
  const concurrency = Math.min(8, resources.length);
  let cursor = 0;

  async function worker() {
    while (cursor < resources.length) {
      const resource = resources[cursor++];
      const response = await fetch(resource.url, { signal });
      if (!response.ok) throw new Error(`Chunk ${completed + 1} failed (${response.status})`);
      const blob = await response.blob();
      const index = Number(resource.placeholder.replace("__SEGMENT_", "").replace("__", ""));
      segments[index] = blob;
      size += blob.size;
      completed += 1;
      onProgress(5 + (completed / resources.length) * 88, `Saved ${completed}/${resources.length} chunks`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  onProgress(95, "Saving subtitles");
  const subtitles = await fetchSubtitles(stream.subtitles, signal);

  const item: OfflineDownload = {
    id: offlineId(metadata.malId, metadata.episode),
    malId: metadata.malId,
    episode: metadata.episode,
    title: metadata.title,
    poster: metadata.poster,
    server: metadata.server,
    playlistText: offlinePlaylist,
    segments,
    subtitles,
    size,
    downloadedAt: new Date().toISOString(),
  };

  await putOfflineDownload(item);
  onProgress(100, "Ready offline");
  return item;
}

export function createOfflinePlayable(download: OfflineDownload): OfflinePlayable {
  const urls: string[] = [];
  let playlist = download.playlistText;

  download.segments.forEach((blob, index) => {
    const url = URL.createObjectURL(blob);
    urls.push(url);
    playlist = playlist.replaceAll(`__SEGMENT_${index}__`, url);
  });

  const subtitleUrls = download.subtitles.map((subtitle) => {
    const url = URL.createObjectURL(new Blob([subtitle.text], { type: "text/vtt" }));
    urls.push(url);
    return {
      file: url,
      label: subtitle.label || "English",
      kind: "captions",
      default: true,
    };
  });

  const playlistUrl = URL.createObjectURL(new Blob([playlist], { type: "application/vnd.apple.mpegurl" }));
  urls.push(playlistUrl);

  return {
    stream: {
      m3u8_url: playlistUrl,
      subtitles: subtitleUrls,
    },
    revoke: () => urls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

async function putOfflineDownload(item: OfflineDownload) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
    variants.push({ score: variantScore(lines[i]), url: new URL(next, src).toString() });
  }

  variants.sort((a, b) => b.score - a.score);
  return variants[0]?.url || src;
}

function rewritePlaylistForOffline(playlistText: string, playlistUrl: string) {
  const resources: SegmentResource[] = [];
  const lines = playlistText.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#EXT-X-MAP")) {
      return line.replace(/URI="([^"]+)"/, () => {
        const placeholder = `__SEGMENT_${resources.length}__`;
        const match = trimmed.match(/URI="([^"]+)"/);
        if (match?.[1]) resources.push({ placeholder, url: new URL(match[1], playlistUrl).toString() });
        return `URI="${placeholder}"`;
      });
    }

    if (trimmed.startsWith("#")) return line;

    const placeholder = `__SEGMENT_${resources.length}__`;
    resources.push({ placeholder, url: new URL(trimmed, playlistUrl).toString() });
    return placeholder;
  });

  return { playlistText: lines.join("\n"), resources };
}

async function fetchSubtitles(subtitles: Subtitle[] | undefined, signal: AbortSignal) {
  const valid = (subtitles ?? []).filter((subtitle) => subtitle.file);
  const english = valid.find((subtitle) => {
    const text = `${subtitle.label ?? ""} ${subtitle.file}`.toLowerCase();
    return text.includes("english") || /\b(en|eng)\b/.test(text);
  });
  const selected = english || valid[0];
  if (!selected) return [];

  try {
    return [{ label: selected.label || "English", text: await fetchText(selected.file, signal) }];
  } catch {
    return [];
  }
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
