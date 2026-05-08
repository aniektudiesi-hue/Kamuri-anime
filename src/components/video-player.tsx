"use client";

import Hls from "hls.js";
import { BadgeCheck, Captions, ChevronRight, Clapperboard, Maximize, Pause, Play, StepForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StreamResponse, Subtitle } from "@/lib/types";

type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

export function VideoPlayer({
  stream,
  title,
  initialTime = 0,
  nextHref,
  onProgress,
  onFatalError,
}: {
  stream?: StreamResponse;
  title: string;
  initialTime?: number;
  nextHref?: string;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onFatalError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTimeRef = useRef(0);
  const restoredRef = useRef(false);
  const captionCuesRef = useRef<CaptionCue[]>([]);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  const [activeCaption, setActiveCaption] = useState("");
  const [isBuffering, setIsBuffering] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [playbackError, setPlaybackError] = useState("");
  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  const subtitles = useMemo(() => preferredSubtitles(stream?.subtitles), [stream?.subtitles]);
  const activeSubtitleUrl = subtitles[0]?.file ?? "";
  const subtitleCount = subtitles.length;
  const showNextPrompt = Boolean(nextHref && duration > 0 && duration - currentTime <= 60);
  const showSkipIntro = Boolean(stream?.intro?.end && currentTime >= (stream.intro.start ?? 0) && currentTime < stream.intro.end);

  const showControls = useCallback(
    (sticky = false) => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
      setControlsOpen(true);
      if (!sticky && playing) {
        controlsTimerRef.current = window.setTimeout(() => setControlsOpen(false), 1700);
      }
    },
    [playing],
  );

  const hideControlsSoon = useCallback(() => {
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsOpen(false), 1700);
  }, []);

  const syncCaptionAt = useCallback((time: number) => {
    if (!Number.isFinite(time)) {
      setActiveCaption("");
      return;
    }
    const caption = captionCuesRef.current
      .filter((cue) => time >= cue.start && time < cue.end)
      .map((cue) => cue.text)
      .join("\n");
    setActiveCaption(caption ? cleanCaptionText(caption) : "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    captionCuesRef.current = [];

    if (!activeSubtitleUrl) return;

    fetch(activeSubtitleUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Subtitle request failed with ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        captionCuesRef.current = parseVttCues(text);
        syncCaptionAt(videoRef.current?.currentTime ?? 0);
      })
      .catch(() => {
        if (!cancelled) captionCuesRef.current = [];
      });

    return () => {
      cancelled = true;
    };
  }, [activeSubtitleUrl, syncCaptionAt]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    setActiveCaption("");
    setPlaybackError("");
    setIsBuffering(true);
    restoredRef.current = false;
    lastTimeRef.current = initialTime;

    const rememberTime = () => {
      if (Number.isFinite(video.currentTime) && video.currentTime > 0) {
        lastTimeRef.current = video.currentTime;
      }
      setCurrentTime(video.currentTime || 0);
      syncCaptionAt(video.currentTime || 0);
      onProgress?.({ currentTime: video.currentTime || 0, duration: video.duration || 0 });
    };
    const restoreTime = () => {
      if (restoredRef.current || lastTimeRef.current < 2 || video.duration <= lastTimeRef.current) return;
      video.currentTime = lastTimeRef.current;
      restoredRef.current = true;
    };
    const playWhenReady = async () => {
      restoreTime();
      setIsBuffering(false);
      try {
        await video.play();
      } catch {
        video.muted = true;
        await video.play().catch(() => undefined);
      }
    };
    const markWaiting = () => {
      rememberTime();
      setIsBuffering(true);
    };
    const markPlaying = () => {
      setIsBuffering(false);
      setPlaying(true);
      setControlsOpen(true);
      hideControlsSoon();
      rememberTime();
    };
    const markPause = () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
      setControlsOpen(true);
      setPlaying(false);
    };
    const markDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);

    video.addEventListener("loadedmetadata", restoreTime);
    video.addEventListener("loadedmetadata", markDuration);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("pause", markPause);
    video.addEventListener("durationchange", markDuration);
    video.addEventListener("timeupdate", rememberTime);
    video.addEventListener("waiting", markWaiting);
    video.addEventListener("stalled", markWaiting);

    if (src.includes(".m3u8") || src.includes("/proxy/m3u8")) {
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, playWhenReady);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          rememberTime();
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const message = "This server blocked the playlist.";
            setPlaybackError(message);
            setIsBuffering(false);
            onFatalError?.(message);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          const message = "This stream cannot be played.";
          setPlaybackError(message);
          setIsBuffering(false);
          onFatalError?.(message);
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("canplay", playWhenReady, { once: true });
      }
    } else {
      video.src = src;
      video.addEventListener("canplay", playWhenReady, { once: true });
    }

    return () => {
      hls?.destroy();
      video.removeEventListener("canplay", playWhenReady);
      video.removeEventListener("loadedmetadata", restoreTime);
      video.removeEventListener("loadedmetadata", markDuration);
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("pause", markPause);
      video.removeEventListener("durationchange", markDuration);
      video.removeEventListener("timeupdate", rememberTime);
      video.removeEventListener("waiting", markWaiting);
      video.removeEventListener("stalled", markWaiting);
    };
  }, [hideControlsSoon, initialTime, onFatalError, onProgress, src, syncCaptionAt]);

  const progress = useMemo(() => (duration ? (currentTime / duration) * 100 : 0), [currentTime, duration]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }

  function seek(value: string) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const nextTime = (Number(value) / 100) * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    lastTimeRef.current = nextTime;
  }

  function changeVolume(value: string) {
    const video = videoRef.current;
    const nextVolume = Number(value) / 100;
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }

  function toggleCaptions() {
    setCaptionsOn((value) => !value);
  }

  function fullscreen() {
    videoRef.current?.parentElement?.requestFullscreen?.();
  }

  function skipIntro() {
    const video = videoRef.current;
    if (!video || !stream?.intro?.end) return;
    video.currentTime = stream.intro.end;
    lastTimeRef.current = stream.intro.end;
  }

  if (!src) {
    return (
      <PlayerShell title={title} badges={["No source"]}>
        <div className="grid aspect-video w-full place-items-center bg-black text-sm font-semibold text-muted">No HLS stream for this server.</div>
      </PlayerShell>
    );
  }

  return (
    <PlayerShell title={title} badges={["HLS", subtitleCount ? `${subtitleCount} captions` : "Direct stream"]}>
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          onClick={togglePlay}
          onMouseMove={() => showControls()}
          className="h-full w-full bg-black"
          crossOrigin="anonymous"
        />
        {captionsOn && activeCaption ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-16 z-20 flex justify-center">
            <p
              className="max-w-5xl whitespace-pre-line text-center text-[22px] font-black leading-7 text-white sm:text-[28px] sm:leading-9"
              style={{
                WebkitTextStroke: "0.7px #000",
                textShadow: "rgb(0, 0, 0) 2px 2px 0px, rgb(0, 0, 0) -1px -1px 0px, rgb(0, 0, 0) 1px -1px 0px, rgb(0, 0, 0) -1px 1px 0px",
              }}
            >
              {activeCaption}
            </p>
          </div>
        ) : null}
        {isBuffering ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="grid place-items-center gap-3 rounded-full bg-black/45 px-6 py-5 backdrop-blur-sm">
              <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-slate-300/25 border-t-slate-100 shadow-[0_0_28px_rgba(226,232,240,0.45)]" />
            </div>
          </div>
        ) : null}
        {playbackError ? (
          <div className="absolute inset-0 z-40 grid place-items-center bg-black/72 px-4 text-center backdrop-blur-sm">
            <div className="max-w-md rounded-md border border-white/10 bg-[#11131d] p-5 shadow-2xl">
              <p className="text-base font-black text-white">Server unavailable</p>
              <p className="mt-2 text-sm text-muted">{playbackError} Try another server below.</p>
            </div>
          </div>
        ) : null}
        {showSkipIntro ? (
          <button onClick={skipIntro} className="absolute bottom-24 right-4 z-30 inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-black text-black shadow-2xl hover:bg-accent-2">
            <StepForward size={16} />
            Skip intro
          </button>
        ) : null}
        {showNextPrompt && nextHref ? (
          <a href={nextHref} className="absolute bottom-24 right-4 z-30 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-black text-white shadow-2xl hover:bg-[#f15f9a]">
            Next episode
            <ChevronRight size={16} />
          </a>
        ) : null}
        <button
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
          onMouseMove={() => showControls()}
          className={`absolute inset-0 z-10 grid place-items-center transition ${controlsOpen || !playing ? "opacity-100" : "opacity-0"}`}
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            {playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
          </span>
        </button>
        <div
          className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-10 transition ${
            controlsOpen ? "opacity-100" : "opacity-0"
          }`}
          onMouseMove={() => showControls()}
          onMouseEnter={() => showControls(true)}
          onMouseLeave={() => showControls()}
        >
          <input
            aria-label="Seek"
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => seek(event.target.value)}
            className="h-1 w-full accent-accent-2"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} className="grid h-9 w-9 place-items-center rounded bg-white/10 hover:bg-white/20">
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <span className="font-mono text-xs text-white/85">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className="grid h-9 w-9 place-items-center rounded bg-white/10 hover:bg-white/20">
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : volume * 100}
                onChange={(event) => changeVolume(event.target.value)}
                className="hidden h-1 w-20 accent-accent-2 sm:block"
              />
              {subtitleCount ? (
                <button
                  aria-label="Toggle captions"
                  onClick={toggleCaptions}
                  className={`grid h-9 w-9 place-items-center rounded ${captionsOn ? "bg-accent-2 text-black" : "bg-white/10 hover:bg-white/20"}`}
                >
                  <Captions size={18} />
                </button>
              ) : null}
              <button aria-label="Fullscreen" onClick={fullscreen} className="grid h-9 w-9 place-items-center rounded bg-white/10 hover:bg-white/20">
                <Maximize size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PlayerShell>
  );
}

function preferredSubtitles(subtitles: Subtitle[] | undefined) {
  const valid = (subtitles ?? []).filter((subtitle) => subtitle.file);
  const english = valid.filter((subtitle) => subtitleRank(subtitle) === 0);
  return (english.length ? english : valid).sort((a, b) => subtitleRank(a) - subtitleRank(b));
}

function subtitleRank(subtitle: Subtitle) {
  const text = `${subtitle.label ?? ""} ${subtitle.file ?? ""}`.toLowerCase();
  if (/\b(en|eng|english)\b/.test(text) || text.includes("english")) return 0;
  if (text.includes("urdu") || /\bur\b/.test(text)) return 3;
  return 1;
}

function cleanCaptionText(text: string) {
  return text
    .replace(/<\/?i\??>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseVttCues(vtt: string): CaptionCue[] {
  const blocks = vtt.replace(/\r/g, "").split(/\n{2,}/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length || lines[0] === "WEBVTT" || lines[0].startsWith("NOTE")) continue;

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) continue;

    const [startText, endWithSettings] = lines[timingIndex].split("-->").map((part) => part.trim());
    const endText = endWithSettings?.split(/\s+/)[0];
    const start = parseVttTime(startText);
    const end = parseVttTime(endText);
    if (start === undefined || end === undefined || end <= start) continue;

    const text = lines.slice(timingIndex + 1).join("\n").trim();
    if (text) cues.push({ start, end, text });
  }

  return cues;
}

function parseVttTime(value: string | undefined) {
  if (!value) return undefined;
  const parts = value.split(":");
  const secondsPart = parts.pop();
  if (!secondsPart || !parts.length) return undefined;

  const seconds = Number(secondsPart.replace(",", "."));
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  if (![seconds, minutes, hours].every(Number.isFinite)) return undefined;

  return hours * 3600 + minutes * 60 + seconds;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function PlayerShell({ title, badges, children }: { title: string; badges: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#07080d] shadow-2xl shadow-black/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-panel-strong via-[#151722] to-panel px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
            <Clapperboard size={20} />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-black">{title}</p>
            <p className="text-xs text-muted">Adaptive player</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge} className="inline-flex h-7 items-center gap-1 rounded bg-white/8 px-2 text-xs font-bold text-muted">
              {badge.includes("caption") ? <Captions size={13} /> : <BadgeCheck size={13} />}
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-accent-2/80 to-transparent" />
        {children}
      </div>
    </div>
  );
}
