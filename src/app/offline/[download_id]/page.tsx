"use client";

import Link from "next/link";
import { ChevronLeft, HardDriveDownload, Trash2 } from "lucide-react";
import { use, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { VideoPlayer } from "@/components/video-player";
import {
  createOfflinePlayable,
  deleteOfflineDownload,
  getOfflineDownload,
  type OfflineDownload,
  type OfflinePlayable,
} from "@/lib/offline-downloads";

export default function OfflineWatchPage({ params }: { params: Promise<{ download_id: string }> }) {
  const { download_id: downloadId } = use(params);
  const [download, setDownload] = useState<OfflineDownload | undefined>();
  const [playable, setPlayable] = useState<OfflinePlayable | undefined>();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOfflineDownload(decodeURIComponent(downloadId))
      .then((item) => {
        if (cancelled) return;
        if (!item) {
          setMissing(true);
          return;
        }
        setDownload(item);
        setPlayable(createOfflinePlayable(item));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      setPlayable((current) => {
        current?.revoke();
        return undefined;
      });
    };
  }, [downloadId]);

  async function removeDownload() {
    await deleteOfflineDownload(decodeURIComponent(downloadId));
    window.location.href = "/downloads";
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/downloads" className="inline-flex items-center gap-2 text-sm font-semibold text-white/45 hover:text-white">
            <ChevronLeft size={16} />
            Downloads
          </Link>
          {download ? (
            <button
              onClick={removeDownload}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-500/20 bg-red-950/20 px-3 text-sm font-semibold text-red-200/70 hover:text-red-100"
            >
              <Trash2 size={14} />
              Remove
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="aspect-video animate-pulse rounded-2xl bg-[#101322]" />
        ) : missing || !download || !playable ? (
          <div className="grid aspect-video place-items-center rounded-2xl border border-white/10 bg-[#0d1020] text-center">
            <div>
              <HardDriveDownload className="mx-auto mb-3 text-white/25" size={34} />
              <p className="font-bold text-white">Offline episode not found</p>
              <p className="mt-1 text-sm text-white/35">Download it again on this device.</p>
            </div>
          </div>
        ) : (
          <>
            <VideoPlayer
              stream={playable.stream}
              title={`${download.title} - Episode ${download.episode}`}
            />
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-[#0d1020] p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25">Offline playback</p>
              <h1 className="mt-2 text-xl font-black text-white">{download.title}</h1>
              <p className="mt-1 text-sm text-white/45">
                Episode {download.episode} saved on this device. Size {formatBytes(download.size)}.
              </p>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
