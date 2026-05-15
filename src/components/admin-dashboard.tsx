"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bookmark,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  Globe2,
  ListVideo,
  Lock,
  MapPin,
  MonitorSmartphone,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Row = Record<string, unknown>;

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function number(row: Row, key: string) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function formatTime(value: unknown) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return "Never";
  return new Date(ts * 1000).toLocaleString();
}

function lastSeenSeconds(row: Row) {
  const value = Number(row.last_seen_at);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isOnline(row: Row, nowMs: number) {
  const lastSeen = lastSeenSeconds(row);
  return lastSeen > 0 && nowMs / 1000 - lastSeen <= 90;
}

function lastSeenLabel(value: unknown, nowMs: number) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return "Never";
  const diff = Math.max(0, Math.floor(nowMs / 1000 - ts));
  if (diff < 15) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatTime(ts);
}

function PresenceBadge({ row, nowMs }: { row: Row; nowMs: number }) {
  const online = isOnline(row, nowMs);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${
        online
          ? "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/20"
          : "bg-white/[0.045] text-white/42 ring-1 ring-white/[0.06]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" : "bg-white/24"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function formatBytes(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function asItems(data: unknown): Row[] {
  if (!data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Row[]) : [];
}

function arrayFrom(data: unknown, key: string): Row[] {
  if (!data || typeof data !== "object") return [];
  const value = (data as Row)[key];
  return Array.isArray(value) ? (value as Row[]) : [];
}

function objectFrom(data: unknown, key: string): Row {
  if (!data || typeof data !== "object") return {};
  const value = (data as Row)[key];
  return value && typeof value === "object" ? (value as Row) : {};
}

function locationLabel(row: Row) {
  const label = [text(row, "city"), text(row, "region"), text(row, "country")].filter(Boolean).join(", ");
  return label || text(row, "timezone") || text(row, "language") || "Unknown";
}

export function AdminDashboard() {
  const { token, user } = useAuth();
  const [adminKey, setAdminKey] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setAdminKey(localStorage.getItem("animetv_admin_key") || "");
    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const overview = useQuery({
    queryKey: ["admin", "overview", token, adminKey],
    queryFn: () => api.adminOverview(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const users = useQuery({
    queryKey: ["admin", "users", token, adminKey],
    queryFn: () => api.adminUsers(token!, adminKey, 150),
    enabled: Boolean(token),
    staleTime: 1000 * 20,
    refetchInterval: 15_000,
    retry: false,
  });
  const logins = useQuery({
    queryKey: ["admin", "logins", token, adminKey],
    queryFn: () => api.adminLogins(token!, adminKey, 80),
    enabled: Boolean(token),
    staleTime: 1000 * 20,
    retry: false,
  });
  const visits = useQuery({
    queryKey: ["admin", "visits", token, adminKey],
    queryFn: () => api.adminVisits(token!, adminKey, 100),
    enabled: Boolean(token),
    staleTime: 1000 * 20,
    refetchInterval: 15_000,
    retry: false,
  });
  const visibility = useQuery({
    queryKey: ["admin", "search-visibility", token, adminKey],
    queryFn: () => api.adminSearchVisibility(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["admin", "user-activity", token, adminKey, selectedUserId],
    queryFn: () => api.adminUserActivity(token!, selectedUserId!, adminKey, 500),
    enabled: Boolean(token && selectedUserId),
    staleTime: 1000 * 15,
    retry: false,
  });

  const userRows = useMemo(() => asItems(users.data), [users.data]);
  const onlineUsers = userRows.filter((row) => isOnline(row, nowMs)).length;

  const anyError = overview.error || users.error || logins.error || visits.error;
  const overviewData = overview.data ?? {};
  const topPaths = arrayFrom(overviewData, "top_paths");
  const topLocations = arrayFrom(overviewData, "top_locations");
  const topDevices = arrayFrom(overviewData, "top_devices");

  return (
    <AppShell>
      <section className="mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
        <div className="mb-7 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#090b13]/90 shadow-2xl shadow-black/30">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#cf2442]/80 to-transparent" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#cf2442]/25 bg-[#cf2442]/10 px-3 py-1 text-xs font-black text-[#ffd7dd]">
                  <ShieldCheck size={14} />
                  Private owner route
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">AnimeTV Admin Control</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/48">
                  Users, logins, page visits, approximate location, device fingerprints, library activity, and SEO shortcuts in one private dashboard.
                </p>
              </div>
              {user ? (
                <div className="w-full max-w-sm rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3">
                  <p className="mb-2 text-xs font-bold text-white/38">
                    Logged in as <span className="text-white">{user.username}</span>
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={adminKey}
                      onChange={(event) => setAdminKey(event.target.value)}
                      placeholder="Optional admin key"
                      type="password"
                      className="h-9 border-white/[0.08] bg-black/25 text-sm text-white"
                    />
                    <Button
                      type="button"
                      className="h-9 rounded-xl bg-[#cf2442] px-3 text-xs font-black text-white hover:bg-[#dc2d4b]"
                      onClick={() => localStorage.setItem("animetv_admin_key", adminKey)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {!token ? (
          <EmptyAdmin
            icon={<Lock size={22} />}
            title="Login required"
            body="Sign in with the owner username to open admin controls."
            action={<ButtonLink href="/login">Login</ButtonLink>}
          />
        ) : anyError ? (
          <EmptyAdmin
            icon={<Lock size={22} />}
            title="Admin access blocked"
            body="This dashboard is restricted to the hardcoded owner username on the backend."
            action={<ButtonLink href="/login">Switch username</ButtonLink>}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StatCard icon={<UserRound size={18} />} label="Users" value={overviewData.total_users} loading={overview.isLoading} />
              <StatCard icon={<Activity size={18} />} label="Online" value={onlineUsers} loading={users.isLoading} />
              <StatCard icon={<Activity size={18} />} label="Visits" value={overviewData.total_visits} loading={overview.isLoading} />
              <StatCard icon={<Globe2 size={18} />} label="Unique" value={overviewData.unique_visitors} loading={overview.isLoading} />
              <StatCard icon={<Clock3 size={18} />} label="24h Visits" value={overviewData.visits_24h} loading={overview.isLoading} />
              <StatCard icon={<Eye size={18} />} label="24h Unique" value={overviewData.unique_24h} loading={overview.isLoading} />
              <StatCard icon={<MapPin size={18} />} label="Locations" value={overviewData.known_locations} loading={overview.isLoading} />
              <StatCard icon={<Lock size={18} />} label="Failed" value={overviewData.login_failed} loading={overview.isLoading} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Users database" icon={<UserRound size={16} />} loading={users.isLoading}>
                <Table
                  rows={userRows}
                  initialRows={24}
                  columns={[
                    [
                      "Username",
                      (row) => {
                        const id = number(row, "id");
                        const active = selectedUserId === id;
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(id)}
                            className={`rounded-xl px-3 py-1.5 text-left font-black transition ${
                              active ? "bg-[#cf2442] text-white" : "bg-white/[0.045] text-white hover:bg-white/[0.08]"
                            }`}
                          >
                            {text(row, "username")}
                          </button>
                        );
                      },
                    ],
                    ["Status", (row) => <PresenceBadge row={row} nowMs={nowMs} />],
                    ["Joined", (row) => formatTime(row.created_at)],
                    ["Last seen", (row) => lastSeenLabel(row.last_seen_at, nowMs)],
                    ["Last login", (row) => formatTime(row.last_login_at)],
                    ["Last watched", (row) => formatTime(row.last_watched_at)],
                    ["Location", (row) => locationLabel(row)],
                    ["Device", (row) => text(row, "last_device", "-")],
                    ["IP", (row) => text(row, "last_ip", "-")],
                    ["History", (row) => number(row, "history_count")],
                    ["Watchlist", (row) => number(row, "watchlist_count")],
                    ["Downloads", (row) => number(row, "downloads_count")],
                  ]}
                />
              </Panel>

              <div className="grid gap-5">
                <Panel title="Top locations" icon={<MapPin size={16} />} loading={overview.isLoading}>
                <Table
                  rows={topLocations}
                  initialRows={8}
                    columns={[
                      ["Approx location", (row) => <span className="font-bold text-white/78">{text(row, "label", locationLabel(row))}</span>],
                      ["Visits", (row) => number(row, "visits")],
                      ["Unique", (row) => number(row, "unique_visitors")],
                    ]}
                  />
                </Panel>

                <Panel title="Top devices" icon={<MonitorSmartphone size={16} />} loading={overview.isLoading}>
                <Table
                  rows={topDevices}
                  initialRows={8}
                    columns={[
                      ["Device", (row) => <span className="font-bold text-white/78">{text(row, "device", "Unknown")}</span>],
                      ["Visits", (row) => number(row, "visits")],
                      ["Unique", (row) => number(row, "unique_visitors")],
                    ]}
                  />
                </Panel>
              </div>
            </div>

            <UserActivityPanel
              data={activity.data}
              loading={activity.isLoading}
              selectedUserId={selectedUserId}
              error={activity.error}
              nowMs={nowMs}
            />

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <Panel title="Top pages" icon={<Activity size={16} />} loading={overview.isLoading}>
                <Table
                  rows={topPaths}
                  initialRows={8}
                  columns={[
                    ["Path", (row) => <span className="line-clamp-1 font-semibold text-white/80">{text(row, "path", "/")}</span>],
                    ["Visits", (row) => number(row, "visits")],
                    ["Unique", (row) => number(row, "unique_visitors")],
                  ]}
                />
              </Panel>

              <Panel title="Recent logins" icon={<Lock size={16} />} loading={logins.isLoading}>
                <Table
                  rows={asItems(logins.data)}
                  initialRows={14}
                  columns={[
                    ["User", (row) => text(row, "username", "-")],
                    [
                      "Status",
                      (row) => (
                        <Badge className={number(row, "success") ? "bg-[#143b2a] text-[#9ff2c1]" : "bg-[#3b1620] text-[#ffb5c3]"}>
                          {number(row, "success") ? "success" : "failed"}
                        </Badge>
                      ),
                    ],
                    ["Location", (row) => locationLabel(row)],
                    ["Device", (row) => text(row, "device", "-")],
                    ["Time", (row) => formatTime(row.created_at)],
                  ]}
                />
              </Panel>

              <Panel title="Recent visitors" icon={<MonitorSmartphone size={16} />} loading={visits.isLoading}>
                <Table
                  rows={asItems(visits.data)}
                  initialRows={14}
                  columns={[
                    ["Path", (row) => <span className="line-clamp-1">{text(row, "path", "/")}</span>],
                    ["User", (row) => text(row, "username", "Guest")],
                    ["Location", (row) => locationLabel(row)],
                    ["Device", (row) => text(row, "device", "-")],
                    ["Time", (row) => formatTime(row.created_at)],
                  ]}
                />
              </Panel>
            </div>

            <Panel title="Google ranking controls" icon={<Search size={16} />} loading={visibility.isLoading} className="mt-6">
              <p className="mb-4 text-sm leading-6 text-white/44">
                Ranking numbers should come from Google Search Console. These shortcuts help you inspect indexed pages and target keywords without risky scraping or fake backlinks.
              </p>
              <div className="flex flex-wrap gap-2">
                {arrayFrom(visibility.data, "links").map((link) => (
                  <Link
                    key={text(link, "url")}
                    href={text(link, "url")}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-sm font-bold text-white/60 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white"
                  >
                    {text(link, "label")}
                    <ExternalLink size={13} />
                  </Link>
                ))}
              </div>
            </Panel>
          </>
        )}
      </section>
    </AppShell>
  );
}

function UserActivityPanel({
  data,
  loading,
  selectedUserId,
  error,
  nowMs,
}: {
  data?: Record<string, unknown>;
  loading: boolean;
  selectedUserId: number | null;
  error: Error | null;
  nowMs: number;
}) {
  const selectedUser = objectFrom(data, "user");
  const history = arrayFrom(data, "history");
  const watchlist = arrayFrom(data, "watchlist");
  const downloads = arrayFrom(data, "downloads");
  const logins = arrayFrom(data, "logins");
  const visits = arrayFrom(data, "visits");
  const totals = objectFrom(data, "totals");

  return (
    <Panel
      title={selectedUserId ? `User activity ${text(selectedUser, "username", `#${selectedUserId}`)}` : "User activity"}
      icon={<Activity size={16} />}
      loading={loading}
      className="mt-6"
    >
      {!selectedUserId ? (
        <div className="rounded-2xl border border-white/[0.055] bg-white/[0.03] p-5 text-sm text-white/38">
          Pick any username above to inspect full activity.
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#cf2442]/20 bg-[#cf2442]/10 p-5 text-sm text-[#ffd7dd]">
          Could not load this user activity yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <MiniStat label="Username" value={text(selectedUser, "username", "-")} />
            <MiniStat label="Status" value={isOnline(selectedUser, nowMs) ? "Online now" : "Offline"} />
            <MiniStat label="Joined" value={formatTime(selectedUser.created_at)} />
            <MiniStat label="Last seen" value={lastSeenLabel(selectedUser.last_seen_at, nowMs)} />
            <MiniStat label="History" value={String(number(totals, "history") || number(selectedUser, "history_count"))} />
            <MiniStat label="Visits" value={String(number(totals, "visits") || visits.length)} />
            <MiniStat label="Logins" value={String(number(totals, "logins") || logins.length)} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <ActivitySection title="Watch history" icon={<ListVideo size={15} />}>
              <Table
                rows={history}
                initialRows={8}
                columns={[
                  ["Anime", (row) => <span className="font-bold text-white/80">{text(row, "title", text(row, "mal_id", "-"))}</span>],
                  ["Ep", (row) => number(row, "episode")],
                  ["Timestamp", (row) => `${Math.floor(number(row, "playback_pos") / 60)}m ${Math.floor(number(row, "playback_pos") % 60)}s`],
                  ["Watched", (row) => formatTime(row.watched_at)],
                ]}
              />
            </ActivitySection>

            <ActivitySection title="Visits" icon={<Eye size={15} />}>
              <Table
                rows={visits}
                initialRows={8}
                columns={[
                  ["Path", (row) => <span className="line-clamp-1">{text(row, "path", "/")}</span>],
                  ["Location", (row) => locationLabel(row)],
                  ["Screen", (row) => text(row, "screen", "-")],
                  ["Time", (row) => formatTime(row.created_at)],
                ]}
              />
            </ActivitySection>

            <ActivitySection title="Logins" icon={<Lock size={15} />}>
              <Table
                rows={logins}
                initialRows={8}
                columns={[
                  ["Event", (row) => text(row, "event_type", "login")],
                  [
                    "Status",
                    (row) => (
                      <Badge className={number(row, "success") ? "bg-[#143b2a] text-[#9ff2c1]" : "bg-[#3b1620] text-[#ffb5c3]"}>
                        {number(row, "success") ? "success" : "failed"}
                      </Badge>
                    ),
                  ],
                  ["IP", (row) => text(row, "ip_address", "-")],
                  ["Location", (row) => locationLabel(row)],
                  ["Time", (row) => formatTime(row.created_at)],
                ]}
              />
            </ActivitySection>

            <ActivitySection title="Saved library" icon={<Bookmark size={15} />}>
              <Table
                rows={watchlist}
                initialRows={8}
                columns={[
                  ["Anime", (row) => <span className="font-bold text-white/80">{text(row, "title", text(row, "mal_id", "-"))}</span>],
                  ["Episodes", (row) => number(row, "episodes") || "-"],
                  ["Added", (row) => formatTime(row.added_at)],
                ]}
              />
            </ActivitySection>

            <ActivitySection title="Downloads metadata" icon={<Download size={15} />}>
              <Table
                rows={downloads}
                initialRows={8}
                columns={[
                  ["Anime", (row) => <span className="font-bold text-white/80">{text(row, "title", text(row, "mal_id", "-"))}</span>],
                  ["Ep", (row) => number(row, "episode")],
                  ["Size", (row) => formatBytes(row.size_bytes)],
                  ["Saved", (row) => formatTime(row.downloaded_at)],
                ]}
              />
            </ActivitySection>
          </div>
        </div>
      )}
    </Panel>
  );
}

function EmptyAdmin({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action: ReactNode }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#cf2442]/15 text-[#ff8ca0]">{icon}</div>
        <h2 className="mt-4 text-2xl font-black text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/42">{body}</p>
        <div className="mt-5">{action}</div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: ReactNode; label: string; value: unknown; loading?: boolean }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-[#cf2442]/14 text-[#ff8ca0]">{icon}</div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/28">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-20 bg-white/[0.06]" /> : <p className="mt-1 text-3xl font-black text-white">{String(value ?? 0)}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.055] bg-white/[0.035] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white/82">{value}</p>
    </div>
  );
}

function ActivitySection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.055] bg-black/15">
      <div className="flex items-center gap-2 border-b border-white/[0.045] px-3 py-2">
        <span className="text-[#ff8ca0]">{icon}</span>
        <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white/44">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Panel({
  title,
  icon,
  loading,
  children,
  className = "",
}: {
  title: string;
  icon: ReactNode;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`content-visibility-auto overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 shadow-xl shadow-black/20 ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.055] px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.045] text-[#ff8ca0]">{icon}</span>
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-white/58">{title}</h2>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-xl bg-white/[0.055]" />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Table({
  rows,
  columns,
  initialRows = 12,
  stepRows = 12,
}: {
  rows: Row[];
  columns: [string, (row: Row) => ReactNode][];
  initialRows?: number;
  stepRows?: number;
}) {
  const [limit, setLimit] = useState(initialRows);
  const visibleRows = rows.slice(0, limit);

  if (!rows.length) {
    return <div className="rounded-2xl border border-white/[0.055] bg-white/[0.03] p-5 text-sm text-white/38">No data recorded yet.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="admin-table-scroll max-h-[430px] overflow-auto overscroll-contain rounded-2xl border border-white/[0.045]">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#0d1020]">
          <tr className="border-b border-white/[0.055] text-[10px] uppercase tracking-[0.18em] text-white/28">
            {columns.map(([label]) => (
              <th key={label} className="whitespace-nowrap px-3 py-2 font-black">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.045]">
          {visibleRows.map((row, rowIndex) => (
            <tr key={String(row.id ?? `${row.mal_id ?? "row"}-${rowIndex}`)} className="text-white/54">
              {columns.map(([label, render]) => (
                <td key={label} className="max-w-[300px] whitespace-nowrap px-3 py-3 align-top">
                  {render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {visibleRows.length < rows.length ? (
        <button
          type="button"
          onClick={() => setLimit((value) => value + stepRows)}
          className="h-10 w-full rounded-2xl border border-white/[0.06] bg-white/[0.035] text-xs font-black text-white/44 transition hover:border-[#cf2442]/30 hover:bg-[#cf2442]/10 hover:text-white"
        >
          See more ({rows.length - visibleRows.length} left)
        </button>
      ) : null}
    </div>
  );
}
