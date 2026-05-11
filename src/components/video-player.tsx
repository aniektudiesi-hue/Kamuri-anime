"use client";

import Hls from "hls.js";
import { Captions, ChevronRight, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StreamResponse, Subtitle } from "@/lib/types";

type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

type QualityLevel = {
  hlsIndex: number;
  height: number;
  label: string;
};

export function VideoPlayer({
  stream,
  title,
  initialTime = 0,
  nextHref,
  onProgress,
  onFatalError,
  autoPlay = true,
}: {
  stream?: StreamResponse;
  title: string;
  initialTime?: number;
  nextHref?: string;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onFatalError?: (message: string) => void;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seekBarRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastTimeRef = useRef(0);
  const restoredRef = useRef(false);
  const captionCuesRef = useRef<CaptionCue[]>([]);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  // Stable refs so callbacks never cause the HLS effect to re-run
  const onProgressRef = useRef(onProgress);
  const onFatalErrorRef = useRef(onFatalError);
  onProgressRef.current = onProgress;
  onFatalErrorRef.current = onFatalError;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seekFlash, setSeekFlash] = useState<{ dir: "forward" | "backward"; n: number } | null>(null);
  const seekFlashTimer = useRef<number | undefined>(undefined);
  const [bufferedRanges, setBufferedRanges] = useState<Array<{ start: number; end: number }>>([]);

  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  const isHlsStream = Boolean(
    src &&
      (/\.m3u8(?:$|[?#])/i.test(src) ||
        /\/m3u8(?:$|[?#])/i.test(src) ||
        /\/proxy\/(?:m3u8|moon)\b/i.test(src)),
  );
  const subtitles = useMemo(() => preferredSubtitles(stream?.subtitles), [stream?.subtitles]);
  const activeSubtitleUrl = subtitles[0]?.file ?? "";
  const subtitleCount = subtitles.length;
  const showNextPrompt = Boolean(nextHref && duration > 0 && duration - currentTime <= 60);
  const introStart = stream?.intro?.start ?? 0;
  const introEnd = stream?.intro?.end ?? 90;
  const showSkipIntro = currentTime >= introStart && currentTime < introEnd && currentTime > 0;
  const progress = useMemo(() => (duration ? (currentTime / duration) * 100 : 0), [currentTime, duration]);
  const showControls = useCallback(
    (sticky = false) => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
      setControlsOpen(true);
      if (!sticky && playing) {
        controlsTimerRef.current = window.setTimeout(() => setControlsOpen(false), 2500);
      }
    },
    [playing],
  );

  const hideControlsSoon = useCallback(() => {
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsOpen(false), 2500);
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
      if (seekFlashTimer.current) window.clearTimeout(seekFlashTimer.current);
    };
  }, []);

  const flashSeek = useCallback((dir: "forward" | "backward", seconds: number) => {
    if (seekFlashTimer.current) window.clearTimeout(seekFlashTimer.current);
    setSeekFlash({ dir, n: seconds });
    seekFlashTimer.current = window.setTimeout(() => setSeekFlash(null), 700);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    setActiveCaption("");
    setPlaybackError("");
    setIsBuffering(true);
    setQualityLevels([]);
    setSelectedQuality(-1);
    setShowQualityMenu(false);
    restoredRef.current = false;
    lastTimeRef.current = initialTime;
    const rememberTime = () => {
      if (Number.isFinite(video.currentTime) && video.currentTime > 0) {
        lastTimeRef.current = video.currentTime;
      }
      setCurrentTime(video.currentTime || 0);
      syncCaptionAt(video.currentTime || 0);
      onProgressRef.current?.({ currentTime: video.currentTime || 0, duration: video.duration || 0 });
    };
    const restoreTime = () => {
      if (restoredRef.current || lastTimeRef.current < 2 || video.duration <= lastTimeRef.current) return;
      video.currentTime = lastTimeRef.current;
      restoredRef.current = true;
    };
    const playWhenReady = async () => {
      restoreTime();
      setIsBuffering(false);
      if (!autoPlay) return;
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
    const updateBuffered = () => {
      const ranges: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
      }
      setBufferedRanges(ranges);
    };

    video.addEventListener("loadedmetadata", restoreTime);
    video.addEventListener("loadedmetadata", markDuration);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("pause", markPause);
    video.addEventListener("durationchange", markDuration);
    video.addEventListener("timeupdate", rememberTime);
    video.addEventListener("waiting", markWaiting);
    video.addEventListener("stalled", markWaiting);
    video.addEventListener("progress", updateBuffered);

    if (isHlsStream) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 7200,
          maxMaxBufferLength: 7200,
          maxBufferSize: 300 * 1000 * 1000,
          backBufferLength: 30,
          abrEwmaDefaultEstimate: 8 * 1000 * 1000,
          maxLoadingDelay: 1,
          fragLoadingMaxRetry: 6,
          manifestLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          const seen = new Set<number>();
          const levels: QualityLevel[] = data.levels
            .map((level, i) => ({ hlsIndex: i, height: level.height || 0, bitrate: level.bitrate || 0 }))
            .filter((l) => l.height > 0)
            .sort((a, b) => b.height - a.height)
            .filter((l) => {
              if (seen.has(l.height)) return false;
              seen.add(l.height);
              return true;
            })
            .map((l) => ({ hlsIndex: l.hlsIndex, height: l.height, label: `${l.height}p` }));
          setQualityLevels(levels);
          playWhenReady();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          rememberTime();
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const message = "This server blocked the playlist.";
            setPlaybackError(message);
            setIsBuffering(false);
            onFatalErrorRef.current?.(message);
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          const message = "This stream cannot be played.";
          setPlaybackError(message);
          setIsBuffering(false);
          onFatalErrorRef.current?.(message);
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
      hlsRef.current = null;
      video.removeEventListener("canplay", playWhenReady);
      video.removeEventListener("loadedmetadata", restoreTime);
      video.removeEventListener("loadedmetadata", markDuration);
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("pause", markPause);
      video.removeEventListener("durationchange", markDuration);
      video.removeEventListener("timeupdate", rememberTime);
      video.removeEventListener("waiting", markWaiting);
      video.removeEventListener("stalled", markWaiting);
      video.removeEventListener("progress", updateBuffered);
    };
  // onProgress and onFatalError are accessed via refs — omitting from deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, hideControlsSoon, initialTime, isHlsStream, src, syncCaptionAt]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }, [muted]);

  const fullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      container.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          showControls();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          lastTimeRef.current = video.currentTime;
          flashSeek("backward", 10);
          showControls();
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
          lastTimeRef.current = video.currentTime;
          flashSeek("forward", 10);
          showControls();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          showControls();
          break;
        case "f":
          e.preventDefault();
          fullscreen();
          break;
        case "ArrowUp": {
          e.preventDefault();
          const newVol = Math.min(1, (video.volume || 0) + 0.1);
          video.volume = newVol;
          setVolume(newVol);
          if (newVol > 0) {
            video.muted = false;
            setMuted(false);
          }
          showControls();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const newVol = Math.max(0, (video.volume || 0) - 0.1);
          video.volume = newVol;
          setVolume(newVol);
          showControls();
          break;
        }
        case ">":
        case ".": {
          e.preventDefault();
          const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
          setPlaybackRate((prev) => {
            const idx = speeds.indexOf(prev);
            const next = speeds[Math.min(idx + 1, speeds.length - 1)];
            video.playbackRate = next;
            return next;
          });
          showControls();
          break;
        }
        case "<":
        case ",": {
          e.preventDefault();
          const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
          setPlaybackRate((prev) => {
            const idx = speeds.indexOf(prev);
            const next = speeds[Math.max(idx - 1, 0)];
            video.playbackRate = next;
            return next;
          });
          showControls();
          break;
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleMute, fullscreen, showControls, flashSeek]);

  function clientXToFraction(clientX: number) {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function seekToFraction(f: number) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const t = f * duration;
    video.currentTime = t;
    setCurrentTime(t);
    lastTimeRef.current = t;
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
    video.currentTime = target;
    lastTimeRef.current = target;
    setCurrentTime(target);
    flashSeek(seconds > 0 ? "forward" : "backward", Math.abs(seconds));
  }

  function handleSeekPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToFraction(clientXToFraction(e.clientX));
  }

  function handleSeekPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons > 0) {
      seekToFraction(clientXToFraction(e.clientX));
    }
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

  function skipIntro() {
    const video = videoRef.current;
    if (!video) return;
    const target = stream?.intro?.end ?? 90;
    video.currentTime = target;
    lastTimeRef.current = target;
  }

  function changeSpeed(rate: number) {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const video = videoRef.current;
    if (!video) return;
    if (x < rect.width / 2) {
      video.currentTime = Math.max(0, video.currentTime - 10);
      lastTimeRef.current = video.currentTime;
      flashSeek("backward", 10);
    } else {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      lastTimeRef.current = video.currentTime;
      flashSeek("forward", 10);
    }
  }

  function changeQuality(hlsIndex: number) {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = hlsIndex;
    setSelectedQuality(hlsIndex);
    setShowQualityMenu(false);
  }

  const qualityLabel =
    selectedQuality === -1
      ? "Auto"
      : qualityLevels.find((l) => l.hlsIndex === selectedQuality)?.label ?? "Auto";

  if (!src) {
    return (
      <div className="grid aspect-video w-full place-items-center bg-black text-sm text-white/50">
        <div className="text-center">
          <p className="font-semibold text-white">No stream available</p>
          <p className="mt-1 text-white/40">Try switching to another server below.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={`Video player: ${title}`}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-black shadow-2xl shadow-black/50 outline-none"
      style={{ cursor: controlsOpen ? "default" : "none" }}
      onMouseMove={() => showControls()}
      onMouseLeave={() => {
        if (playing) hideControlsSoon();
      }}
      onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay={autoPlay}
        onClick={togglePlay}
        className="h-full w-full bg-black"
        crossOrigin="anonymous"
      />

      {/* Captions */}
      {captionsOn && activeCaption ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-[72px] z-20 flex justify-center">
          <p
            className="max-w-5xl whitespace-pre-line text-center text-[20px] font-black leading-7 text-white sm:text-[26px] sm:leading-9"
            style={{
              textShadow:
                "2px 2px 4px #000, -1px -1px 3px #000, 1px -1px 3px #000, -1px 1px 3px #000, 0 0 12px rgba(0,0,0,0.8)",
            }}
          >
            {activeCaption}
          </p>
        </div>
      ) : null}

      {/* Buffering spinner */}
      {isBuffering && !playbackError ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-white/85 shadow-[0_0_28px_rgba(255,255,255,0.18)]" />
        </div>
      ) : null}

      {/* Seek flash overlay */}
      {seekFlash ? (
        <div
          key={`${seekFlash.dir}-${seekFlash.n}`}
          className="pointer-events-none absolute inset-0 z-25 flex items-center"
          style={{ justifyContent: seekFlash.dir === "forward" ? "flex-end" : "flex-start" }}
        >
          <div className="m-8 flex flex-col items-center gap-1.5 animate-[fadeInOut_0.7s_ease-out_forwards]">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 ">
              {seekFlash.dir === "forward" ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M13 5.08V3l5 5-5 5V9.08C10.19 9.56 8 12.03 8 15c0 2.21 1.11 4.15 2.79 5.32l-1.42 1.42C7.38 20.12 6 17.7 6 15c0-3.96 2.58-7.31 6.17-8.49L13 5.08zM21 15l-5-5v3.08c-.8.26-1.52.7-2.12 1.28l1.45 1.45c.37-.35.8-.61 1.28-.77L17 15l4 0z"/>
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                  <path d="M11 5.08V3L6 8l5 5V9.08c2.81.48 5 2.95 5 5.92 0 2.21-1.11 4.15-2.79 5.32l1.42 1.42C16.62 20.12 18 17.7 18 15c0-3.96-2.58-7.31-6.17-8.49L11 5.08zM3 15l5-5v3.08c.8.26 1.52.7 2.12 1.28L8.67 15.81C8.3 15.46 7.87 15.2 7.39 15.04L7 15H3z"/>
                </svg>
              )}
            </div>
            <span className="text-xs font-bold text-white/90">{seekFlash.n} seconds</span>
          </div>
        </div>
      ) : null}

      {/* Error overlay */}
      {playbackError ? (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/85 px-6 text-center ">
          <div>
            <p className="text-base font-bold text-white">Server unavailable</p>
            <p className="mt-2 text-sm text-white/50">{playbackError} Try another server.</p>
          </div>
        </div>
      ) : null}

      {/* Skip intro button */}
      {showSkipIntro ? (
        <button
          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
          className="absolute bottom-[72px] right-4 z-50 inline-flex h-9 items-center gap-2 rounded-md border border-white/30 bg-black/85 px-4 text-sm font-bold text-white shadow-lg backdrop-blur-sm transition hover:border-white/60 hover:bg-black/95 active:scale-95"
        >
          <SkipForward size={14} />
          Skip Intro
        </button>
      ) : null}

      {/* Next episode prompt */}
      {showNextPrompt && nextHref && !showSkipIntro ? (
        <a
          href={nextHref}
          className="absolute bottom-[72px] right-4 z-50 inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-bold text-white shadow-lg hover:bg-[#f15f9a] transition-colors"
        >
          Next Episode
          <ChevronRight size={15} />
        </a>
      ) : null}

      {/* Center play/pause overlay — only shown when paused */}
      {!playing ? (
        <button
          aria-label="Play"
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-black/45 text-white shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-black/65">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      ) : null}

      {/* Bottom controls gradient + bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${
          controlsOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onMouseEnter={() => showControls(true)}
        onMouseLeave={() => {
          if (playing) hideControlsSoon();
        }}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent pointer-events-none" />

        <div className="relative px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
          {/* Custom seek bar */}
          <div
            ref={seekBarRef}
            role="slider"
            aria-label="Seek"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="group/seek relative mb-3 h-1 cursor-pointer rounded-full bg-white/[0.13] transition-[height] duration-150 hover:h-[5px] sm:mb-4"
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
          >
            {/* Buffered ranges — green */}
            {duration > 0 && bufferedRanges.map((range, i) => (
              <div
                key={i}
                className="absolute inset-y-0 rounded-full bg-white/25 pointer-events-none"
                style={{
                  left: `${(range.start / duration) * 100}%`,
                  width: `${Math.min(100, ((range.end - range.start) / duration) * 100)}%`,
                }}
              />
            ))}
            {/* Played portion — sits on top of green */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white pointer-events-none"
              style={{ width: `${progress}%` }}
            />
            {/* Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Control row */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-black/35 px-2 py-1.5 shadow-xl shadow-black/30 backdrop-blur-xl sm:gap-2">
            {/* Play/Pause */}
            <button
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white transition-colors hover:bg-white/10 hover:text-white"
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            <button
              aria-label="Rewind 10 seconds"
              onClick={() => seekBy(-10)}
              className="hidden h-8 w-8 shrink-0 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white sm:grid"
            >
              <RotateCcw size={17} />
            </button>

            <button
              aria-label="Forward 10 seconds"
              onClick={() => seekBy(10)}
              className="hidden h-8 w-8 shrink-0 place-items-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white sm:grid"
            >
              <RotateCw size={17} />
            </button>

            {/* Time */}
            <span className="min-w-[76px] font-mono text-[11px] tabular-nums text-white/70 sm:min-w-[100px] sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume (desktop only) */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={toggleMute}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => changeVolume(e.target.value)}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-accent-2"
              />
            </div>

            {/* Captions */}
            {subtitleCount > 0 ? (
              <button
                aria-label="Toggle captions"
                onClick={() => setCaptionsOn((v) => !v)}
                title={captionsOn ? "Hide captions" : "Show captions"}
                className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                  captionsOn ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Captions size={18} />
              </button>
            ) : null}

            {/* Speed selector */}
            <div className="relative">
              <button
                aria-label="Playback speed"
                aria-expanded={showSpeedMenu}
                onClick={() => { setShowSpeedMenu((v) => !v); setShowQualityMenu(false); }}
                title="Playback speed (< / >)"
                className={`flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-bold transition-colors ${
                  showSpeedMenu || playbackRate !== 1
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Gauge size={13} />
                {playbackRate === 1 ? "Speed" : `${playbackRate}×`}
              </button>
              {showSpeedMenu ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                  <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[90px] overflow-hidden rounded-xl border border-white/15 bg-black/95 py-1 shadow-2xl ">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/30">Speed</p>
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changeSpeed(rate)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 ${
                          playbackRate === rate ? "text-accent-2" : "text-white/80"
                        }`}
                      >
                        {rate === 1 ? "Normal" : `${rate}×`}
                        {playbackRate === rate ? <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Quality selector */}
            {qualityLevels.length > 1 ? (
              <div className="relative">
                <button
                  aria-label="Quality"
                  aria-expanded={showQualityMenu}
                  onClick={() => setShowQualityMenu((v) => !v)}
                  className={`h-8 rounded-xl px-2 text-xs font-bold transition-colors ${
                    showQualityMenu || selectedQuality !== -1
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {qualityLabel}
                </button>

                {showQualityMenu ? (
                  <>
                    {/* Backdrop to close */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowQualityMenu(false)}
                    />
                    {/* Menu */}
                    <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[90px] overflow-hidden rounded-xl border border-white/15 bg-black/95 py-1 shadow-2xl ">
                      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
                        Quality
                      </p>
                      {/* Auto option */}
                      <button
                        onClick={() => changeQuality(-1)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 ${
                          selectedQuality === -1 ? "text-accent-2" : "text-white/80"
                        }`}
                      >
                        Auto
                        {selectedQuality === -1 ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
                        ) : null}
                      </button>
                      {/* Per-level options */}
                      {qualityLevels.map((level) => (
                        <button
                          key={level.hlsIndex}
                          onClick={() => changeQuality(level.hlsIndex)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 ${
                            selectedQuality === level.hlsIndex ? "text-accent-2" : "text-white/80"
                          }`}
                        >
                          {level.label}
                          {selectedQuality === level.hlsIndex ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* Fullscreen */}
            <button
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={fullscreen}
              className="grid h-8 w-8 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
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

    const text = lines
      .slice(timingIndex + 1)
      .join("\n")
      .trim();
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
