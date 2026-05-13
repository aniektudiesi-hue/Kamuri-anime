"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, ExternalLink, Globe2, Lock, MonitorSmartphone, Search, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
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

function asItems(data: unknown): Row[] {
  if (!data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Row[]) : [];
}

export function AdminDashboard() {
  const { token, user } = useAuth();
  const [adminKey, setAdminKey] = useState("");

  useEffect(() => {
    setAdminKey(localStorage.getItem("animetv_admin_key") || "");
  }, []);

  const overview = useQuery({
    queryKey: ["admin", "overview", token, adminKey],
    queryFn: () => api.adminOverview(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const users = useQuery({
    queryKey: ["admin", "users", token, adminKey],
    queryFn: () => api.adminUsers(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const logins = useQuery({
    queryKey: ["admin", "logins", token, adminKey],
    queryFn: () => api.adminLogins(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const visits = useQuery({
    queryKey: ["admin", "visits", token, adminKey],
    queryFn: () => api.adminVisits(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });
  const visibility = useQuery({
    queryKey: ["admin", "search-visibility", token, adminKey],
    queryFn: () => api.adminSearchVisibility(token!, adminKey),
    enabled: Boolean(token),
    retry: false,
  });

  const anyError = overview.error || users.error || logins.error || visits.error;
  const overviewData = overview.data ?? {};
  const topPaths = Array.isArray(overviewData.top_paths) ? (overviewData.top_paths as Row[]) : [];

  return (
    <AppShell>
      <section className="mx-auto max-w-screen-2xl px-4 py-8 lg:px-6">
        <div className="mb-7 flex flex-col gap-4 rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 p-5 shadow-2xl shadow-black/30 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#cf2442]/25 bg-[#cf2442]/10 px-3 py-1 text-xs font-black text-[#ffd7dd]">
              <ShieldCheck size={14} />
              Owner admin
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">AnimeTV Admin Control</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/44">
              View registered users, successful and failed logins, device/IP visit events, unique visitors, top pages, and Google visibility shortcuts.
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

        {!token ? (
          <EmptyAdmin
            icon={<Lock size={22} />}
            title="Login required"
            body="Sign in with the owner account to open admin controls."
            action={<ButtonLink href="/login">Login</ButtonLink>}
          />
        ) : anyError ? (
          <EmptyAdmin
            icon={<Lock size={22} />}
            title="Admin access blocked"
            body="This dashboard is restricted to the owner username configured on the backend."
            action={<ButtonLink href="/login">Switch username</ButtonLink>}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard icon={<UserRound size={18} />} label="Users" value={overviewData.total_users} loading={overview.isLoading} />
              <StatCard icon={<Activity size={18} />} label="Visits" value={overviewData.total_visits} loading={overview.isLoading} />
              <StatCard icon={<Globe2 size={18} />} label="Unique" value={overviewData.unique_visitors} loading={overview.isLoading} />
              <StatCard icon={<MonitorSmartphone size={18} />} label="24h Visits" value={overviewData.visits_24h} loading={overview.isLoading} />
              <StatCard icon={<ShieldCheck size={18} />} label="Logins" value={overviewData.login_success} loading={overview.isLoading} />
              <StatCard icon={<Lock size={18} />} label="Failed" value={overviewData.login_failed} loading={overview.isLoading} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="Users" icon={<UserRound size={16} />} loading={users.isLoading}>
                <Table
                  rows={asItems(users.data)}
                  columns={[
                    ["Username", (row) => <span className="font-black text-white">{text(row, "username")}</span>],
                    ["History", (row) => number(row, "history_count")],
                    ["Watchlist", (row) => number(row, "watchlist_count")],
                    ["Downloads", (row) => number(row, "downloads_count")],
                    ["Last login", (row) => formatTime(row.last_login_at)],
                  ]}
                />
              </Panel>

              <Panel title="Top pages" icon={<Activity size={16} />} loading={overview.isLoading}>
                <Table
                  rows={topPaths}
                  columns={[
                    ["Path", (row) => <span className="line-clamp-1 font-semibold text-white/80">{text(row, "path", "/")}</span>],
                    ["Visits", (row) => number(row, "visits")],
                    ["Unique", (row) => number(row, "unique_visitors")],
                  ]}
                />
              </Panel>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <Panel title="Recent logins" icon={<Lock size={16} />} loading={logins.isLoading}>
                <Table
                  rows={asItems(logins.data)}
                  columns={[
                    ["User", (row) => text(row, "username", "-")],
                    ["Status", (row) => (
                      <Badge className={number(row, "success") ? "bg-[#143b2a] text-[#9ff2c1]" : "bg-[#3b1620] text-[#ffb5c3]"}>
                        {number(row, "success") ? "success" : "failed"}
                      </Badge>
                    )],
                    ["IP", (row) => text(row, "ip_address", "-")],
                    ["Device", (row) => text(row, "device", "-")],
                    ["Time", (row) => formatTime(row.created_at)],
                  ]}
                />
              </Panel>

              <Panel title="Recent visitors" icon={<MonitorSmartphone size={16} />} loading={visits.isLoading}>
                <Table
                  rows={asItems(visits.data)}
                  columns={[
                    ["Path", (row) => <span className="line-clamp-1">{text(row, "path", "/")}</span>],
                    ["User", (row) => text(row, "username", "Guest")],
                    ["IP", (row) => text(row, "ip_address", "-")],
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
                {Array.isArray(visibility.data?.links)
                  ? (visibility.data.links as Row[]).map((link) => (
                      <Link
                        key={text(link, "url")}
                        href={text(link, "url")}
                        target="_blank"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-sm font-bold text-white/60 transition hover:border-[#cf2442]/35 hover:bg-[#cf2442]/10 hover:text-white"
                      >
                        {text(link, "label")}
                        <ExternalLink size={13} />
                      </Link>
                    ))
                  : null}
              </div>
            </Panel>
          </>
        )}
      </section>
    </AppShell>
  );
}

function EmptyAdmin({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
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

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: unknown; loading?: boolean }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-[#cf2442]/14 text-[#ff8ca0]">{icon}</div>
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/28">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-20 bg-white/[0.06]" /> : <p className="mt-1 text-3xl font-black text-white">{String(value ?? 0)}</p>}
    </div>
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
  icon: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0d1020]/78 shadow-xl shadow-black/20 ${className}`}>
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
}: {
  rows: Row[];
  columns: [string, (row: Row) => React.ReactNode][];
}) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-white/[0.055] bg-white/[0.03] p-5 text-sm text-white/38">No data recorded yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.055] text-[10px] uppercase tracking-[0.18em] text-white/28">
            {columns.map(([label]) => (
              <th key={label} className="whitespace-nowrap px-3 py-2 font-black">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.045]">
          {rows.map((row, rowIndex) => (
            <tr key={String(row.id ?? rowIndex)} className="text-white/54">
              {columns.map(([label, render]) => (
                <td key={label} className="max-w-[280px] whitespace-nowrap px-3 py-3 align-top">
                  {render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
