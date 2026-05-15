import type { Anime, EpisodeResponse, LibraryItem, StreamResponse, User } from "./types";
import { listFromPayload } from "./utils";
import { readCachedStream, writeCachedStream } from "./stream-cache";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

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
    res = await fetch(`${API_BASE}${path}`, {
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
  me: (token: string) => request<User>("/auth/me", { token }),
  addHistory: (token: string, body: Record<string, unknown>) =>
    request("/user/history", { method: "POST", token, body: JSON.stringify(normalizeHistoryBody(body)) }),
  addHistoryKeepalive: (token: string, body: Record<string, unknown>) => {
    const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}/user/history`, {
      method: "POST",
      headers,
      body: JSON.stringify(normalizeHistoryBody(body)),
      keepalive: true,
    }).catch(() => undefined);
  },
  history: async (token: string) => listFromPayload<LibraryItem>(await request("/user/history", { token })),
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
  adminLogins: (token: string, adminKey?: string | null, limit = 200) =>
    request<{ items: Record<string, unknown>[] }>(`/admin/logins?limit=${limit}`, { token, adminKey }),
  adminVisits: (token: string, adminKey?: string | null, limit = 300) =>
    request<{ items: Record<string, unknown>[] }>(`/admin/visits?limit=${limit}`, { token, adminKey }),
  adminSearchVisibility: (token: string, adminKey?: string | null) => request<Record<string, unknown>>("/admin/search-visibility", { token, adminKey }),
  chatRooms: (token: string) => request<{ items: Record<string, unknown>[] }>("/chat/rooms", { token }),
  chatMessages: (token: string, room: string, limit = 80) =>
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
