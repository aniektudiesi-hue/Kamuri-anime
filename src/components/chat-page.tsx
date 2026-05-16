"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, CheckCheck, Hash, MessageCircle, Plus, Search, Send, Users } from "lucide-react";
import { Header } from "@/components/header";
import { api } from "@/lib/api";
import { chatSocketUrl } from "@/lib/chat";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
type Message = {
  id?: number;
  user_id?: number;
  username?: string;
  message?: string;
  kind?: string;
  meta?: Row;
  created_at?: number;
};
type TypingUser = { id: string; username: string; expiresAt: number };

const DEFAULT_ROOMS = ["global", "anime", "recommendations", "spoilers"];

function text(row: Row | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function num(row: Row | undefined, key: string, fallback = 0) {
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function label(room: string) {
  if (room.startsWith("dm:")) return "Direct chat";
  if (room.startsWith("anime:")) return room.replace("anime:", "Anime ");
  return room.replace(/[-_:]/g, " ");
}

function avatar(value = "A") {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function timeLabel(value?: number) {
  if (!value) return "";
  return new Date(value * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dmRoom(a: string | number, b: string | number) {
  return `dm:${[String(a), String(b)].sort().join(":")}`;
}

export function ChatPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [room, setRoom] = useState("global");
  const [customRoom, setCustomRoom] = useState("");
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [socketUsers, setSocketUsers] = useState<Row[]>([]);
  const [typing, setTyping] = useState<Record<string, TypingUser>>({});
  const [socketState, setSocketState] = useState<"connecting" | "live" | "offline">("connecting");
  const [nowMs, setNowMs] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingStopRef = useRef<number | null>(null);
  const lastTypingRef = useRef(0);

  const rooms = useQuery({
    queryKey: ["chat", "rooms", token],
    queryFn: () => api.chatRooms(token!),
    enabled: Boolean(token),
    staleTime: 10_000,
  });

  const history = useQuery({
    queryKey: ["chat", "messages", token, room],
    queryFn: () => api.chatMessages(token, room, 160),
    enabled: Boolean(token && room),
    staleTime: 1000,
  });

  const online = useQuery({
    queryKey: ["chat", "online", token],
    queryFn: () => api.chatOnline(token),
    enabled: Boolean(token),
    staleTime: 1000,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });

  const searchUsers = useQuery({
    queryKey: ["chat", "users", userSearch, token],
    queryFn: () => api.searchChatUsers(token!, userSearch),
    enabled: Boolean(token && userSearch.trim().length >= 2),
    staleTime: 10_000,
  });

  const following = useQuery({
    queryKey: ["chat", "following", token],
    queryFn: () => api.followingUsers(token!),
    enabled: Boolean(token),
    staleTime: 10_000,
  });

  const sendHttp = useMutation({
    mutationFn: (body: Row) => api.sendChatMessage(token!, room, body),
    onSuccess: (data) => {
      const saved = data.message as Message;
      setLiveMessages((current) => replaceOptimistic(current, saved));
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", token, room] });
    },
  });

  const follow = useMutation({
    mutationFn: (id: string | number) => api.followUser(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat", "following", token] }),
  });

  const roomItems = useMemo(() => {
    const seen = new Set<string>();
    return [...DEFAULT_ROOMS.map((name) => ({ room: name })), ...((rooms.data?.items ?? []) as Row[])].filter((item) => {
      const name = text(item, "room", "global");
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [rooms.data]);

  const onlineUsers = useMemo(() => {
    const map = new Map<string, Row>();
    ((online.data?.items ?? []) as Row[]).forEach((row) => map.set(String(row.id), row));
    socketUsers.forEach((row) => map.set(String(row.id), { ...map.get(String(row.id)), ...row }));
    return Array.from(map.values()).sort((a, b) => num(b, "last_seen_at") - num(a, "last_seen_at"));
  }, [online.data, socketUsers]);

  const messages = useMemo(() => {
    const map = new Map<string, Message>();
    [...((history.data?.items ?? []) as Message[]), ...liveMessages].forEach((item, index) => {
      map.set(String(item.id ?? `${item.user_id}-${item.created_at}-${item.message}-${index}`), item);
    });
    return Array.from(map.values()).slice(-220);
  }, [history.data, liveMessages]);

  const activeTyping = useMemo(() => {
    return Object.values(typing).filter((item) => item.expiresAt > nowMs && String(item.id) !== String(user?.id));
  }, [nowMs, typing, user?.id]);

  const scrollBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const node = listRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior });
    });
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
  }, []);

  useEffect(() => {
    setLiveMessages([]);
    setSocketUsers([]);
    setTyping({});
    setSocketState("connecting");
    scrollBottom("auto");
  }, [room, scrollBottom]);

  useEffect(() => {
    if (!token || !room) return;
    let closed = false;
    let reconnect: number | undefined;
    let heartbeat: number | undefined;

    const connect = () => {
      if (closed) return;
      setSocketState("connecting");
      const socket = new WebSocket(chatSocketUrl(room, token));
      socketRef.current = socket;

      socket.onopen = () => {
        setSocketState("live");
        heartbeat = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
        }, 15_000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; users?: Row[]; user?: Row; message?: Message; messages?: Message[]; is_typing?: boolean };
          if (data.type === "online") setSocketUsers(data.users ?? []);
          if (data.type === "history") setLiveMessages(data.messages ?? []);
          if (data.type === "message" && data.message) {
            setLiveMessages((current) => replaceOptimistic(current, data.message!));
            setTyping((current) => {
              const next = { ...current };
              delete next[String(data.message?.user_id ?? "")];
              return next;
            });
          }
          if (data.type === "typing" && data.user) {
            const id = String(data.user.id ?? "");
            if (!id) return;
            setTyping((current) => {
              const next = { ...current };
              if (data.is_typing) next[id] = { id, username: text(data.user, "username", "user"), expiresAt: Date.now() + 3000 };
              else delete next[id];
              return next;
            });
          }
        } catch {
          // ignore malformed websocket frame
        }
      };

      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (heartbeat) window.clearInterval(heartbeat);
        setSocketState("offline");
        if (!closed) reconnect = window.setTimeout(connect, 900);
      };
    };

    connect();
    return () => {
      closed = true;
      if (heartbeat) window.clearInterval(heartbeat);
      if (reconnect) window.clearTimeout(reconnect);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [room, token]);

  useEffect(() => scrollBottom(messages.length > 20 ? "smooth" : "auto"), [messages.length, scrollBottom]);

  useEffect(() => {
    if (activeTyping.length) scrollBottom("smooth");
  }, [activeTyping.length, scrollBottom]);

  useEffect(() => {
    setNowMs(Date.now());
    const tick = window.setInterval(() => setNowMs(Date.now()), 900);
    return () => window.clearInterval(tick);
  }, []);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = { message: message.trim(), kind: "text", meta: {} };
    if (!body.message || !token) return;
    const optimistic: Message = {
      id: -Date.now(),
      user_id: Number(user?.id || 0),
      username: user?.username || "you",
      message: body.message,
      kind: "text",
      meta: {},
      created_at: Math.floor(Date.now() / 1000),
    };
    setLiveMessages((current) => [...current, optimistic].slice(-180));
    setMessage("");
    sendTyping(false);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(body));
    else sendHttp.mutate(body);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submit();
  }

  function onChange(value: string) {
    setMessage(value);
    const now = Date.now();
    if (now - lastTypingRef.current > 700) {
      lastTypingRef.current = now;
      sendTyping(Boolean(value.trim()));
    }
    if (typingStopRef.current) window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(() => sendTyping(false), 1400);
  }

  function joinRoom() {
    const clean = customRoom.trim().toLowerCase().slice(0, 60);
    if (!clean) return;
    setRoom(clean);
    setCustomRoom("");
  }

  function startDm(row: Row) {
    const id = num(row, "id");
    if (!id || !user?.id) return;
    setRoom(dmRoom(user.id, id));
  }

  return (
    <>
      <div className="hidden lg:block">
        <Header />
      </div>
      <main className="h-dvh w-dvw max-w-[100dvw] overflow-hidden bg-[#03040a] text-white lg:h-[calc(100dvh-72px)] lg:px-4 lg:py-4">
        <section className="mx-auto grid h-full w-full min-w-0 max-w-[100dvw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#070913] shadow-[0_30px_110px_rgba(0,0,0,0.6)] lg:max-w-screen-2xl lg:rounded-[28px] lg:border lg:border-white/[0.08] lg:grid-cols-[360px_1fr] lg:grid-rows-1">
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-white/[0.08] lg:border-b-0 lg:border-r">
            <div className="hidden shrink-0 border-b border-white/[0.08] p-4 lg:block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#ff5b78]">animeTVplus</p>
                  <h1 className="mt-1 text-2xl font-black">Chats</h1>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-black", socketState === "live" ? "bg-emerald-400/12 text-emerald-200" : "bg-yellow-400/12 text-yellow-100")}>
                  {socketState === "live" ? "Live" : "Connecting"}
                </span>
              </div>
              <div className="mt-4 flex h-11 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.06] px-3">
                <Search size={16} className="text-white/42" />
                <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-white/35" />
              </div>
            </div>

            <div className="no-scrollbar flex w-full min-w-0 shrink-0 gap-1.5 overflow-x-auto overflow-y-hidden border-b border-white/[0.08] p-1.5 lg:block lg:max-h-[260px] lg:space-y-2 lg:overflow-y-auto lg:p-3">
              {roomItems.map((item) => {
                const name = text(item, "room", "global");
                const active = room === name;
                return (
                  <button key={name} type="button" onClick={() => setRoom(name)} className={cn("flex w-[31vw] max-w-[124px] shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition lg:w-full lg:max-w-none lg:min-w-0 lg:gap-3 lg:rounded-2xl lg:p-3", active ? "bg-[#e11d48] text-white" : "bg-white/[0.045] text-white/74 hover:bg-white/[0.075]")}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/20 lg:h-11 lg:w-11"><Hash size={13} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-black capitalize lg:text-sm">{label(name)}</span>
                      <span className="mt-0.5 hidden text-[11px] font-semibold opacity-65 lg:block">{num(item, "messages")} saved messages</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hidden shrink-0 gap-2 border-b border-white/[0.08] p-3 lg:flex">
              <input value={customRoom} onChange={(event) => setCustomRoom(event.target.value)} placeholder="Create room" className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/24 px-3 text-sm font-semibold outline-none placeholder:text-white/35" />
              <button type="button" onClick={joinRoom} className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.08]"><Plus size={17} /></button>
            </div>

            <div className="hidden min-h-0 flex-1 overflow-y-auto p-3 lg:block">
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/45"><Users size={14} /> Online</p>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {onlineUsers.slice(0, 20).map((row) => (
                  <button key={String(row.id)} type="button" onClick={() => startDm(row)} className="w-20 shrink-0 text-center">
                    <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.08] text-sm font-black">
                      {avatar(text(row, "username", "user"))}
                      <span className="absolute bottom-0 right-1 h-3 w-3 rounded-full border-2 border-[#070913] bg-emerald-400" />
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-bold text-white/68">{text(row, "username", `user${row.id}`)}</span>
                  </button>
                ))}
              </div>

              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/45"><AtSign size={14} /> People</p>
              <div className="grid gap-2">
                {((searchUsers.data?.items ?? following.data?.items ?? []) as Row[]).map((row) => (
                  <button key={String(row.id)} type="button" onClick={() => startDm(row)} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] p-3 text-left hover:bg-white/[0.075]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-xs font-black">{avatar(text(row, "username", "user"))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black">{text(row, "username", `user${row.id}`)}</span>
                      <span className="text-[11px] font-semibold text-white/38">Tap to message</span>
                    </span>
                    <span onClick={(event) => { event.stopPropagation(); follow.mutate(num(row, "id")); }} className="rounded-xl bg-[#e11d48]/18 px-2 py-1 text-[11px] font-black text-[#ff8da1]">Follow</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#090b14]/95 px-2.5 py-2 lg:px-4 lg:py-3">
              <div className="flex min-w-0 items-center gap-2 lg:gap-3">
                <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#e11d48,#7f1d1d)] text-[10px] font-black lg:h-12 lg:w-12 lg:text-sm">
                  {avatar(label(room))}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#090b14] bg-emerald-400 lg:h-3.5 lg:w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-black capitalize lg:text-lg">{label(room)}</h2>
                  <p className="truncate text-[10px] font-semibold text-white/45 lg:text-xs">{socketUsers.length || onlineUsers.length} online now</p>
                </div>
              </div>
              <MessageCircle size={17} className="text-white/38 lg:size-[19px]" />
            </header>

            <div ref={listRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(225,29,72,0.08),transparent_30%)] px-2.5 py-2.5 lg:px-5 lg:py-4">
              <div className="min-w-0 space-y-2.5 lg:space-y-3">
                {messages.map((item, index) => {
                  const own = String(item.user_id) === String(user?.id);
                  const meta = item.meta ?? {};
                  return (
                    <div key={`${item.id ?? index}-${item.created_at}-${item.message}`} className={cn("flex gap-2", own ? "justify-end" : "justify-start")}>
                      {!own ? <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[9px] font-black lg:h-8 lg:w-8 lg:text-[10px]">{avatar(item.username || "user")}</span> : null}
                      <div className={cn("max-w-[88%] lg:max-w-[66%]", own ? "text-right" : "text-left")}>
                        {!own ? <p className="mb-1 px-1 text-[11px] font-black text-white/42">@{item.username || "user"}</p> : null}
                        <div className={cn("inline-block rounded-[1.05rem] px-3 py-1.5 text-left text-[13px] font-semibold leading-5 shadow-lg lg:rounded-[1.35rem] lg:px-4 lg:py-2.5 lg:text-sm", own ? "rounded-br-md bg-[#e11d48] text-white" : "rounded-bl-md border border-white/[0.07] bg-white/[0.075] text-white/92")}>
                          <p className="whitespace-pre-wrap break-words">{item.message}</p>
                          {item.kind === "watching" && typeof meta.href === "string" ? <Link href={meta.href} className="mt-2 inline-flex rounded-xl bg-black/24 px-2.5 py-1 text-xs font-black">Open timestamp</Link> : null}
                        </div>
                        <p className="mt-1 flex items-center justify-end gap-1 px-1 text-[10px] font-bold text-white/32">
                          {own ? <CheckCheck size={12} className="text-[#ffb3c0]" /> : null}
                          {own ? "Sent" : ""} {timeLabel(item.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {activeTyping.length ? (
                  <div className="flex items-center gap-2 pl-8 text-[11px] font-bold text-white/55 lg:pl-10 lg:text-xs">
                    <span className="flex h-7 items-center gap-1 rounded-full bg-white/[0.07] px-2.5 lg:h-8 lg:px-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:240ms]" />
                    </span>
                    {activeTyping.map((item) => item.username).join(", ")} typing
                  </div>
                ) : null}
                {!messages.length ? (
                  <div className="grid h-[42vh] place-items-center text-center text-white/45">
                    <div>
                      <MessageCircle className="mx-auto text-[#e11d48]" />
                      <p className="mt-3 text-sm font-bold">No messages yet. Start this room.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <form onSubmit={submit} className="shrink-0 border-t border-white/[0.08] bg-[#090b14] p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:p-3">
              <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.055] p-1.5 lg:items-end lg:gap-2 lg:rounded-[1.35rem] lg:p-2">
                <textarea value={message} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} rows={1} placeholder="Message..." className="max-h-20 min-h-8 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] font-semibold leading-5 outline-none placeholder:text-white/35 lg:max-h-28 lg:min-h-10 lg:py-2 lg:text-sm" />
                <button disabled={!message.trim()} type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e11d48] text-white disabled:bg-white/[0.08] disabled:text-white/30 lg:h-10 lg:w-10">
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-1.5 hidden text-center text-[11px] font-semibold text-white/30 lg:block">Press Enter to send, Shift+Enter for a new line.</p>
            </form>
          </section>
        </section>
      </main>
    </>
  );
}

function replaceOptimistic(current: Message[], saved: Message) {
  return [
    ...current.filter((item) => !(Number(item.id) < 0 && item.message === saved.message && String(item.user_id) === String(saved.user_id))),
    saved,
  ].slice(-180);
}
