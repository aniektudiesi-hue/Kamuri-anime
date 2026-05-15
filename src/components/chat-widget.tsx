"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, MessageCircle, Plus, Radio, Search, Send, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { CHAT_OPEN_EVENT, CHAT_SHARE_WATCHING_EVENT, chatSocketUrl, type WatchingShare } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id?: number;
  room?: string;
  user_id?: number;
  username?: string;
  message?: string;
  kind?: string;
  meta?: Record<string, unknown>;
  created_at?: number;
};

const DEFAULT_ROOMS = ["global", "anime", "recommendations", "spoilers"];

function text(row: Record<string, unknown> | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function number(row: Record<string, unknown> | undefined, key: string, fallback = 0) {
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function roomLabel(room: string) {
  if (room.startsWith("anime:")) return room.replace("anime:", "Anime ");
  if (room.startsWith("dm:")) return "Direct chat";
  return room.replace(/[-_:]/g, " ");
}

function directRoom(a: string | number, b: string | number) {
  return `dm:${[String(a), String(b)].sort().join(":")}`;
}

export function ChatWidget() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState("global");
  const [customRoom, setCustomRoom] = useState("");
  const [message, setMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Record<string, unknown>[]>([]);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rooms = useQuery({
    queryKey: ["chat", "rooms", token],
    queryFn: () => api.chatRooms(token!),
    enabled: Boolean(token && open),
    staleTime: 1000 * 30,
  });

  const history = useQuery({
    queryKey: ["chat", "messages", token, room],
    queryFn: () => api.chatMessages(token!, room, 80),
    enabled: Boolean(token && open && room),
    staleTime: 1000 * 5,
  });

  const following = useQuery({
    queryKey: ["chat", "following", token],
    queryFn: () => api.followingUsers(token!),
    enabled: Boolean(token && open),
    staleTime: 1000 * 15,
  });

  const searchUsers = useQuery({
    queryKey: ["chat", "user-search", token, userSearch],
    queryFn: () => api.searchChatUsers(token!, userSearch),
    enabled: Boolean(token && open && userSearch.trim().length >= 2),
    staleTime: 1000 * 10,
  });

  const sendFallback = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.sendChatMessage(token!, room, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat", "messages", token, room] }),
  });

  const follow = useMutation({
    mutationFn: (id: string | number) => api.followUser(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "following", token] });
      queryClient.invalidateQueries({ queryKey: ["chat", "user-search", token] });
    },
  });

  const roomItems = useMemo(() => {
    const seen = new Set<string>();
    const items = [
      ...DEFAULT_ROOMS.map((name) => ({ room: name })),
      ...((rooms.data?.items ?? []) as Record<string, unknown>[]),
    ].filter((item) => {
      const name = text(item, "room", "global");
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    return items;
  }, [rooms.data]);

  const messages = useMemo(() => {
    const merged = [...((history.data?.items ?? []) as ChatMessage[]), ...liveMessages];
    const byId = new Map<string, ChatMessage>();
    merged.forEach((item, index) => {
      byId.set(String(item.id ?? `${item.created_at}-${item.username}-${index}`), item);
    });
    return Array.from(byId.values()).slice(-120);
  }, [history.data, liveMessages]);

  useEffect(() => {
    const openHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ room?: string }>).detail;
      if (detail?.room) setRoom(detail.room);
      setOpen(true);
    };
    window.addEventListener(CHAT_OPEN_EVENT, openHandler);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, openHandler);
  }, []);

  useEffect(() => {
    const shareHandler = (event: Event) => {
      const detail = (event as CustomEvent<WatchingShare>).detail;
      if (!detail) return;
      const targetRoom = `anime:${detail.malId}`;
      const body = {
        message: `Watching ${detail.title} Episode ${detail.episode} at ${formatClock(detail.timestamp)}`,
        kind: "watching",
        meta: detail,
      };
      setOpen(true);
      setRoom(targetRoom);
      if (token) {
        api.sendChatMessage(token, targetRoom, body)
          .then(() => queryClient.invalidateQueries({ queryKey: ["chat", "messages", token, targetRoom] }))
          .catch(() => setMessage(`${body.message} - ${detail.href}`));
      } else {
        setMessage(`${body.message} - ${detail.href}`);
      }
    };
    window.addEventListener(CHAT_SHARE_WATCHING_EVENT, shareHandler);
    return () => window.removeEventListener(CHAT_SHARE_WATCHING_EVENT, shareHandler);
  }, [queryClient, token]);

  useEffect(() => {
    setLiveMessages([]);
    setOnlineUsers([]);
  }, [room]);

  useEffect(() => {
    if (!token || !open || !room) return;
    let closed = false;
    let reconnect: number | undefined;
    const connect = () => {
      if (closed) return;
      const socket = new WebSocket(chatSocketUrl(room, token));
      socketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; users?: Record<string, unknown>[]; message?: ChatMessage };
          if (data.type === "online") setOnlineUsers(data.users ?? []);
          if (data.type === "message" && data.message) setLiveMessages((current) => [...current, data.message!].slice(-80));
        } catch {
          // Ignore malformed chat frames.
        }
      };
      socket.onclose = () => {
        if (!closed) reconnect = window.setTimeout(connect, 2500);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      closed = true;
      if (reconnect) window.clearTimeout(reconnect);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [open, room, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { message: message.trim(), kind: "text", meta: {} };
    if (!body.message || !token) return;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(body));
    } else {
      sendFallback.mutate(body);
    }
    setMessage("");
  }

  function joinCustomRoom() {
    const clean = customRoom.trim();
    if (!clean) return;
    setRoom(clean.toLowerCase().slice(0, 60));
    setCustomRoom("");
  }

  function startDirectChat(row: Record<string, unknown>) {
    const id = number(row, "id");
    if (!id || !user?.id) return;
    setRoom(directRoom(user.id, id));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 hidden h-12 items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#10121d]/90 px-4 text-sm font-black text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:border-[#e11d48]/35 sm:flex"
      >
        <MessageCircle size={18} />
        Chat
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/54 backdrop-blur-sm sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[430px] sm:bg-transparent sm:backdrop-blur-0">
      <section className="flex h-full flex-col border-white/[0.08] bg-[#080a12]/96 shadow-[0_24px_90px_rgba(0,0,0,0.58)] sm:h-[680px] sm:max-h-[calc(100vh-40px)] sm:rounded-[28px] sm:border">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f43f5e]">animeTVplus live</p>
            <h2 className="mt-1 text-xl font-black text-white">Global Chat</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.06] text-white">
            <X size={18} />
          </button>
        </div>

        {!token ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <MessageCircle className="mx-auto text-[#f43f5e]" size={42} />
              <h3 className="mt-4 text-2xl font-black text-white">Login to chat</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">Create a username to join rooms, follow users, and share what you are watching.</p>
              <Link href="/login" className="mt-5 inline-flex h-11 items-center rounded-2xl bg-[#e11d48] px-5 text-sm font-black text-white">
                Sign in
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 border-b border-white/[0.08] p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {roomItems.map((item) => {
                  const name = text(item, "room", "global");
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setRoom(name)}
                      className={cn(
                        "shrink-0 rounded-2xl px-3 py-2 text-xs font-black capitalize transition",
                        room === name ? "bg-[#e11d48] text-white" : "bg-white/[0.06] text-white/70 hover:text-white",
                      )}
                    >
                      {roomLabel(name)}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={customRoom}
                  onChange={(event) => setCustomRoom(event.target.value)}
                  placeholder="Create anime/topic room"
                  className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.055] px-3 text-sm text-white outline-none focus:border-[#e11d48]/45"
                />
                <button type="button" onClick={joinCustomRoom} className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.08] text-white">
                  <Plus size={17} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[1fr_132px]">
              <div className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
                  <p className="line-clamp-1 text-sm font-black capitalize text-white">{roomLabel(room)}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                    <Radio size={11} /> {onlineUsers.length} online
                  </span>
                </div>
                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {messages.length ? (
                    <div className="grid gap-3">
                      {messages.map((item, index) => {
                        const own = String(item.user_id) === String(user?.id);
                        const meta = item.meta ?? {};
                        return (
                          <div key={`${item.id ?? index}-${item.created_at}`} className={cn("max-w-[88%] rounded-2xl px-3 py-2", own ? "ml-auto bg-[#e11d48] text-white" : "bg-white/[0.07] text-white")}>
                            <p className="text-[10px] font-black text-white/60">{item.username || "user"}</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-5">{item.message}</p>
                            {item.kind === "watching" && typeof meta.href === "string" ? (
                              <Link href={meta.href} className="mt-2 inline-block rounded-xl bg-black/24 px-2 py-1 text-[11px] font-black text-white">
                                Open episode
                              </Link>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center text-center text-sm text-white/45">No messages yet. Start the room.</div>
                  )}
                </div>
                <form onSubmit={submit} className="flex gap-2 border-t border-white/[0.08] p-3">
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Message everyone..."
                    className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-white outline-none focus:border-[#e11d48]/45"
                  />
                  <button type="submit" className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e11d48] text-white">
                    <Send size={17} />
                  </button>
                </form>
              </div>

              <aside className="hidden min-h-0 border-l border-white/[0.06] sm:block">
                <div className="border-b border-white/[0.06] p-3">
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/55"><Users size={12} /> Online</p>
                  <div className="max-h-24 overflow-y-auto">
                    {onlineUsers.map((row) => (
                      <button key={String(row.id)} type="button" onClick={() => startDirectChat(row)} className="block w-full truncate rounded-xl px-2 py-1 text-left text-xs font-bold text-white/78 hover:bg-white/[0.06]">
                        {text(row, "username", `User ${row.id}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white/55"><Search size={12} /> Find users</p>
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="username"
                    className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.055] px-2 text-xs text-white outline-none"
                  />
                  <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto">
                    {((searchUsers.data?.items ?? following.data?.items ?? []) as Record<string, unknown>[]).map((row) => (
                      <div key={String(row.id)} className="rounded-xl bg-white/[0.045] p-2">
                        <button type="button" onClick={() => startDirectChat(row)} className="flex w-full items-center gap-1 truncate text-left text-xs font-black text-white">
                          <AtSign size={11} /> {text(row, "username", `User ${row.id}`)}
                        </button>
                        <button type="button" onClick={() => follow.mutate(number(row, "id"))} className="mt-1 rounded-lg bg-[#e11d48]/18 px-2 py-1 text-[10px] font-black text-[#ff8da1]">
                          Follow
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
