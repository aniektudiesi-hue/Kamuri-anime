"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  CheckCheck,
  Circle,
  Hash,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { chatSocketUrl } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
type TypingUser = { id: string; username: string; expiresAt: number };
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

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function clock(value?: number) {
  if (!value) return "";
  return new Date(value * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function lastSeen(value?: number, nowSeconds = 0) {
  if (!value) return "last seen recently";
  const seconds = Math.max(0, nowSeconds - value);
  if (seconds < 45) return "online now";
  if (seconds < 3600) return `last seen ${Math.max(1, Math.floor(seconds / 60))} min ago`;
  if (seconds < 86400) return `last seen ${Math.floor(seconds / 3600)} hr ago`;
  return `last seen ${Math.floor(seconds / 86400)}d ago`;
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
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>({});
  const [nowMs, setNowMs] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  const rooms = useQuery({
    queryKey: ["chat", "rooms", token],
    queryFn: () => api.chatRooms(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 20,
  });

  const online = useQuery({
    queryKey: ["chat", "online", token],
    queryFn: () => api.chatOnline(token),
    enabled: true,
    staleTime: 1000,
    refetchInterval: 2_500,
    refetchIntervalInBackground: true,
  });

  const history = useQuery({
    queryKey: ["chat", "messages", token, room],
    queryFn: () => api.chatMessages(token, room, 160),
    enabled: Boolean(room && (token || room === "global")),
    staleTime: 1000 * 2,
  });

  const following = useQuery({
    queryKey: ["chat", "following", token],
    queryFn: () => api.followingUsers(token!),
    enabled: Boolean(token),
    staleTime: 1000 * 10,
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
      ].slice(-160));
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
    if (!token) return [{ room: "global", messages: 0 }];
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
    return Array.from(byId.values()).sort((a, b) => number(b, "last_seen_at") - number(a, "last_seen_at"));
  }, [online.data, roomOnline]);

  const messages = useMemo(() => {
    const merged = [...((history.data?.items ?? []) as ChatMessage[]), ...liveMessages];
    const byId = new Map<string, ChatMessage>();
    merged.forEach((item, index) => {
      byId.set(String(item.id ?? `${item.created_at}-${item.username}-${index}`), item);
    });
    return Array.from(byId.values()).slice(-220);
  }, [history.data, liveMessages]);

  const activeTypingUsers = useMemo(() => {
    return Object.values(typingUsers)
      .filter((item) => item.expiresAt > nowMs && String(item.id) !== String(user?.id))
      .slice(0, 3);
  }, [nowMs, typingUsers, user?.id]);

  const roomPresenceText = useMemo(() => {
    if (roomOnline.length) return `${roomOnline.length} live in this room`;
    if (onlineUsers.length) return `${onlineUsers.length} online across animeTVplus`;
    return "live status updating";
  }, [onlineUsers.length, roomOnline.length]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const node = listRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
    });
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
  }, []);

  useEffect(() => {
    setLiveMessages([]);
    setRoomOnline([]);
    setTypingUsers({});
    scrollToBottom("auto");
  }, [room, scrollToBottom]);

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
          const data = JSON.parse(event.data) as {
            type?: string;
            users?: Row[];
            user?: Row;
            is_typing?: boolean;
            message?: ChatMessage;
            messages?: ChatMessage[];
          };
          if (data.type === "online") setRoomOnline(data.users ?? []);
          if (data.type === "history") setLiveMessages(data.messages ?? []);
          if (data.type === "message" && data.message) {
            setLiveMessages((current) => [
              ...current.filter((item) => !(Number(item.id) < 0 && item.message === data.message?.message && String(item.user_id) === String(data.message?.user_id))),
              data.message!,
            ].slice(-160));
            setTypingUsers((current) => {
              const next = { ...current };
              delete next[String(data.message?.user_id ?? "")];
              return next;
            });
          }
          if (data.type === "typing" && data.user) {
            const id = String(data.user.id ?? "");
            if (!id) return;
            setTypingUsers((current) => {
              const next = { ...current };
              if (data.is_typing) {
                next[id] = {
                  id,
                  username: text(data.user, "username", "user"),
                  expiresAt: Date.now() + 3500,
                };
              } else {
                delete next[id];
              }
              return next;
            });
          }
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        if (!closed) reconnect = window.setTimeout(connect, 1200);
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
    scrollToBottom(messages.length > 20 ? "smooth" : "auto");
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!Object.keys(typingUsers).length) return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      setTypingUsers((current) => {
        const entries = Object.entries(current).filter(([, value]) => value.expiresAt > now);
        return Object.fromEntries(entries);
      });
    }, 1200);
    return () => window.clearInterval(tick);
  }, [typingUsers]);

  useEffect(() => {
    setNowMs(Date.now());
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  function sendMessage() {
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
    sendTyping(false);
    setLiveMessages((current) => [...current, optimistic].slice(-160));
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(body));
    } else {
      sendFallback.mutate(body);
    }
    setMessage("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    sendMessage();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  }

  function onMessageChange(value: string) {
    setMessage(value);
    if (!token) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 900) {
      lastTypingSentRef.current = now;
      sendTyping(Boolean(value.trim()));
    }
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(() => sendTyping(false), 1600);
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
      <section className="mx-auto grid h-[calc(100dvh-92px)] max-w-screen-2xl gap-3 overflow-hidden px-3 py-3 sm:px-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-6">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-[#070913]/95 shadow-[0_22px_80px_rgba(0,0,0,0.42)]">
          <div className="shrink-0 border-b border-white/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ff5b78]">animeTVplus</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Messages</h1>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e11d48] text-white shadow-lg shadow-[#e11d48]/25">
                <MessageCircle size={19} />
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.055] px-3 py-2">
              <Search size={16} className="text-white/42" />
              <input
                disabled={!token}
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder={token ? "Search users" : "Login to search users"}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36 disabled:opacity-55"
              />
            </div>
          </div>

          <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-white/[0.07] px-4 py-3 lg:block lg:max-h-[34%] lg:space-y-2 lg:overflow-y-auto">
            {roomItems.map((item) => {
              const name = text(item, "room", "global");
              const active = room === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setRoom(name)}
                  className={cn(
                    "flex min-w-[210px] items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:min-w-0 lg:w-full",
                    active ? "bg-[#e11d48] text-white shadow-lg shadow-[#e11d48]/18" : "bg-white/[0.045] text-white/76 hover:bg-white/[0.075] hover:text-white",
                  )}
                >
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", active ? "bg-white/18" : "bg-[#151827]")}>
                    <Hash size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black capitalize">{roomLabel(name)}</span>
                    <span className={cn("mt-0.5 block truncate text-[11px] font-semibold", active ? "text-white/72" : "text-white/40")}>
                      {name === room ? roomPresenceText : `${number(item, "messages")} saved messages`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-white/[0.07] p-4">
            {token ? (
              <div className="flex gap-2">
                <input
                  value={customRoom}
                  onChange={(event) => setCustomRoom(event.target.value)}
                  placeholder="Create anime/topic room"
                  className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/24 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/35"
                />
                <button onClick={joinCustomRoom} type="button" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08] text-white">
                  <Plus size={17} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="block rounded-2xl bg-[#e11d48] px-4 py-3 text-center text-sm font-black text-white">
                Login to join rooms
              </Link>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden border-t border-white/[0.07] p-4">
            <PeoplePanel
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              onlineUsers={onlineUsers}
              searchItems={(searchUsers.data?.items ?? following.data?.items ?? []) as Row[]}
              token={token}
              nowSeconds={Math.floor(nowMs / 1000)}
              startDirectChat={startDirectChat}
              followUser={(id) => follow.mutate(id)}
            />
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-[#05060a]/96 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#090b14]/92 px-4 py-3 backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#e11d48,#7f1d1d)] text-sm font-black text-white">
                {initials(roomLabel(room))}
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#090b14] bg-emerald-400" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black capitalize tracking-tight text-white">{roomLabel(room)}</h2>
                <p className="truncate text-xs font-semibold text-white/45">{roomPresenceText}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200 sm:flex">
              <Radio size={12} />
              Live
            </div>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[radial-gradient(circle_at_20%_0%,rgba(225,29,72,0.09),transparent_32%)] px-3 py-4 sm:px-5">
            {messages.length ? (
              <div className="space-y-3">
                {messages.map((item, index) => {
                  const own = String(item.user_id) === String(user?.id);
                  const meta = item.meta ?? {};
                  return (
                    <div key={`${item.id ?? index}-${item.created_at}`} className={cn("flex gap-2", own ? "justify-end" : "justify-start")}>
                      {!own ? (
                        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[10px] font-black text-white/70">
                          {initials(item.username || "user")}
                        </span>
                      ) : null}
                      <div className={cn("max-w-[82%] sm:max-w-[68%]", own ? "items-end" : "items-start")}>
                        {!own ? <p className="mb-1 px-1 text-[11px] font-black text-white/45">@{item.username || "user"}</p> : null}
                        <div
                          className={cn(
                            "rounded-[1.35rem] px-4 py-2.5 text-sm font-semibold leading-5 shadow-lg",
                            own
                              ? "rounded-br-md bg-[#e11d48] text-white shadow-[#e11d48]/12"
                              : "rounded-bl-md border border-white/[0.07] bg-white/[0.075] text-white/90 shadow-black/20",
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{item.message}</p>
                          {item.kind === "watching" && typeof meta.href === "string" ? (
                            <Link href={meta.href} className="mt-2 inline-flex rounded-xl bg-black/24 px-2.5 py-1.5 text-xs font-black text-white">
                              Open timestamp
                            </Link>
                          ) : null}
                        </div>
                        <p className={cn("mt-1 flex items-center gap-1 px-1 text-[10px] font-bold text-white/34", own ? "justify-end" : "justify-start")}>
                          {own ? <CheckCheck size={12} className="text-[#ffb3c0]" /> : null}
                          {own ? "Sent" : ""} {clock(item.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {activeTypingUsers.length ? (
                  <div className="flex items-center gap-2 pl-10 text-xs font-bold text-white/48">
                    <span className="flex h-8 items-center gap-1 rounded-full bg-white/[0.07] px-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:240ms]" />
                    </span>
                    {activeTypingUsers.map((item) => item.username).join(", ")} typing
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Sparkles className="mx-auto text-[#e11d48]" size={26} />
                  <h3 className="mt-3 text-lg font-black text-white">Start the conversation</h3>
                  <p className="mt-1 max-w-sm text-sm font-semibold text-white/44">
                    Messages are saved permanently, so new users can read the room history.
                  </p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="border-t border-white/[0.08] bg-[#090b14]/96 p-3 sm:p-4">
            {!token ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e11d48]/20 bg-[#e11d48]/10 px-4 py-3">
                <p className="text-sm font-bold text-white/76">Guests can read global chat. Login to send messages.</p>
                <Link href="/login" className="shrink-0 rounded-xl bg-[#e11d48] px-4 py-2 text-sm font-black text-white">
                  Login
                </Link>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(event) => onMessageChange(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Message this room..."
                  rows={1}
                  className="max-h-28 min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-[#e11d48]/50"
                />
                <button
                  disabled={!message.trim()}
                  type="submit"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e11d48] text-white shadow-lg shadow-[#e11d48]/20 transition disabled:bg-white/[0.08] disabled:text-white/35 disabled:shadow-none"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </form>
        </main>

      </section>
    </AppShell>
  );
}

function PeoplePanel({
  userSearch,
  setUserSearch,
  onlineUsers,
  searchItems,
  token,
  nowSeconds,
  startDirectChat,
  followUser,
}: {
  userSearch: string;
  setUserSearch: (value: string) => void;
  onlineUsers: Row[];
  searchItems: Row[];
  token: string | null;
  nowSeconds: number;
  startDirectChat: (row: Row) => void;
  followUser: (id: string | number) => void;
}) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/55">
          <Users size={14} /> Online now
        </p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {onlineUsers.length ? (
            onlineUsers.slice(0, 18).map((row) => (
              <button key={String(row.id)} type="button" onClick={() => startDirectChat(row)} className="w-20 shrink-0 text-center">
                <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.08] text-sm font-black text-white">
                  {initials(text(row, "username", `user${row.id}`))}
                  <span className="absolute bottom-0 right-1 h-3 w-3 rounded-full border-2 border-[#070913] bg-emerald-400" />
                </span>
                <span className="mt-1 block truncate text-[11px] font-bold text-white/70">{text(row, "username", `user${row.id}`)}</span>
              </button>
            ))
          ) : (
            <p className="rounded-2xl bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white/45">Live status is updating.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/55">
          <Search size={14} /> Find people
        </p>
        <input
          disabled={!token}
          value={userSearch}
          onChange={(event) => setUserSearch(event.target.value)}
          placeholder={token ? "Search username" : "Login to search"}
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-black/24 px-3 text-sm font-semibold text-white outline-none disabled:opacity-50"
        />
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
          {searchItems.map((row) => (
            <div key={String(row.id)} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] p-3">
              <button type="button" onClick={() => startDirectChat(row)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-black text-white">
                {initials(text(row, "username", `user${row.id}`))}
              </button>
              <button type="button" onClick={() => startDirectChat(row)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1 truncate text-sm font-black text-white">
                  <AtSign size={13} /> {text(row, "username", `user${row.id}`)}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/38">{lastSeen(number(row, "last_seen_at"), nowSeconds)}</span>
              </button>
              <button type="button" onClick={() => followUser(number(row, "id"))} className="rounded-xl bg-[#e11d48]/18 px-3 py-1.5 text-xs font-black text-[#ff8da1]">
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/55">
          <Circle size={10} className="fill-emerald-400 text-emerald-400" /> Status
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
          Online status refreshes every few seconds and websocket rooms update instantly while users are inside chat.
        </p>
      </div>
    </div>
  );
}
