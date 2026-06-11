"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Database, Play, RefreshCw, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SidebarLayout } from "@/components/sidebar";

type AiringCrawlerItem = {
  mal_id: string | number;
  canonical_title?: string;
  english_title?: string;
  romaji_title?: string;
  native_title?: string;
  cover_image?: string;
  banner_image?: string;
  current_episodes?: number;
  episodes_total?: number;
  next_airing_episode?: number;
  next_airing_at?: number;
  saved_streams?: number;
  m3u8_episode_count?: number;
  missing_streams?: number;
  needs_stream_sync?: boolean;
  last_metadata_sync_at?: number;
  last_stream_sync_at?: number;
};

type AiringCrawlerStatus = {
  items?: AiringCrawlerItem[];
  total?: number;
  needs_sync?: number;
  missing_streams?: number;
  readonly?: boolean;
  source_api?: string;
  job?: AiringCrawlerRun;
  updated_at?: number;
};

type AiringCrawlerRun = {
  ok?: boolean;
  status?: string;
  phase?: string;
  error?: string;
  metadata?: { checked?: number; saved?: number; failed?: number };
  targets?: number;
  streams?: { saved?: number; empty?: number; transient?: number; missing?: number; results?: Array<Record<string, unknown>> };
  summary?: { total?: number; needs_sync?: number; missing_streams?: number };
  items?: AiringCrawlerItem[];
  updated_at?: number;
};

export default function AiringCrawlerPage() {
  const [status, setStatus] = useState<AiringCrawlerStatus | null>(null);
  const [lastRun, setLastRun] = useState<AiringCrawlerRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const items = status?.items ?? [];
  const activeJob = status?.job?.status ? status.job : lastRun;
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(b.missing_streams || 0) - Number(a.missing_streams || 0)),
    [items],
  );

  async function loadStatus() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/catalog-proxy/api/airing-crawler/status?limit=500", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load airing crawler status");
    } finally {
      setLoading(false);
    }
  }

  async function runCrawler() {
    setRunning(true);
    setError("");
    try {
      const response = await fetch("/api/catalog-proxy/api/airing-crawler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500, target_limit: 240, concurrency: 40 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
      setLastRun(payload.job ?? payload);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Airing crawler failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void loadStatus();
    const id = window.setInterval(() => void loadStatus(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <AppShell>
      <SidebarLayout>
        <main className="py-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#cf2442]">Catalog Worker</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Airing Episode Crawler</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                Shows every airing title from the local catalog, compares AniList available episodes with saved local m3u8 rows,
                then fills missing episodes through the source API only when the database is behind.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadStatus}
                disabled={loading || running}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={runCrawler}
                disabled={running || status?.readonly}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#cf2442] px-4 text-sm font-semibold text-white shadow-lg shadow-[#cf2442]/20 transition hover:bg-[#dc2d4b] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Zap size={15} />
                {running ? "Syncing..." : "Sync Missing Episodes"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-5 flex items-center gap-3 rounded-md border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : null}

          {status?.readonly ? (
            <div className="mb-5 rounded-md border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
              API is running read-only. The dashboard can show status, but cannot save m3u8 until 3058 is restarted without read-only mode.
            </div>
          ) : null}

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<Activity size={18} />} label="Airing Titles" value={status?.total ?? items.length} />
            <StatCard icon={<Database size={18} />} label="Need Sync" value={status?.needs_sync ?? 0} />
            <StatCard icon={<AlertTriangle size={18} />} label="Missing m3u8 Episodes" value={status?.missing_streams ?? 0} />
            <StatCard icon={<Play size={18} />} label="Last Saved This Run" value={activeJob?.streams?.saved ?? 0} />
          </section>

          {activeJob ? (
            <section className="mb-6 rounded-md border border-white/[0.07] bg-[#0d1020] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">Crawler Job</h2>
                {activeJob.status ? (
                  <span className="rounded bg-white/[0.06] px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/55">
                    {activeJob.status} · {activeJob.phase || "queued"}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-2 text-sm text-white/60 sm:grid-cols-2 lg:grid-cols-5">
                <p>Metadata checked: <b className="text-white">{activeJob.metadata?.checked ?? 0}</b></p>
                <p>Targets: <b className="text-white">{activeJob.targets ?? 0}</b></p>
                <p>Saved: <b className="text-emerald-300">{activeJob.streams?.saved ?? 0}</b></p>
                <p>Empty: <b className="text-yellow-300">{activeJob.streams?.empty ?? 0}</b></p>
                <p>Retry: <b className="text-red-300">{activeJob.streams?.transient ?? 0}</b></p>
              </div>
              {activeJob.error ? <p className="mt-3 text-sm text-red-300">{activeJob.error}</p> : null}
            </section>
          ) : null}

          <section className="overflow-hidden rounded-md border border-white/[0.07] bg-[#080a12]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Airing Titles</h2>
              <p className="mt-1 text-xs text-white/35">AniList current episode count vs local saved m3u8 count.</p>
            </div>
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#0b0d16] text-xs uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">MAL</th>
                    <th className="px-4 py-3">AniList Eps</th>
                    <th className="px-4 py-3">DB m3u8</th>
                    <th className="px-4 py-3">Missing</th>
                    <th className="px-4 py-3">Next</th>
                    <th className="px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !items.length ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <tr key={index} className="border-t border-white/[0.045]">
                        <td className="px-4 py-3" colSpan={7}>
                          <div className="h-10 animate-pulse rounded-md bg-white/[0.045]" />
                        </td>
                      </tr>
                    ))
                  ) : sortedItems.length ? (
                    sortedItems.map((item) => {
                      const title = item.english_title || item.canonical_title || item.romaji_title || `MAL ${item.mal_id}`;
                      const missing = Number(item.missing_streams || 0);
                      return (
                        <tr key={String(item.mal_id)} className="border-t border-white/[0.045] text-white/68">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-white/[0.06]">
                                {item.cover_image || item.banner_image ? (
                                  <Image src={item.cover_image || item.banner_image || ""} alt="" fill sizes="40px" className="object-cover" />
                                ) : null}
                              </div>
                              <div>
                                <p className="line-clamp-1 font-semibold text-white">{title}</p>
                                <p className="line-clamp-1 text-xs text-white/35">{item.native_title || item.romaji_title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-white/45">{item.mal_id}</td>
                          <td className="px-4 py-3">{Number(item.current_episodes || 0)}</td>
                          <td className="px-4 py-3">{Number(item.saved_streams || item.m3u8_episode_count || 0)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded px-2 py-1 text-xs font-semibold ${missing ? "bg-[#cf2442]/18 text-[#ffb4c2]" : "bg-emerald-400/10 text-emerald-300"}`}>
                              {missing}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-white/45">{formatNext(item.next_airing_at)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/anime/${item.mal_id}`} className="text-xs font-semibold text-[#ff6f86] hover:text-white">
                              Detail
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-white/35">No airing titles found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </SidebarLayout>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-[#0d1020] p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#cf2442]/14 text-[#ff6f86]">{icon}</div>
      <p className="text-2xl font-semibold text-white">{Number(value || 0).toLocaleString()}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/35">{label}</p>
    </div>
  );
}

function formatNext(value?: number) {
  const seconds = Number(value || 0);
  if (!seconds) return "TBA";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(seconds * 1000));
}
