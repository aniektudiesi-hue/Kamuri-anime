import type { Anime, EpisodeResponse, LibraryItem, StreamResponse, User } from "./types";
import { listFromPayload } from "./utils";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

type RequestOptions = RequestInit & { token?: string | null };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
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
    request<StreamResponse>(`/api/stream/${malId}/${episode}?type=${type}&embed=false`),
  moon: (malId: string, episode: string | number) => request<StreamResponse>(`/api/moon/${malId}/${episode}`),
  hd1: (malId: string, episode: string | number) => request<StreamResponse>(`/api/hd1/${malId}/${episode}`),
  login: (body: Record<string, string>) => request<Record<string, unknown>>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  register: (body: Record<string, string>) => request<Record<string, unknown>>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me: (token: string) => request<User>("/auth/me", { token }),
  addHistory: (token: string, body: Record<string, unknown>) =>
    request("/user/history", { method: "POST", token, body: JSON.stringify(body) }),
  history: async (token: string) => listFromPayload<LibraryItem>(await request("/user/history", { token })),
  clearHistory: (token: string) => request("/user/history", { method: "DELETE", token }),
  addWatchlist: (token: string, body: Record<string, unknown>) =>
    request("/user/watchlist", { method: "POST", token, body: JSON.stringify(body) }),
  watchlist: async (token: string) => listFromPayload<LibraryItem>(await request("/user/watchlist", { token })),
  removeWatchlist: (token: string, malId: string) => request(`/user/watchlist/${malId}`, { method: "DELETE", token }),
  addDownload: (token: string, body: Record<string, unknown>) =>
    request("/user/downloads", { method: "POST", token, body: JSON.stringify(body) }),
  downloads: async (token: string) => listFromPayload<LibraryItem>(await request("/user/downloads", { token })),
  removeDownload: (token: string, malId: string, episode: string | number) =>
    request(`/user/downloads/${malId}/${episode}`, { method: "DELETE", token }),
};
