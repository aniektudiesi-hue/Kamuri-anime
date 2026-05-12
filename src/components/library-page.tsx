"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button, ButtonLink } from "@/components/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deleteOfflineDownload, listOfflineDownloads, offlineId } from "@/lib/offline-downloads";
import type { Anime, LibraryItem } from "@/lib/types";
import { posterOf, progressOf, rememberedAnime, titleOf } from "@/lib/utils";

type LibraryKind = "history" | "watchlist" | "downloads";

// Fetch title + poster from AniList when the API item is missing them
async function enrichFromAniList(malId: number): Promise<Partial<Anime>> {
  const gql = `
    query Enrich($id: Int!) {
      Media(idMal: $id, type: ANIME) {
        title { romaji english }
        coverImage { large }
        averageScore episodes status
      }
    }
  `;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables: { id: malId } }),
    });
    if (!res.ok) return {};
    type R = { data?: { Media?: { title: { romaji: string; english: string | null }; coverImage: { large: string }; averageScore: number | null; episodes: number | null; status: string } } };
    const json = await res.json() as R;
    const m = json.data?.Media;
    if (!m) return {};
    return {
      title: m.title.english || m.title.romaji,
      image_url: m.coverImage.large,
      score: m.averageScore ? m.averageScore / 10 : undefined,
      episodes: m.episodes ?? undefined,
    };
  } catch {
    return {};
  }
}

export function LibraryPage({ kind }: { kind: LibraryKind }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [localDownloads, setLocalDownloads] = useState<LibraryItem[]>([]);
  const title = kind === "history" ? "Watch History" : kind === "watchlist" ? "Watchlist" : "Downloads";
  const query = useQuery({
    queryKey: [kind, token],
    queryFn: () => {
      if (kind === "history") return api.history(token!);
      if (kind === "downloads") return Promise.resolve([]);
      return api.watchlist(token!);
    },
    enabled: Boolean(token) && kind !== "downloads",
  });

  useEffect(() => {
    if (kind !== "downloads") return;
    listOfflineDownloads().then((items) => {
      setLocalDownloads(items.map((item) => ({
        mal_id: item.malId,
        anime_id: item.malId,
        title: item.title,
        poster: item.poster,
        image_url: item.poster,
        episode: item.episode,
        episode_num: item.episode,
        offline_id: item.id,
        size: item.size,
        downloaded_at: item.downloadedAt,
      })));
    }).catch(() => setLocalDownloads([]));
  }, [kind]);

  const clear = useMutation({
    mutationFn: (item?: LibraryItem) => {
      if (kind === "history") {
        if (!token) throw new Error("Login required");
        return api.clearHistory(token);
      }
      if (!token) throw new Error("Login required");
      if (kind === "watchlist" && item) return api.removeWatchlist(token, String(item.mal_id || item.anime_id));
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [kind] });
    },
  });

  const removeDownload = useMutation({
    mutationFn: async (item: LibraryItem) => {
      const id = String(item.mal_id || item.anime_id || "");
      const episode = item.episode || item.episode_num || 1;
      await deleteOfflineDownload(item.offline_id || offlineId(id, episode));
    },
    onSuccess: async () => {
      const items = await listOfflineDownloads();
      setLocalDownloads(items.map((item) => ({
        mal_id: item.malId,
        anime_id: item.malId,
        title: item.title,
        poster: item.poster,
        image_url: item.poster,
        episode: item.episode,
        episode_num: item.episode,
        offline_id: item.id,
        size: item.size,
        downloaded_at: item.downloadedAt,
      })));
    },
  });

  const displayItems =
    kind === "downloads"
      ? localDownloads
      : (query.data ?? []);

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">{title}</h1>
            <p className="mt-2 text-muted">
              {kind === "history"
                ? "Resume from the exact timestamp you left."
                : kind === "downloads"
                  ? "Episodes saved on this browser for offline playback."
                  : "Saved anime ready for your next session."}
            </p>
          </div>
          {kind === "history" && displayItems.length ? (
            <Button onClick={() => clear.mutate(undefined)} variant="panel">
              <Trash2 size={16} />
              Clear
            </Button>
          ) : null}
        </div>

        {!token && kind !== "downloads" ? (
          <div className="rounded-md border border-white/10 bg-panel p-8 text-center">
            <p className="text-muted">Login to view this library.</p>
            <ButtonLink href="/login" className="mt-4">Login</ButtonLink>
          </div>
        ) : query.isLoading && kind !== "downloads" ? (
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-panel-strong" />)}
          </div>
        ) : displayItems.length ? (
          <div className="grid gap-3">
            {displayItems.map((item, index) => (
              <LibraryRow
                key={`${item.anime_id}-${index}`}
                item={item}
                kind={kind}
                canRemove={kind !== "history"}
                onRemove={() => kind === "downloads" ? removeDownload.mutate(item) : clear.mutate(item)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-white/10 bg-panel p-8 text-center text-muted">Nothing saved here yet.</div>
        )}
      </section>
    </AppShell>
  );
}

function LibraryRow({ item, kind, canRemove, onRemove }: { item: LibraryItem; kind: LibraryKind; canRemove: boolean; onRemove: () => void }) {
  const id = String(item.mal_id || item.anime_id || "");
  const [savedAnime, setSavedAnime] = useState<Anime | undefined>();
  const episode = item.episode || item.episode_num || 1;
  const baseItem = { ...savedAnime, ...item };
  const downloadHref = `/offline/${encodeURIComponent(item.offline_id || offlineId(id, episode))}`;
  const progress = kind === "downloads" ? 0 : progressOf(item);
  const href =
    kind === "watchlist"
      ? `/anime/${id}`
      : kind === "downloads"
        ? downloadHref
        : `/watch/${id}/${episode}${progress > 1 ? `?t=${Math.floor(progress)}` : ""}`;
  const titleHref = kind === "downloads" ? href : `/anime/${id}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSavedAnime(rememberedAnime(id));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  // Enrich from AniList when title or poster is missing
  const hasMissingData = !posterOf(baseItem) || titleOf(baseItem) === "Untitled";
  const malIdNum = Number(id);
  const enrich = useQuery({
    queryKey: ["anilist-enrich", id],
    queryFn: () => enrichFromAniList(malIdNum),
    enabled: hasMissingData && Number.isFinite(malIdNum) && malIdNum > 0,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
  });

  // Merge: item from API wins over localStorage, AniList fills remaining gaps
  const displayItem = {
    ...(enrich.data ?? {}),
    ...savedAnime,
    ...item,
  } as Anime & LibraryItem;

  const displayTitle = titleOf(displayItem) === "Untitled"
    ? (enrich.data as { title?: string })?.title || `Anime ${id}`
    : titleOf(displayItem);
  const displayPoster = posterOf(displayItem) || (enrich.data as { image_url?: string })?.image_url || "";

  return (
    <div className="grid grid-cols-[72px_1fr_auto] items-center gap-4 rounded-md border border-white/10 bg-panel p-3">
      <Link href={href} className="relative h-24 overflow-hidden rounded bg-panel-strong">
        {displayPoster
          ? <Image src={displayPoster} alt="" width={72} height={108} className="h-full w-full object-cover" />
          : <div className="h-full w-full bg-[#141828]" />
        }
      </Link>
      <div className="min-w-0">
        <Link href={titleHref} className="line-clamp-1 font-bold hover:text-accent-2">{displayTitle}</Link>
        <Link href={href} className="mt-1 inline-block text-sm text-muted hover:text-white">
          Episode {episode}{kind === "history" && progress > 1 ? ` at ${formatClock(progress)}` : ""}
          {kind === "downloads" && item.size ? ` - ${formatBytes(item.size)}` : ""}
        </Link>
      </div>
      {canRemove ? (
        <button onClick={onRemove} aria-label="Remove" className="grid h-10 w-10 place-items-center rounded-md bg-panel-strong text-muted hover:text-white">
          <Trash2 size={16} />
        </button>
      ) : null}
    </div>
  );
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
