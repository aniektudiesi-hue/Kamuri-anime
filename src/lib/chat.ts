import { API_BASE } from "./api";

export const CHAT_OPEN_EVENT = "anime-tv-chat-open";
export const CHAT_SHARE_WATCHING_EVENT = "anime-tv-chat-share-watching";

export type WatchingShare = {
  title: string;
  malId: string;
  episode: number;
  timestamp: number;
  href: string;
};

export function chatSocketUrl(room: string, token: string) {
  const url = new URL(API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/chat/${encodeURIComponent(room)}`;
  url.searchParams.set("token", token);
  return url.toString();
}

export function openChat(room?: string) {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: { room } }));
}

export function shareWatching(detail: WatchingShare) {
  window.dispatchEvent(new CustomEvent(CHAT_SHARE_WATCHING_EVENT, { detail }));
}
