"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, ChevronDown, Loader2, MoreVertical, Play, Share2, Star } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { BufferingScreen } from "@/components/buffering-screen";
import { SidebarLayout } from "@/components/sidebar";
import { ProgressiveImage } from "@/components/progressive-image";
import { api } from "@/lib/api";
import { fetchAnimeMetadataByMalId } from "@/lib/anime-metadata";
import { crCardQueryKey, fetchCrCard, type CrSeason } from "@/lib/catalog-api";
import { directImageUrl, imageCdnUrl } from "@/lib/image-cdn";
import { useAuth } from "@/lib/auth";
import {
  STREAM_PROVIDERS,
  fetchStreamProvider,
  streamProviderQueryKey,
  warmStreamProvider,
} from "@/lib/stream-providers";
import type { Anime, Episode, EpisodeResponse } from "@/lib/types";
import { useResumeHistory } from "@/lib/use-resume-history";
import {
  displayStatus, episodeCount, posterOf,
  idFromSlug, rememberAnime, rememberedAnime, titleOf, watchPath,
} from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  currently_airing: { label: "Airing Now", color: "text-[#ffd7dd] bg-[#c4182a]/14 ring-[#c4182a]/24", dot: "bg-[#c4182a] animate-pulse" },
  finished_airing: { label: "Completed", color: "text-white/50 bg-white/[0.06] ring-white/10", dot: "bg-white/40" },
  not_yet_aired: { label: "Upcoming", color: "text-[#dce2ea] bg-[#c8ced8]/10 ring-[#c8ced8]/18", dot: "bg-[#c8ced8]" },
};

const RANGE_SIZE = 100;

function getRanges(total: number): { label: string; start: number; end: number }[] {
  if (total <= RANGE_SIZE) return [];
  const ranges = [];
  for (let s = 1; s <= total; s += RANGE_SIZE) {
    const e = Math.min(s + RANGE_SIZE - 1, total);
    ranges.push({ label: `${String(s).padStart(3, "0")}-${String(e).padStart(3, "0")}`, start: s, end: e });
  }
  return ranges;
}

export default function AnimeDetailPage({ params }: { params: Promise<{ mal_id: string }> }) {
  const { mal_id: rawMalId } = use(params);
  const malId = idFromSlug(rawMalId);
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [clickedAnime, setClickedAnime] = useState<Anime | undefined>(() =>
    typeof window === "undefined" ? undefined : rememberedAnime(malId),
  );
  const [watchlistSaved, setWatchlistSaved] = useState(false);
  const [activeRange, setActiveRange] = useState(0);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [episodeLimit, setEpisodeLimit] = useState(24);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [heroImageReady, setHeroImageReady] = useState(false);
  const [bufferEscape, setBufferEscape] = useState(false);

  useEffect(() => {
    setClickedAnime(rememberedAnime(malId));
  }, [malId]);

  const known = clickedAnime as Anime | undefined;
  const needsMetadataFallback = !known || titleOf(known) === "Untitled" || !posterOf(known) || !known.banner || !known.overview;
  const metadataFallback = useQuery({
    queryKey: ["anime-metadata", malId],
    // React Query rejects an undefined resolve; the metadata source can be
    // unavailable, so coalesce a miss to null.
    queryFn: async () => (await fetchAnimeMetadataByMalId(malId)) ?? null,
    enabled: needsMetadataFallback && Number.isFinite(Number(malId)),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
    placeholderData: keepPreviousData,
  });
  const displayAnime = useMemo(
    () => ({
      title: titleFromSlug(rawMalId),
      ...(known ?? {}),
      ...(metadataFallback.data ?? {}),
      mal_id: malId,
    }) as Anime,
    [known, malId, metadataFallback.data, rawMalId],
  );
  const hint = episodeCount(displayAnime);

  useEffect(() => {
    if (displayAnime && titleOf(displayAnime) !== "Untitled") rememberAnime(displayAnime);
  }, [displayAnime]);

  const episodes = useQuery<EpisodeResponse>({
    queryKey: ["episodes", "cr-v2", malId, hint],
    queryFn: () => api.episodes(malId, hint),
    initialData: hint > 0 ? makeEpisodeHint(malId, hint) : undefined,
    // Treat the instant placeholder as already stale so the CR-enhanced episode
    // list (real titles + thumbnails) is fetched immediately to replace it.
    initialDataUpdatedAt: 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 20,
  });

  const resume = useResumeHistory(malId);
  const last = resume.item;
  const lastEp = resume.episode;
  const localProgress = resume.progress;

  const watchlist = useQuery({
    queryKey: ["watchlist", token],
    queryFn: () => api.watchlist(token!),
    enabled: Boolean(token),
  });
  const watchlistHasAnime = Boolean(watchlist.data?.some((item) => String(item.mal_id || item.anime_id) === malId));
  const inWatchlist = watchlistSaved || watchlistHasAnime;

  useEffect(() => {
    setWatchlistSaved(watchlistHasAnime);
  }, [malId, watchlistHasAnime]);

  const addWatchlist = useMutation({
    mutationFn: () =>
      api.addWatchlist(token!, {
        mal_id: malId, anime_id: malId,
        title: titleOf(displayAnime), image_url: posterOf(displayAnime), episodes: hint,
      }),
    onMutate: () => setWatchlistSaved(true),
    onError: () => setWatchlistSaved(false),
    onSuccess: () => {
      setWatchlistSaved(true);
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", token] });
    },
  });

  const prefetchWatch = useCallback((ep: number, ownerMal = malId) => {
    const episode = String(ep);
    const primary = STREAM_PROVIDERS[0];
    const watchAnime = { ...displayAnime, mal_id: ownerMal, anime_id: ownerMal, id: ownerMal } as Anime;
    router.prefetch(watchPath(watchAnime, ownerMal, ep));
    queryClient.fetchQuery({
      queryKey: streamProviderQueryKey(primary, ownerMal, episode, "sub"),
      queryFn: () => fetchStreamProvider(primary, { malId: ownerMal, episode, type: "sub" }),
      staleTime: 1000 * 60 * 25,
    }).then((stream) => warmStreamProvider(primary, stream)).catch(() => undefined);
  }, [displayAnime, malId, queryClient, router]);

  const episodeTotal = episodes.data?.num_episodes || episodeCount(displayAnime);
  const poster = posterOf(displayAnime);
  const backdrop = heroBannerOf(displayAnime);
  const title = titleOf(displayAnime) === "Untitled" ? `Anime ${malId}` : titleOf(displayAnime);
  const statusKey = (displayAnime?.status || "").toLowerCase();
  const statusCfg = STATUS_CONFIG[statusKey];
  const resumeHref = resume.item
    ? `${watchPath(displayAnime, malId, resume.episode)}${resume.progress > 1 ? `?t=${Math.floor(resume.progress)}` : ""}`
    : watchPath(displayAnime, malId, 1);

  const allEpisodes = episodes.data?.episodes ?? [];

  // Crunchyroll season tree (real seasons + per-episode thumbnails). Cache it so
  // a revisit paints the CR hero instantly instead of re-fetching (which forced
  // the AniList backdrop to flash before the CR keyart swapped in).
  const crCard = useQuery({
    queryKey: crCardQueryKey(malId, 1),
    queryFn: () => fetchCrCard(malId, 1),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
  // Until the CR lookup settles we don't know whether this title has Crunchyroll
  // keyart, so hold the hero visuals rather than painting the AniList fallback
  // first (the "AniList layout flashes then changes to CR" bug).
  const crPending = crCard.isLoading && !crCard.data;

  useEffect(() => {
    const canonical = crCard.data?.canonical_mal_id;
    if (canonical && canonical !== malId && shouldFollowCanonicalRedirect(displayAnime, crCard.data)) {
      router.replace(`/anime/${canonical}`);
    }
  }, [crCard.data, displayAnime, malId, router]);

  const crSeasons = useMemo<CrSeason[]>(() => {
    const seasons = crCard.data?.seasons ?? [];
    return [...seasons].sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0));
  }, [crCard.data]);
  const useSeasons = crSeasons.length > 0;
  const activeSeasonIndex = useSeasons ? Math.min(activeRange, crSeasons.length - 1) : activeRange;
  const activeSeasonNumber = useSeasons ? (crSeasons[activeSeasonIndex]?.season_number ?? activeSeasonIndex + 1) : 1;
  const activeCrCard = useQuery({
    queryKey: crCardQueryKey(malId, activeSeasonNumber),
    queryFn: () => fetchCrCard(malId, activeSeasonNumber),
    enabled: useSeasons,
    initialData: activeSeasonNumber === 1 ? crCard.data : undefined,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  // HACK for instant season switching: the moment the card loads, warm EVERY
  // season's payload in the background (staggered so we don't stampede the cold
  // backend). Switching then reads straight from the React Query cache — no
  // network round-trip, no spinner.
  useEffect(() => {
    if (!useSeasons || crSeasons.length < 2) return;
    let cancelled = false;
    const pending = crSeasons
      .map((s) => s.season_number ?? 0)
      .filter((sn) => sn > 0 && sn !== activeSeasonNumber);
    let i = 0;
    const pump = () => {
      if (cancelled || i >= pending.length) return;
      const sn = pending[i++];
      queryClient
        .prefetchQuery({
          queryKey: crCardQueryKey(malId, sn),
          queryFn: () => fetchCrCard(malId, sn),
          staleTime: 1000 * 60 * 30,
        })
        .finally(() => {
          if (!cancelled) window.setTimeout(pump, 120);
        });
    };
    pump();
    return () => {
      cancelled = true;
    };
  }, [useSeasons, crSeasons, malId, activeSeasonNumber, queryClient]);
  const selectedCrSeason = useMemo(() => {
    const activeSummary = crSeasons[activeSeasonIndex];
    const activeSummaryKey = crSeasonKey(activeSummary);
    const matchesActiveSeason = (season?: CrSeason) => {
      if (!season) return false;
      if (Number(season.season_number || 0) === Number(activeSeasonNumber)) return true;
      return Boolean(activeSummaryKey && crSeasonKey(season) === activeSummaryKey);
    };
    const selected = activeCrCard.data?.selected_season;
    if (matchesActiveSeason(selected)) return selected;
    if (selected?.episodes?.length) return selected;
    const initialSelected = crCard.data?.selected_season;
    if (activeSeasonNumber === 1 && matchesActiveSeason(initialSelected)) return initialSelected;
    return undefined;
  }, [activeCrCard.data?.selected_season, activeSeasonIndex, activeSeasonNumber, crCard.data?.selected_season, crSeasons]);
  const crEpisodeTotal = useMemo(
    () => crSeasons.reduce((sum, season) => sum + (season.episodes?.length ?? season.episode_count ?? 0), 0),
    [crSeasons],
  );
  const visibleEpisodeTotal = useSeasons ? crEpisodeTotal : episodeTotal;

  // Prefer the CR detail-page keyart (wide backdrop) > CR hero > AniList backdrop.
  const instantHero = displayAnime.detail_banner || displayAnime.cr_hero || backdrop;
  const heroImage = crCard.data?.detail_banner || crCard.data?.hero_banner || instantHero;
  const titleLogo = crCard.data?.title_logo || "";
  const posterImage = crCard.data?.poster || poster;
  // CR keyart is already a sized CDN URL — use it directly; only route AniList art
  // through the WebP cache.
  const isCrKeyart = Boolean(crCard.data?.detail_banner || crCard.data?.hero_banner || displayAnime.detail_banner || displayAnime.cr_hero);
  const heroSrc = imageCdnUrl(heroImage, "banner-lg");
  const previewSrc = imageCdnUrl(heroImage || posterImage, "banner-sm");
  const initialSeasonReady = !useSeasons || Boolean(crCard.data?.selected_season);
  const detailDataPending = crPending || (needsMetadataFallback && metadataFallback.isLoading) || !initialSeasonReady;
  // The buffer clears as soon as the DATA (CR card + season-1) is ready — it must
  // NOT wait for the heavy hero banner image to finish downloading (that fades in
  // on its own). A hard escape (below) guarantees the page never hangs forever on
  // a slow/failing backend or image.
  const showDetailBuffer = detailDataPending && !bufferEscape;
  const showHeroSplash = showDetailBuffer;

  const markHeroImageReady = useCallback(() => {
    setHeroImageReady(true);
  }, []);

  const markHeroReady = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("atv:hero-ready"));
    }
  }, []);

  useEffect(() => {
    setHeroImageReady(!heroSrc);
  }, [heroSrc]);

  // Hard safety: never let the detail buffer hang. Reveal the page after 3.5s
  // even if the backend or hero image is still resolving.
  useEffect(() => {
    setBufferEscape(false);
    const timer = window.setTimeout(() => setBufferEscape(true), 3500);
    return () => window.clearTimeout(timer);
  }, [malId]);

  useEffect(() => {
    if (!showDetailBuffer) markHeroReady();
  }, [markHeroReady, showDetailBuffer]);

  useEffect(() => {
    if (!showDetailBuffer) return;
    document.documentElement.classList.add("atv-boot-lock");
    document.body.classList.add("atv-boot-lock");
    return () => {
      document.documentElement.classList.remove("atv-boot-lock");
      document.body.classList.remove("atv-boot-lock");
    };
  }, [showDetailBuffer]);

  const ranges = getRanges(episodeTotal);
  const genres = displayAnime.genres?.length ? displayAnime.genres.slice(0, 4) : [];
  const score = Number(displayAnime.score || 0);
  const overview =
    cleanOverview(crCard.data?.synopsis) ||
    cleanOverview(displayAnime.overview) ||
    "Synopsis unavailable for this title.";
  const releaseYear = displayAnime.year || yearFromDate(displayAnime.start_date);
  const studios = displayAnime.studios?.filter(Boolean).slice(0, 2) ?? [];
  const formattedSource = formatSource(displayAnime.source);

  // Auto-select range that contains lastEp (flat/range mode only)
  useEffect(() => {
    if (useSeasons || !ranges.length || !lastEp) return;
    const idx = ranges.findIndex((r) => lastEp >= r.start && lastEp <= r.end);
    if (idx >= 0) setActiveRange(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEp, ranges.length, useSeasons]);

  useEffect(() => {
    setEpisodeLimit(useSeasons ? 60 : 24);
  }, [activeRange, malId, useSeasons]);

  useEffect(() => {
    if (useSeasons && activeRange >= crSeasons.length) {
      setActiveRange(0);
    }
  }, [activeRange, crSeasons.length, useSeasons]);

  // Tabs: Crunchyroll seasons when the title splits into seasons, else 100-ep ranges.
  const episodeTabs = useSeasons
    ? crSeasons.map((season, index) => season.title || `Season ${season.season_number ?? index + 1}`)
    : ranges.map((range) => range.label);

  const seasonEpisodes = useMemo<Episode[]>(() => {
    if (!useSeasons) return [];
    const season = selectedCrSeason || crSeasons[activeSeasonIndex];
    return (season?.episodes ?? []).map((episode) => ({
      // episode_number drives the watch link/stream fetch (owner MAL's real episode);
      // display_number is what the user sees (restarts at 1 each season).
      episode_number: Number(episode.stream_ep ?? episode.ep) || 0,
      display_number: Number(episode.ep) || 0,
      title: episode.title || `Episode ${episode.ep}`,
      thumbnail: episode.thumbnail,
      has_stream: episode.has_stream,
    }));
  }, [useSeasons, selectedCrSeason, crSeasons, activeSeasonIndex]);

  // Each CR season streams via the MAL id that actually owns its episodes.
  const activeSeasonMal = useSeasons
    ? selectedCrSeason?.owner_mal || crSeasons[activeSeasonIndex]?.owner_mal || malId
    : malId;

  const rangeEpisodes: Episode[] = useSeasons
    ? seasonEpisodes
    : ranges.length
      ? allEpisodes.filter(
          (ep) => ep.episode_number >= ranges[activeRange].start && ep.episode_number <= ranges[activeRange].end,
        )
      : allEpisodes;
  const seasonEpisodesPending = useSeasons && !selectedCrSeason && (activeCrCard.isLoading || activeCrCard.isFetching || crCard.isFetching);
  const episodeListPending = episodes.isLoading || crPending || seasonEpisodesPending;
  const visibleEpisodes = rangeEpisodes.slice(0, episodeLimit);

  function shareAnime() {
    const href = `${window.location.origin}/anime/${rawMalId}`;
    if (navigator.share) {
      navigator.share({ title, url: href }).catch(() => undefined);
      return;
    }
    navigator.clipboard?.writeText(href).catch(() => undefined);
  }

  return (
    <AppShell>
      {/* Hero banner — always full-bleed to prevent layout flash when CR data loads */}
      <section className="relative overflow-hidden bg-[#050506]">
        <div className="absolute inset-0">
          {!crPending && heroSrc ? (
            <Image
              key={heroSrc}
              src={heroSrc}
              alt=""
              fill
              priority
              unoptimized
              fetchPriority="high"
              sizes="100vw"
              onLoad={markHeroImageReady}
              onError={markHeroImageReady}
              className={`animate-[fadeIn_0.45s_ease] ${isCrKeyart
                ? "object-cover object-[48%_24%]"
                : "object-cover object-[44%_20%]"}`}
            />
          ) : null}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(5,5,6,0.95) 0%, rgba(5,5,6,0.86) 18%, rgba(5,5,6,0.52) 36%, rgba(5,5,6,0.14) 54%, rgba(5,5,6,0) 72%, rgba(5,5,6,0) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0) 46%, rgba(5,5,6,0.72) 100%)" }} />
        </div>

        <div className="absolute right-4 top-20 z-20 flex items-center gap-2 text-[0.8125rem] font-bold uppercase tracking-[-0.01em] text-[#f2f2f2]/85 transition-colors duration-200 hover:text-[#f2f2f2] sm:top-24 md:right-8">
          <MoreVertical size={20} />
          More
        </div>

        {showHeroSplash ? <BufferingScreen /> : null}

        <div className={`relative z-10 mx-auto grid min-h-[255px] max-w-screen-2xl items-end gap-4 px-5 pb-4 pt-10 transition-opacity duration-200 sm:min-h-[310px] md:min-h-[380px] md:gap-8 md:px-12 md:pb-10 md:pt-16 lg:min-h-[430px] lg:px-20 ${showHeroSplash ? "opacity-0" : "opacity-100"}`}>
          <div className="max-w-[640px]">
            {crPending ? (
              <div className="mb-5 h-[78px] w-[220px] animate-pulse rounded-md bg-white/[0.06] md:h-[110px] md:w-[320px]" />
            ) : (
              <div className="animate-[fadeIn_0.4s_ease]">
                {titleLogo ? (
                  <img
                    src={imageCdnUrl(titleLogo, "thumb")}
                    alt={`${title} logo`}
                    loading="eager"
                    className="mb-2 block max-h-[62px] w-auto max-w-[min(178px,64vw)] object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] sm:mb-3 sm:max-h-[92px] sm:max-w-[220px] md:mb-5 md:max-h-[150px] md:max-w-[360px] xl:max-w-[420px]"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }}
                  />
                ) : null}
                <h1
                  className="mb-2 text-[1.25rem] font-bold leading-[1.1] text-[#f2f2f2] drop-shadow-xl sm:mb-3 sm:text-[2rem] md:mb-4 lg:text-[2.5rem]"
                  style={titleLogo ? { display: "none" } : undefined}
                >{title}</h1>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.75rem] leading-[1.125rem] font-medium text-[#f2f2f2]/72 sm:gap-x-2 sm:gap-y-1.5 sm:text-[0.9375rem] sm:leading-[1.25rem]">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-sm bg-[#f2f2f2]/16 text-[0.625rem] font-bold uppercase text-[#f2f2f2]/88 sm:h-[26px] sm:w-[26px] sm:text-[0.6875rem]">A</span>
              <span>Sub</span>
              <span className="text-[#8c8c8c]">|</span>
              <span>Dub</span>
              {genres.length ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-[#8c8c8c]">·</span>
                  <span>
                    {genres.map((genre, i) => (
                      <span key={genre}>
                        {i > 0 ? ", " : ""}
                        <Link href={`/genre/${encodeURIComponent(genre)}`} className="text-[#f2f2f2]/72 transition-colors duration-200 hover:text-[#f2f2f2]">
                          {genre}
                        </Link>
                      </span>
                    ))}
                  </span>
                </span>
              ) : null}
              {releaseYear ? <span className="inline-flex items-center gap-2"><span className="text-[#8c8c8c]">·</span>{releaseYear}</span> : null}
              {visibleEpisodeTotal > 0 ? <span className="inline-flex items-center gap-2"><span className="text-[#8c8c8c]">·</span>{visibleEpisodeTotal} Episodes</span> : null}
            </div>

            <div className="mt-3 flex items-center gap-2.5 sm:mt-4 sm:gap-3">
              {score ? (
                <>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={15} className={index < Math.round(score / 2) ? "fill-[#f2f2f2] text-[#f2f2f2]" : "fill-[#8c8c8c]/25 text-[#8c8c8c]/35"} />
                    ))}
                  </div>
                  <span className="text-[0.875rem] font-bold tracking-[-0.03em] text-[#f2f2f2]">{score.toFixed(1)}</span>
                  <span className="text-[0.75rem] leading-[1.125rem] text-[#8c8c8c]">/ 10</span>
                </>
              ) : (
                <span className="text-[0.875rem] font-medium text-[#8c8c8c]">No rating yet</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 md:mt-7 md:gap-3">
              <Link href={resumeHref} className="inline-flex h-[38px] items-center justify-center gap-1.5 bg-[#c4182a] px-3.5 text-[0.75rem] font-black uppercase text-white transition-all duration-200 ease-in-out hover:bg-[#d42040] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#8c8c8c] md:h-[56px] md:gap-2.5 md:px-7 md:text-[1rem]">
                <Play size={15} fill="currentColor" />
                {last ? "Continue Watching" : "Start Watching E1"}
              </Link>
              <button disabled={!token || inWatchlist || addWatchlist.isPending} onClick={() => addWatchlist.mutate()} className="grid h-[38px] w-[38px] place-items-center border-2 border-[#f2f2f2]/45 bg-[#f2f2f2]/[0.06] text-[#f2f2f2]/85 transition-all duration-200 ease-in-out hover:border-[#f2f2f2]/80 hover:text-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#8c8c8c] md:h-[56px] md:w-[56px]" aria-label={inWatchlist ? "Saved to watchlist" : "Add to watchlist"} title={inWatchlist ? "Saved" : "Add to watchlist"}>
                {addWatchlist.isPending ? <Loader2 size={18} className="animate-spin" /> : inWatchlist ? <CheckCircle2 size={18} /> : <Bookmark size={18} />}
              </button>
              <button type="button" onClick={shareAnime} className="grid h-[38px] w-[38px] place-items-center bg-transparent text-[#f2f2f2]/85 transition-all duration-200 ease-in-out hover:bg-[#f2f2f2]/10 hover:text-[#f2f2f2] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[#8c8c8c] md:h-[56px] md:w-[56px]" aria-label="Share anime" title="Share">
                <Share2 size={18} />
              </button>
            </div>

            {last && localProgress > 1 ? (
              <div className="mt-5 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-[0.75rem] font-medium leading-[1.125rem] text-[#8c8c8c]">
                  <span>Episode {lastEp} in progress</span>
                  <span>{formatClock(localProgress)}</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#414141]">
                  <div className="h-full rounded-full bg-[#c4182a]" style={{ width: `${Math.min(100, (localProgress / (last.duration || 1440)) * 100)}%` }} />
                </div>
              </div>
            ) : null}

          </div>

        </div>

        {/* Synopsis + details — expandable fade per CR audit Section 28 */}
        <div className={`relative z-10 mx-auto hidden max-w-screen-2xl px-5 pb-7 transition-opacity duration-200 md:block md:px-12 md:pb-10 lg:px-20 ${showHeroSplash ? "opacity-0" : "opacity-100"}`}>
          <div className="grid max-w-[900px] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)] md:gap-6">
            <div>
              <div className="relative">
                <p className={`text-[0.875rem] font-normal leading-[1.25rem] text-[#f2f2f2]/80 md:text-[1rem] md:leading-[1.375rem] ${synopsisExpanded ? "" : "line-clamp-3"}`}>{overview}</p>
              </div>
              {overview.length > 200 ? (
                <button type="button" onClick={() => setSynopsisExpanded((v) => !v)} className="mt-2 text-[0.75rem] font-bold uppercase leading-[1.125rem] tracking-[-0.03em] text-[#f2f2f2] transition-colors duration-200 hover:text-white">
                  {synopsisExpanded ? "Less" : "More"}
                </button>
              ) : null}
            </div>
            <div className="space-y-2 text-[0.875rem] font-normal leading-[1.25rem] text-[#8c8c8c]">
              {studios.length ? <p><span className="font-bold text-[#f2f2f2]/80">Studio:</span> {studios.join(", ")}</p> : null}
              {formattedSource ? <p><span className="font-bold text-[#f2f2f2]/80">Source:</span> {formattedSource}</p> : null}
              {releaseYear ? <p><span className="font-bold text-[#f2f2f2]/80">Released:</span> {releaseYear}</p> : null}
            </div>
          </div>
        </div>
      </section>
      <SidebarLayout>
        <div id="episodes" className="py-6 pb-16">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[1.125rem] font-bold leading-[1.5rem] tracking-[-0.03em] text-[#f2f2f2]">{useSeasons ? "Seasons" : "Episodes"}</h2>
              {useSeasons ? (
                <span className="rounded-[2px] bg-[#f2f2f2]/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase leading-[1] text-[#8c8c8c]">
                  {crSeasons.length} {crSeasons.length === 1 ? "season" : "seasons"} · {visibleEpisodeTotal} ep
                </span>
              ) : visibleEpisodeTotal > 0 ? (
                <span className="rounded-[2px] bg-[#f2f2f2]/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase leading-[1] text-[#8c8c8c]">
                  {visibleEpisodeTotal} total
                </span>
              ) : null}
            </div>
          </div>

          {/* Crunchyroll-style season dropdown (multi-season), else 100-episode range tabs */}
          {useSeasons ? (
            <div className="relative mb-5 inline-block">
              <button
                type="button"
                onClick={() => setSeasonOpen((open) => !open)}
                aria-expanded={seasonOpen}
                className={`flex h-[2.5rem] min-w-[260px] items-center justify-between gap-2 rounded-[1.25rem] border-[2px] px-4 text-[0.875rem] font-bold text-[#f2f2f2] transition-all duration-200 ease-in-out ${seasonOpen ? "border-[#c4182a] bg-[#515151]" : "border-transparent bg-[#414141] hover:bg-[#515151]"}`}
              >
                <span className="truncate"><span className="text-[#8c8c8c]">S{activeSeasonIndex + 1}:</span> {episodeTabs[activeSeasonIndex]}</span>
                <ChevronDown size={20} className={`shrink-0 text-[#8c8c8c] transition-transform duration-200 ease-in-out ${seasonOpen ? "rotate-180" : ""}`} />
              </button>
              {seasonOpen ? (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setSeasonOpen(false)} />
                  <div className="absolute z-30 mt-1 max-h-[240px] w-[340px] overflow-y-auto rounded-sm bg-[#212121] py-1 shadow-[0_0.25rem_1.25rem_rgba(0,0,0,.5)]">
                    {episodeTabs.map((label, i) => (
                      <button
                        key={`${label}-${i}`}
                        type="button"
                        onClick={() => { setActiveRange(i); setSeasonOpen(false); }}
                        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-[0.875rem] leading-[1.25rem] transition-colors duration-200 ${
                          activeRange === i ? "bg-[#414141] font-bold text-[#f2f2f2]" : "font-normal text-[#f2f2f2]/70 hover:bg-[#414141]"
                        }`}
                      >
                        <span className="w-7 shrink-0 text-[#8c8c8c]">S{i + 1}</span>
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : episodeTabs.length > 0 ? (
            <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
              {episodeTabs.map((label, i) => (
                <button
                  key={`${label}-${i}`}
                  onClick={() => setActiveRange(i)}
                  className={`shrink-0 rounded-[1.25rem] border-[2px] px-3 py-1.5 text-[0.75rem] font-bold uppercase transition-all duration-200 ease-in-out ${
                    activeRange === i
                      ? "border-[#c4182a] bg-[#c4182a] text-white"
                      : "border-transparent bg-[#414141] text-[#f2f2f2]/70 hover:bg-[#515151]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Episode playback list */}
          {episodeListPending ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-video w-full animate-pulse rounded-sm bg-[#151515]" />
                  <div className="mt-3 h-3 w-3/4 animate-pulse rounded-sm bg-[#151515]" />
                  <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded-sm bg-[#151515]" />
                </div>
              ))}
            </div>
          ) : rangeEpisodes.length ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {visibleEpisodes.map((ep) => {
                  const isCurrent = ep.episode_number === lastEp && Boolean(last);
                  const displayNum = ep.display_number ?? ep.episode_number;
                  const canPlay = ep.has_stream !== false;
                  const watchAnime = { ...displayAnime, mal_id: activeSeasonMal, anime_id: activeSeasonMal, id: activeSeasonMal } as Anime;
                  const href = canPlay ? (!useSeasons && isCurrent ? resumeHref : watchPath(watchAnime, activeSeasonMal, ep.episode_number)) : "#";
                  return (
                    <Link
                      key={`${activeSeasonMal}-${activeSeasonNumber}-${ep.episode_number}`}
                      href={href}
                      aria-disabled={!canPlay}
                      tabIndex={canPlay ? undefined : -1}
                      onClick={(event) => {
                        if (!canPlay) event.preventDefault();
                      }}
                      onMouseEnter={() => canPlay && prefetchWatch(ep.episode_number, activeSeasonMal)}
                      onFocus={() => canPlay && prefetchWatch(ep.episode_number, activeSeasonMal)}
                      onPointerDown={() => canPlay && prefetchWatch(ep.episode_number, activeSeasonMal)}
                      onTouchStart={() => canPlay && prefetchWatch(ep.episode_number, activeSeasonMal)}
                      title={ep.title || `Episode ${ep.episode_number}`}
                      className={`group block text-left ${canPlay ? "" : "cursor-default opacity-55"}`}
                    >
                      <div className={`relative aspect-video w-full overflow-hidden rounded-sm bg-[#151515] transition-shadow duration-200 ${isCurrent ? "shadow-[0_0_0_0.375rem_#c4182a]" : "group-hover:shadow-[0_0_0_0.375rem_#151515]"}`}>
                        {ep.thumbnail ? (
                          <ProgressiveImage
                            highSrc={imageCdnUrl(ep.thumbnail, "episode-thumb")}
                            fallbackSrc={directImageUrl(ep.thumbnail)}
                            alt={ep.title || `Episode ${ep.episode_number} thumbnail`}
                            sizes="(max-width: 640px) 50vw, 25vw"
                            imgClassName="object-center transition-opacity duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center bg-[#121318]">
                            <span className="rounded-sm border border-white/10 bg-black/25 px-2 py-1 text-[0.6875rem] font-black uppercase text-white/35">
                              EP {displayNum}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-[0.08]" />
                        {canPlay ? (
                          <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-label={`Play Episode ${displayNum}`}>
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
                              <Play size={18} fill="currentColor" />
                            </span>
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 right-2 rounded-[2px] bg-black/80 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase leading-[1] text-[#f2f2f2]">
                          EP {displayNum}
                        </span>
                        {isCurrent ? (
                          <span className="absolute left-2 top-2 rounded-[2px] bg-[#c4182a] px-1.5 py-0.5 text-[0.625rem] font-bold uppercase leading-[1] text-white">
                            Resume
                          </span>
                        ) : null}
                      </div>
                      <div className="px-[0.375rem] pb-3 pt-3">
                        <h3 className={`line-clamp-2 text-[0.875rem] font-bold leading-[1.25rem] tracking-[-0.03em] ${isCurrent ? "text-[#c4182a]" : "text-[#f2f2f2] group-hover:text-white"}`}>
                          E{displayNum} - {ep.title || `Episode ${displayNum}`}
                        </h3>
                        <p className="mt-1 text-[0.75rem] leading-[1.125rem] text-[#8c8c8c]">
                          {!canPlay ? "Stream pending" : isCurrent && localProgress > 1 ? `Resume at ${formatClock(localProgress)}` : "Sub | Dub"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {visibleEpisodes.length < rangeEpisodes.length ? (
                <button
                  type="button"
                  onClick={() => setEpisodeLimit((value) => value + 24)}
                  className="mt-6 flex h-[2.5rem] w-full items-center justify-center border-[2px] border-[#f2f2f2] bg-transparent text-[0.875rem] font-bold uppercase leading-[1.25rem] tracking-[-0.03em] text-[#f2f2f2] transition-all duration-200 ease-in-out hover:bg-[#f2f2f2]/10"
                >
                  See More Episodes
                </button>
              ) : null}
            </>
          ) : (
            <div className="rounded-sm bg-[#151515] p-10 text-center">
              <p className="text-[0.875rem] font-normal text-[#8c8c8c]">No episodes found yet.</p>
              <p className="mt-1 text-[0.75rem] text-[#8c8c8c]/60">Check back soon — we update daily.</p>
            </div>
          )}
        </div>
      </SidebarLayout>
    </AppShell>
  );
}

function formatClock(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function crSeasonKey(season?: Pick<CrSeason, "title" | "owner_mal" | "episode_count">) {
  if (!season) return "";
  return [
    String(season.title || "").trim().toLowerCase(),
    String(season.owner_mal || "").trim(),
    String(season.episode_count || "").trim(),
  ].join("|");
}

function shouldFollowCanonicalRedirect(current: Anime, card: { canonical_mal_id?: string; title?: string; selected_season?: CrSeason | undefined; seasons?: CrSeason[] } | null | undefined) {
  const canonical = String(card?.canonical_mal_id || "");
  if (!canonical) return false;
  const currentKey = titleFamilyKey(titleOf(current));
  const targetKey = titleFamilyKey(card?.title || card?.selected_season?.title || card?.seasons?.[0]?.title || "");
  if (!currentKey || !targetKey) return false;
  return currentKey === targetKey || currentKey.includes(targetKey) || targetKey.includes(currentKey);
}

function titleFamilyKey(value: string) {
  return value
    .toLowerCase()
    .replace(/kimetsu no yaiba/g, "demon slayer")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 2 && !["the", "movie", "season", "part", "arc", "episode"].includes(part))
    .slice(0, 3)
    .join(" ");
}

function heroBannerOf(anime: Anime | undefined) {
  return anime?.banner || "";
}

function cleanOverview(value?: string) {
  return value
    ?.replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s*\(Source:[^)]+\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yearFromDate(value?: string) {
  const year = Number(String(value || "").slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : undefined;
}

function formatSource(value?: string) {
  if (!value) return "";
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function titleFromSlug(value: string) {
  return value
    .replace(/-\d+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Anime";
}

function makeEpisodeHint(malId: string, total: number) {
  return {
    anime_id: malId,
    num_episodes: total,
    episodes: Array.from({ length: total }, (_, index) => ({
      episode_number: index + 1,
      title: `Episode ${index + 1}`,
    })),
    source: "animeTVplus catalog hint",
  };
}
