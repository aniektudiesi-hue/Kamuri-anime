"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { SidebarLayout } from "@/components/sidebar";
import { fetchJikanDiscovery, mergeAnimeSources, resolveDiscoveryIntent } from "@/lib/anime-discovery";
import type { Anime } from "@/lib/types";
import { animeId } from "@/lib/utils";

const ANILIST_STATUS: Record<string, string> = {
  RELEASING: "currently_airing",
  FINISHED: "finished_airing",
  NOT_YET_RELEASED: "not_yet_aired",
  CANCELLED: "finished_airing",
  HIATUS: "finished_airing",
};

type AniListMedia = {
  idMal: number | null;
  id: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string };
  averageScore: number | null;
  episodes: number | null;
  status: string;
};

function mapToAnime(item: AniListMedia): Anime {
  return {
    mal_id: item.idMal ? String(item.idMal) : String(item.id),
    title: item.title.english || item.title.romaji,
    image_url: item.coverImage.large,
    score: item.averageScore ? item.averageScore / 10 : undefined,
    episodes: item.episodes ?? undefined,
    status: ANILIST_STATUS[item.status] || item.status.toLowerCase(),
  };
}

const MEDIA_FIELDS = `
  idMal id
  title { romaji english }
  coverImage { large }
  averageScore episodes status
`;

// Query both genre and tag in a single request — Isekai/School are tags, not genres
async function fetchByNameOrTag(
  name: string,
  page: number,
): Promise<{ media: AniListMedia[]; hasNextPage: boolean; resolvedAs: "genre" | "tag" | "search" }> {
  const gql = `
    query Browse($name: String!, $page: Int!, $perPage: Int!) {
      byGenre: Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(genre: $name, type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
      }
      byTag: Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(tag: $name, type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
      }
      bySearch: Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(search: $name, type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
      }
    }
  `;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables: { name, page, perPage: 30 } }),
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);

  type PageResult = { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] };
  const json = await res.json() as {
    data?: { byGenre?: PageResult; byTag?: PageResult; bySearch?: PageResult };
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new Error(json.errors[0].message);

  const genreMedia = json.data?.byGenre?.media ?? [];
  const tagMedia = json.data?.byTag?.media ?? [];
  const searchMedia = json.data?.bySearch?.media ?? [];

  // Prefer genre results, then tag results, then title search results
  if (genreMedia.length > 0) {
    return { media: genreMedia, hasNextPage: json.data?.byGenre?.pageInfo.hasNextPage ?? false, resolvedAs: "genre" };
  }
  if (tagMedia.length > 0) {
    return { media: tagMedia, hasNextPage: json.data?.byTag?.pageInfo.hasNextPage ?? false, resolvedAs: "tag" };
  }
  return { media: searchMedia, hasNextPage: json.data?.bySearch?.pageInfo.hasNextPage ?? false, resolvedAs: "search" };
}

export default function GenrePage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params);
  const genre = decodeURIComponent(rawName);
  const [page, setPage] = useState(1);
  const intent = resolveDiscoveryIntent(genre);

  const query = useQuery({
    queryKey: ["anilist-browse", genre, page],
    queryFn: () => fetchByNameOrTag(genre, page),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
    retry: 1,
    retryDelay: 2000,
  });

  const jikanQuery = useQuery({
    queryKey: ["jikan-browse", intent.key, page],
    queryFn: () => fetchJikanDiscovery({ ...intent, useBackend: false, jikanQuery: intent.jikanQuery || genre }, page),
    staleTime: 1000 * 60 * 45,
    gcTime: 1000 * 60 * 120,
  });

  const anilistList: Anime[] = (query.data?.media ?? [])
    .filter((m) => m.idMal || m.id)
    .map(mapToAnime);
  const animeList = mergeAnimeSources(anilistList, jikanQuery.data?.media ?? []);

  const resolvedLabel =
    query.data?.resolvedAs === "tag" ? "Tag"
    : query.data?.resolvedAs === "search" ? "Search"
    : "Genre";

  return (
    <AppShell>
      <SidebarLayout>
        <div className="py-6">
          {/* Page header */}
          <div className="mb-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/25">{resolvedLabel}</p>
            <h1 className="flex items-baseline gap-3 text-2xl font-black text-white">
              {genre}
              {!query.isLoading && !query.isError && animeList.length > 0 && (
                <span className="text-lg font-semibold text-white/25">{animeList.length} titles</span>
              )}
            </h1>
          </div>

          {/* Error */}
          {query.isError ? (
            <div className="flex flex-col items-center gap-5 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <AlertCircle size={28} className="text-red-400" />
              </span>
              <div>
                <p className="text-base font-bold text-white">Failed to load</p>
                <p className="mt-1.5 max-w-xs text-sm text-white/40">
                  Could not fetch anime from AniList. Check your connection or try again.
                </p>
              </div>
              <button
                onClick={() => query.refetch()}
                className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>

          ) : query.isLoading && page === 1 ? (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0d1020] px-4 py-3">
                <Loader2 size={15} className="shrink-0 animate-spin text-white/40" />
                <p className="text-sm text-white/40">Loading {genre} anime…</p>
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i}>
                    <div className="aspect-[2/3] animate-pulse rounded-xl bg-[#141828]" style={{ animationDelay: `${i * 25}ms` }} />
                    <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-[#141828]" />
                    <div className="mt-1.5 h-2.5 w-2/5 animate-pulse rounded-full bg-[#0d1020]" />
                  </div>
                ))}
              </div>
            </>

          ) : animeList.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
                {animeList.map((anime, i) => (
                  <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} className="w-full" priority={i < 8} />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-white/[0.08] bg-[#0d1020] px-5 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:border-white/[0.14] hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  ← Previous
                </button>
                <span className="text-sm text-white/30">Page {page}</span>
                <button
                  disabled={!query.data?.hasNextPage && !jikanQuery.data?.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-white/[0.08] bg-[#0d1020] px-5 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:border-white/[0.14] hover:text-white disabled:pointer-events-none disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </>

          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#141828]">
                <AlertCircle size={28} className="text-white/20" />
              </span>
              <div>
                <p className="font-bold text-white">No results for &ldquo;{genre}&rdquo;</p>
                <p className="mt-1 text-sm text-white/40">Try a different genre name or browse the sidebar.</p>
              </div>
            </div>
          )}
        </div>
      </SidebarLayout>
    </AppShell>
  );
}
