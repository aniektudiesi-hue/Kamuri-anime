import type { Anime, EpisodeResponse, LibraryItem, StreamResponse, User } from "./types";
import { listFromPayload } from "./utils";
import { readCachedStream, writeCachedStream } from "./stream-cache";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";
const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_PUBLIC_API_BASE_URL || "https://anime-tv-stream-proxy.kamuri-anime.workers.dev";
const HISTORY_CACHE_PREFIX = "anime-tv-server-history:";
const HISTORY_CACHE_TTL = 1000 * 60 * 15;

type RequestOptions = RequestInit & { token?: string | null; adminKey?: string | null };

function numberFrom(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringFrom(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeHistoryBody(body: Record<string, unknown>) {
  const id = stringFrom(body.mal_id, stringFrom(body.anime_id));
  const playbackPos = numberFrom(body.playback_pos ?? body.progress ?? body.timestamp, 0);
  return {
    ...body,
    mal_id: id,
    title: stringFrom(body.title, id ? `Anime ${id}` : "Anime"),
    image_url: stringFrom(body.image_url, stringFrom(body.poster, stringFrom(body.image, stringFrom(body.thumbnail)))),
    episode: numberFrom(body.episode ?? body.episode_num, 1),
    playback_pos: playbackPos,
    progress: playbackPos,
    timestamp: playbackPos,
  };
}

function normalizeWatchlistBody(body: Record<string, unknown>) {
  const id = stringFrom(body.mal_id, stringFrom(body.anime_id));
  return {
    ...body,
    mal_id: id,
    title: stringFrom(body.title, id ? `Anime ${id}` : "Anime"),
    image_url: stringFrom(body.image_url, stringFrom(body.poster, stringFrom(body.image, stringFrom(body.thumbnail)))),
    episodes: numberFrom(body.episodes ?? body.episode_count ?? body.num_episodes, 0),
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.adminKey) headers.set("X-Admin-Key", options.adminKey);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  let res: Response;
  try {
    res = await fetch(`${baseForPath(path, options)}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    window.clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("timeout");
    }
    throw err;
  }
  window.clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status}`);
  }

  return (await res.json()) as T;
}

async function cachedStreamRequest(key: string, path: string) {
  const cached = readCachedStream(key);
  if (cached) return cached;
  const stream = await request<StreamResponse>(path);
  writeCachedStream(key, stream);
  return stream;
}

function baseForPath(path: string, options: RequestOptions) {
  if (options.token || options.adminKey || options.method && options.method !== "GET") return API_BASE;
  if (
    path.startsWith("/api/stream/") ||
    path.startsWith("/api/moon/") ||
    path.startsWith("/api/hd1/") ||
    path.startsWith("/home/") ||
    path.startsWith("/anime/episode/") ||
    path.startsWith("/search/") ||
    path.startsWith("/suggest/") ||
    path === "/api/v1/banners"
  ) {
    return PUBLIC_API_BASE;
  }
  return API_BASE;
}

function historyCacheKey(token: string) {
  return `${HISTORY_CACHE_PREFIX}${token.slice(-24)}`;
}

function readCachedHistory(token: string) {
  try {
    const raw = window.localStorage.getItem(historyCacheKey(token));
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as { expiresAt: number; value: LibraryItem[] };
    if (!Array.isArray(cached.value) || cached.expiresAt < Date.now()) {
      window.localStorage.removeItem(historyCacheKey(token));
      return undefined;
    }
    return cached.value;
  } catch {
    return undefined;
  }
}

function writeCachedHistory(token: string, value: LibraryItem[]) {
  try {
    window.localStorage.setItem(
      historyCacheKey(token),
      JSON.stringify({ expiresAt: Date.now() + HISTORY_CACHE_TTL, value }),
    );
  } catch {
    // Best-effort cache.
  }
}

function mergeCachedHistory(token: string, body: Record<string, unknown>) {
  const normalized = normalizeHistoryBody(body) as LibraryItem;
  const id = String(normalized.mal_id || normalized.anime_id || "");
  const current = readCachedHistory(token) ?? [];
  writeCachedHistory(
    token,
    [normalized, ...current.filter((item) => String(item.mal_id || item.anime_id || "") !== id)].slice(0, 500),
  );
}

export const api = {
  banners: async () => listFromPayload<Anime>(await request("/api/v1/banners")),
  thumbnails: async () => listFromPayload<Anime>(await request("/home/thumbnails")),
  recentlyAdded: async () => listFromPayload<Anime>(await request("/home/recently-added")),
  topRated: async () => listFromPayload<Anime>(await request("/home/top-rated")),
  search: async (query: string) => listFromPayload<Anime>(await request(`/search/${encodeURIComponent(query)}`)),
  suggest: async (query: string) => listFromPayload<Anime>(await request(`/suggest/${encodeURIComponent(query)}`)),
  episodes: (malId: string, hint = 0) => request<EpisodeResponse>(`/anime/episode/${malId}?hint=${hint}`),
  stream: (malId: string, episode: string | number, type: "sub" | "dub") =>
    cachedStreamRequest(`mega:${malId}:${episode}:${type}`, `/api/stream/${malId}/${episode}?type=${type}&embed=false`),
  moon: (malId: string, episode: string | number) =>
    cachedStreamRequest(`moon-fast:${malId}:${episode}`, `/api/moon/${malId}/${episode}`),
  hd1: (malId: string, episode: string | number) =>
    cachedStreamRequest(`hd1:${malId}:${episode}`, `/api/hd1/${malId}/${episode}`),
  login: (body: Record<string, string>) => request<Record<string, unknown>>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body: Record<string, string>) => request<Record<string, unknown>>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  recover: (body: Record<string, string>) => request<Record<string, unknown>>("/auth/recover", { method: "POST", body: JSON.stringify(body) }),
  me: (token: string) => request<User>("/auth/me", { token }),
  addHistory: (token: string, body: Record<string, unknown>) => {
    const normalized = normalizeHistoryBody(body);
    mergeCachedHistory(token, normalized);
    return request("/user/history", { method: "POST", token, body: JSON.stringify(normalized) });
  },
  addHistoryKeepalive: (token: string, body: Record<string, unknown>) => {
    const normalized = normalizeHistoryBody(body);
    mergeCachedHistory(token, normalized);
    const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}/user/history`, {
      method: "POST",
      headers,
      body: JSON.stringify(normalized),
      keepalive: true,
    }).catch(() => undefined);
  },
  history: async (token: string) => {
    const cached = readCachedHistory(token);
    if (cached) {
      void request("/user/history", { token })
        .then((payload) => writeCachedHistory(token, listFromPayload<LibraryItem>(payload)))
        .catch(() => undefined);
      return cached;
    }
    const value = listFromPayload<LibraryItem>(await request("/user/history", { token }));
    writeCachedHistory(token, value);
    return value;
  },
  clearHistory: (token: string) => request("/user/history", { method: "DELETE", token }),
  addWatchlist: (token: string, body: Record<string, unknown>) =>
    request("/user/watchlist", { method: "POST", token, body: JSON.stringify(normalizeWatchlistBody(body)) }),
  watchlist: async (token: string) => listFromPayload<LibraryItem>(await request("/user/watchlist", { token })),
  removeWatchlist: (token: string, malId: string) => request(`/user/watchlist/${malId}`, { method: "DELETE", token }),
  addDownload: (token: string, body: Record<string, unknown>) =>
    request("/user/downloads", { method: "POST", token, body: JSON.stringify(body) }),
  downloads: async (token: string) => listFromPayload<LibraryItem>(await request("/user/downloads", { token })),
  removeDownload: (token: string, malId: string, episode: string | number) =>
    request(`/user/downloads/${malId}/${episode}`, { method: "DELETE", token }),
  trackVisit: async (
    body: { path: string; referrer?: string; timezone?: string; language?: string; screen?: string },
    token?: string | null,
  ) => {
    const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    await fetch(`${API_BASE}/analytics/visit`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  },
  adminOverview: (token: string, adminKey?: string | null) => request<Record<string, unknown>>("/admin/overview", { token, adminKey }),
  adminUsers: (token: string, adminKey?: string | null, limit = 200) =>
    request<{ items: Record<string, unknown>[] }>(`/admin/users?limit=${limit}`, { token, adminKey }),
  adminUserActivity: (token: string, userId: string | number, adminKey?: string | null, limit = 80) =>
    request<Record<string, unknown>>(`/admin/users/${userId}/activity?limit=${limit}`, { token, adminKey }),
  adminBanUser: (token: string, userId: string | number, adminKey?: string | null, reason = "Banned by admin") =>
    request<Record<string, unknown>>(`/admin/users/${userId}/ban`, {
      method: "POST",
      token,
      adminKey,
      body: JSON.stringify({ reason }),
    }),
  adminUnbanUser: (token: string, userId: string | number, adminKey?: string | null) =>
    request<Record<string, unknown>>(`/admin/users/${userId}/ban`, { method: "DELETE", token, adminKey }),
  adminDeleteUser: (token: string, userId: string | number, adminKey?: string | null) =>
    request<Record<string, unknown>>(`/admin/users/${userId}`, { method: "DELETE", token, adminKey }),
  adminLogins: (token: string, adminKey?: string | null, limit = 200) =>
    request<{ items: Record<string, unknown>[] }>(`/admin/logins?limit=${limit}`, { token, adminKey }),
  adminVisits: (token: string, adminKey?: string | null, limit = 300) =>
    request<{ items: Record<string, unknown>[] }>(`/admin/visits?limit=${limit}`, { token, adminKey }),
  adminSearchVisibility: (token: string, adminKey?: string | null) => request<Record<string, unknown>>("/admin/search-visibility", { token, adminKey }),
  chatRooms: (token: string) => request<{ items: Record<string, unknown>[] }>("/chat/rooms", { token }),
  chatOnline: (token?: string | null) => request<{ items: Record<string, unknown>[]; count?: number }>("/chat/online", { token }),
  chatMessages: (token: string | null | undefined, room: string, limit = 80) =>
    request<{ items: Record<string, unknown>[] }>(`/chat/messages/${encodeURIComponent(room)}?limit=${limit}`, { token }),
  sendChatMessage: (token: string, room: string, body: Record<string, unknown>) =>
    request<{ ok: boolean; message: Record<string, unknown> }>(`/chat/messages/${encodeURIComponent(room)}`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  searchChatUsers: (token: string, q: string) =>
    request<{ items: Record<string, unknown>[] }>(`/chat/users/search?q=${encodeURIComponent(q)}`, { token }),
  followUser: (token: string, userId: string | number) =>
    request(`/chat/users/${userId}/follow`, { method: "POST", token }),
  unfollowUser: (token: string, userId: string | number) =>
    request(`/chat/users/${userId}/follow`, { method: "DELETE", token }),
  followingUsers: (token: string) => request<{ items: Record<string, unknown>[] }>("/chat/following", { token }),
};
