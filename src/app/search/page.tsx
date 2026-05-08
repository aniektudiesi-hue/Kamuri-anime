"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AnimeCard } from "@/components/anime-card";
import { CardSkeleton } from "@/components/anime-row";
import { api } from "@/lib/api";
import { animeId, rankAnimeForSearch } from "@/lib/utils";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const params = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 90,
  });
  const sortedResults = rankAnimeForSearch(results.data ?? [], q);

  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-3xl font-black">Search</h1>
        <p className="mt-2 text-muted">{q ? `Results for "${q}"` : "Type in the global search bar to find anime."}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {results.isLoading ? Array.from({ length: 14 }).map((_, i) => <CardSkeleton key={i} />) : sortedResults.map((anime, i) => <AnimeCard key={`${animeId(anime)}-${i}`} anime={anime} />)}
        </div>
        {q && !results.isLoading && !sortedResults.length ? (
          <div className="mt-10 rounded-md border border-white/10 bg-panel p-8 text-center text-muted">No anime found for this search.</div>
        ) : null}
      </section>
    </AppShell>
  );
}

function SearchFallback() {
  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-9 w-36 animate-pulse rounded bg-panel-strong" />
      </section>
    </AppShell>
  );
}
