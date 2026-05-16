"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, Plus, Radio, Search, Send, Settings2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { chatSocketUrl } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
type ChatMessage = {
  id?: number;
  user_id?: number;
  username?: string;
  message?: string;
  kind?: string;
  meta?: Row;
  created_at?: number;
};

const DEFAULT_ROOMS = ["global", "anime", "recommendations", "spoilers"];

function text(row: Row | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function number(row: Row | undefined, key: string, fallback = 0) {
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

export function ChatPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [room, setRoom] = useState("global");
  const [customRoom, setCustomRoom] = useState("");
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [roomOnline, setRoomOnline] = useState<Row[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rooms = useQuery({
    queryKey: ["chat", "rooms", token],
    queryFn: () => api.chatRooms(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 30,
  });

  const online = useQuery({
    queryKey: ["chat", "online", token],
    queryFn: () => api.chatOnline(token),
    enabled: true,
    staleTime: 1000 * 5,
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });

  const history = useQuery({
    queryKey: ["chat", "messages", token, room],
    queryFn: () => api.chatMessages(token, room, 120),
    enabled: Boolean(room && (token || room === "global")),
    staleTime: 1000 * 5,
  });

  const following = useQuery({
    queryKey: ["chat", "following", token],
    queryFn: () => api.followingUsers(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 15,
  });

  const searchUsers = useQuery({
    queryKey: ["chat", "user-search", token, userSearch],
    queryFn: () => api.searchChatUsers(token!, userSearch),
    enabled: Boolean(token && userSearch.trim().length >= 2),
    staleTime: 1000 * 10,
  });

  const sendFallback = useMutation({
    mutationFn: (body: Row) => api.sendChatMessage(token!, room, body),
    onSuccess: (data, body) => {
      const saved = data.message as ChatMessage;
      setLiveMessages((current) => [
        ...current.filter((item) => !(Number(item.id) < 0 && item.message === body.message)),
        saved,
      ].slice(-120));
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", token, room] });
    },
  });

  const follow = useMutation({
    mutationFn: (id: string | number) => api.followUser(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "following", token] });
      queryClient.invalidateQueries({ queryKey: ["chat", "user-search", token] });
    },
  });

  const roomItems = useMemo(() => {
    if (!token) return [{ room: "global" }];
    const seen = new Set<string>();
    return [
      ...DEFAULT_ROOMS.map((name) => ({ room: name })),
      ...((rooms.data?.items ?? []) as Row[]),
    ].filter((item) => {
      const name = text(item, "room", "global");
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [rooms.data, token]);

  const onlineUsers = useMemo(() => {
    const byId = new Map<string, Row>();
    ((online.data?.items ?? []) as Row[]).forEach((row) => byId.set(String(row.id), row));
    roomOnline.forEach((row) => byId.set(String(row.id), { ...byId.get(String(row.id)), ...row }));
    return Array.from(byId.values());
  }, [online.data, roomOnline]);

  const messages = useMemo(() => {
    const merged = [...((history.data?.items ?? []) as ChatMessage[]), ...liveMessages];
    const byId = new Map<string, ChatMessage>();
    merged.forEach((item, index) => byId.set(String(item.id ?? `${item.created_at}-${item.username}-${index}`), item));
    return Array.from(byId.values()).slice(-180);
  }, [history.data, liveMessages]);

  useEffect(() => {
    setLiveMessages([]);
    setRoomOnline([]);
  }, [room]);

  useEffect(() => {
    if (!token || !room) return;
    let closed = false;
    let reconnect: number | undefined;
    const connect = () => {
      if (closed) return;
      const socket = new WebSocket(chatSocketUrl(room, token));
      socketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; users?: Row[]; message?: ChatMessage; messages?: ChatMessage[] };
          if (data.type === "online") setRoomOnline(data.users ?? []);
          if (data.type === "history") setLiveMessages(data.messages ?? []);
          if (data.type === "message" && data.message) setLiveMessages((current) => [...current, data.message!].slice(-120));
        } catch {
          // Ignore malformed frames.
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
  }, [room, token]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { message: message.trim(), kind: "text", meta: {} };
    if (!body.message || !token) return;
    const optimistic: ChatMessage = {
      id: -Date.now(),
      user_id: Number(user?.id || 0),
      username: user?.username || "you",
      message: body.message,
      kind: "text",
      meta: {},
      created_at: Math.floor(Date.now() / 1000),
    };
    setLiveMessages((current) => [...current, optimistic].slice(-120));
    sendFallback.mutate(body);
    setMessage("");
  }

  function joinCustomRoom() {
    const clean = customRoom.trim().toLowerCase().slice(0, 60);
    if (!clean) return;
    setRoom(clean);
    setCustomRoom("");
  }

  function startDirectChat(row: Row) {
    const id = number(row, "id");
    if (!id || !user?.id) return;
    setRoom(directRoom(user.id, id));
  }

  return (
    <AppShell>
      <section className="mx-auto grid min-h-[calc(100vh-92px)] max-w-screen-2xl gap-4 px-4 py-5 lg:grid-cols-[280px_1fr_300px] lg:px-6">
        <>
            <aside className="rounded-[1.75rem] border border-white/[0.08] bg-[#0b0e18]/92 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-black text-white">Chat</h1>
                <Settings2 size={18} className="text-white/45" />
              </div>
              <div className="grid gap-2">
                {roomItems.map((item) => {
                  const name = text(item, "room", "global");
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setRoom(name)}
                      className={cn(
                        "rounded-2xl px-3 py-3 text-left text-sm font-black capitalize transition",
                        room === name ? "bg-[#e11d48] text-white" : "bg-white/[0.055] text-white/70 hover:text-white",
                      )}
                    >
                      {roomLabel(name)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-2">
                <input disabled={!token} value={customRoom} onChange={(e) => setCustomRoom(e.target.value)} placeholder="anime/topic room" className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/24 px-3 text-sm text-white outline-none disabled:opacity-50" />
                <button disabled={!token} onClick={joinCustomRoom} type="button" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08] text-white disabled:opacity-40"><Plus size={17} /></button>
              </div>
            </aside>

            <main className="flex min-h-[620px] flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#080a12]/95">
              <div className="flex items-center justify-between border-b border-white/[0.08] p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f43f5e]">Room</p>
                  <h2 className="text-xl font-black capitalize text-white">{roomLabel(room)}</h2>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  <Radio size={12} /> {onlineUsers.length} online
                </span>
              </div>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
                {messages.length ? (
                  <div className="grid gap-3">
                    {messages.map((item, index) => {
                      const own = String(item.user_id) === String(user?.id);
                      const meta = item.meta ?? {};
                      return (
                        <div key={`${item.id ?? index}-${item.created_at}`} className={cn("max-w-[82%] rounded-2xl px-4 py-3", own ? "ml-auto bg-[#e11d48] text-white" : "bg-white/[0.07] text-white")}>
                          <p className="text-[11px] font-black text-white/62">@{item.username || "user"}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-5">{item.message}</p>
                          {item.kind === "watching" && typeof meta.href === "string" ? (
                            <Link href={meta.href} className="mt-2 inline-block rounded-xl bg-black/24 px-2.5 py-1.5 text-xs font-black text-white">Open timestamp</Link>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center text-center text-white/45">No messages yet. Be first in this room.</div>
                )}
              </div>
              <form onSubmit={submit} className="flex gap-2 border-t border-white/[0.08] p-4">
                <input disabled={!token} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={token ? "Message this room..." : "Login to send messages"} className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-white outline-none focus:border-[#e11d48]/45 disabled:opacity-60" />
                {token ? null : <Link href="/login" className="grid h-12 place-items-center rounded-2xl bg-white/[0.08] px-4 text-sm font-black text-white">Login</Link>}
                <button disabled={!token} type="submit" className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e11d48] text-white disabled:opacity-40"><Send size={18} /></button>
              </form>
            </main>

            <aside className="rounded-[1.75rem] border border-white/[0.08] bg-[#0b0e18]/92 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/55"><Users size={14} /> Online users</p>
              <div className="mb-5 grid max-h-52 gap-2 overflow-y-auto">
                {onlineUsers.map((row) => (
                  <button key={String(row.id)} type="button" onClick={() => startDirectChat(row)} className="rounded-2xl bg-white/[0.055] px-3 py-2 text-left text-sm font-black text-white/82 hover:bg-white/[0.08]">
                    @{text(row, "username", `user${row.id}`)}
                    <span className="mt-1 block text-[11px] font-semibold text-white/38">{text(row, "path", "online now")}</span>
                  </button>
                ))}
              </div>
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/55"><Search size={14} /> Search users</p>
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="username" className="h-11 w-full rounded-2xl border border-white/[0.08] bg-black/24 px-3 text-sm text-white outline-none" />
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                {((searchUsers.data?.items ?? following.data?.items ?? []) as Row[]).map((row) => (
                  <div key={String(row.id)} className="rounded-2xl bg-white/[0.045] p-3">
                    <button type="button" onClick={() => startDirectChat(row)} className="flex w-full items-center gap-1 truncate text-left text-sm font-black text-white">
                      <AtSign size={13} /> {text(row, "username", `user${row.id}`)}
                    </button>
                    <button type="button" onClick={() => follow.mutate(number(row, "id"))} className="mt-2 rounded-xl bg-[#e11d48]/18 px-3 py-1.5 text-xs font-black text-[#ff8da1]">Follow</button>
                  </div>
                ))}
              </div>
            </aside>
          </>
      </section>
    </AppShell>
  );
}
