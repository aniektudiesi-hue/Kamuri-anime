"use client";

import Hls from "hls.js";
import Image from "next/image";
import { Captions, ChevronRight, Gauge, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Settings2, SkipForward, Volume2, VolumeX } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CaptionSettings = {
  x: number;
  y: number;
  size: number;
  weight: number;
  opacity: number;
  boxOpacity: number;
};

type WebKitFullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait" | "any" | "natural") => Promise<void>;
  unlock?: () => void;
};

const CAPTION_SETTINGS_KEY = "anime-tv-caption-settings-v1";
const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  x: 50,
  y: 78,
  size: 24,
  weight: 800,
  opacity: 1,
  boxOpacity: 0.22,
};

export function VideoPlayer({
  stream,
  title,
  poster,
  serverId,
  initialTime = 0,
  nextHref,
  onProgress,
  onFatalError,
  autoPlay = true,
  deepBuffer = true,
}: {
  stream?: StreamResponse;
  title: string;
  poster?: string;
  serverId?: string;
  initialTime?: number;
  nextHref?: string;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onFatalError?: (message: string) => void;
  autoPlay?: boolean;
  deepBuffer?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seekBarRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastTimeRef = useRef(0);
  const restoredRef = useRef(false);
  const playIntentRef = useRef(autoPlay);
  const deepBufferArmedRef = useRef(false);
  const captionCuesRef = useRef<CaptionCue[]>([]);
  const activeCaptionRef = useRef("");
  const captionDragRef = useRef(false);
  const captionRafRef = useRef<number | undefined>(undefined);
  const controlsTimerRef = useRef<number | undefined>(undefined);
  // Stable refs so callbacks never cause the HLS effect to re-run
  const onProgressRef = useRef(onProgress);
  const onFatalErrorRef = useRef(onFatalError);

  const [activeCaption, setActiveCaption] = useState("");
  const [isBuffering, setIsBuffering] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [playbackError, setPlaybackError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [captionSettingsOpen, setCaptionSettingsOpen] = useState(false);
  const [captionEditUnlocked, setCaptionEditUnlocked] = useState(false);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(DEFAULT_CAPTION_SETTINGS);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [seekFlash, setSeekFlash] = useState<{ dir: "forward" | "backward"; n: number } | null>(null);
  const seekFlashTimer = useRef<number | undefined>(undefined);
  const [bufferedRanges, setBufferedRanges] = useState<Array<{ start: number; end: number }>>([]);
  const [bufferAhead, setBufferAhead] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);

  const src = stream?.m3u8_url || stream?.stream_url || stream?.url;
  const isMegaPlayServer =
    serverId === "mega" ||
    stream?.server === "megaplay" ||
    stream?.server === "mega" ||
    Boolean(src?.includes("/api/stream/") || src?.includes("/proxy/megaplay/"));
  const isMoonStream = stream?.server === "moon" || Boolean(src?.includes("/proxy/moon/"));
  const isHlsStream = Boolean(
    src &&
      (/\.m3u8(?:$|[?#])/i.test(src) ||
        /\/m3u8(?:$|[?#])/i.test(src) ||
        /\/proxy\/(?:m3u8|moon)\b/i.test(src)),
  );
  const subtitles = useMemo(
    () => preferredSubtitles(stream?.subtitles, stream?.subtitle_url, stream?.vtt_url),
    [stream?.subtitles, stream?.subtitle_url, stream?.vtt_url],
  );
  const activeSubtitle = subtitles[selectedSubtitleIndex] ?? subtitles[0];
  const activeSubtitleUrl = activeSubtitle?.file ?? "";
  const subtitleCount = subtitles.length;
  const showNextPrompt = Boolean(nextHref && duration > 0 && duration - currentTime <= 60);
  const hasMegaPlayIntro =
    isMegaPlayServer &&
    Number.isFinite(stream?.intro?.start) &&
    Number.isFinite(stream?.intro?.end) &&
    Number(stream?.intro?.end) > Number(stream?.intro?.start);
  const introStart = hasMegaPlayIntro ? Number(stream?.intro?.start) : 0;
  const introEnd = hasMegaPlayIntro ? Number(stream?.intro?.end) : 0;
  const showSkipIntro = hasMegaPlayIntro && currentTime >= introStart && currentTime < introEnd && currentTime > 0;
  const progress = useMemo(() => (duration ? (currentTime / duration) * 100 : 0), [currentTime, duration]);
  const bufferAheadLabel = useMemo(() => formatBufferAhead(bufferAhead), [bufferAhead]);
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

  useEffect(() => {
    if (subtitleCount === 0) {
      if (selectedSubtitleIndex !== 0) setSelectedSubtitleIndex(0);
      return;
    }
    if (selectedSubtitleIndex >= subtitleCount) setSelectedSubtitleIndex(0);
  }, [selectedSubtitleIndex, subtitleCount]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onFatalErrorRef.current = onFatalError;
  }, [onFatalError]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CAPTION_SETTINGS_KEY);
      if (saved) {
        setCaptionSettings({ ...DEFAULT_CAPTION_SETTINGS, ...JSON.parse(saved) });
      } else if (window.innerHeight <= 540) {
        setCaptionSettings((current) => ({ ...current, y: 20, size: 16, boxOpacity: 0.16 }));
      }
    } catch {
      setCaptionSettings(DEFAULT_CAPTION_SETTINGS);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CAPTION_SETTINGS_KEY, JSON.stringify(captionSettings));
  }, [captionSettings]);

  const hideControlsSoon = useCallback(() => {
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsOpen(false), 2500);
  }, []);

  const syncCaptionAt = useCallback((time: number) => {
    if (!Number.isFinite(time)) {
      if (activeCaptionRef.current) {
        activeCaptionRef.current = "";
        setActiveCaption("");
      }
      return;
    }
    const caption = captionCuesRef.current
      .filter((cue) => time >= cue.start && time < cue.end)
      .map((cue) => cue.text)
      .join("\n");
    const next = caption ? cleanCaptionText(caption) : "";
    if (activeCaptionRef.current !== next) {
      activeCaptionRef.current = next;
      setActiveCaption(next);
    }
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
      if (captionRafRef.current) window.cancelAnimationFrame(captionRafRef.current);
    };
  }, []);

  const updateCaptionPosition = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 7, 93);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 8, 90);
    setCaptionSettings((current) => ({
      ...current,
      x: Math.round(x),
      y: Math.round(y),
    }));
  }, []);

  const handleCaptionPointerDown = useCallback((event: PointerEvent<HTMLParagraphElement>) => {
    if (!captionEditUnlocked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    captionDragRef.current = true;
    updateCaptionPosition(event.clientX, event.clientY);
  }, [captionEditUnlocked, updateCaptionPosition]);

  const handleCaptionPointerMove = useCallback((event: PointerEvent<HTMLParagraphElement>) => {
    if (!captionDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const { clientX, clientY } = event;
    if (captionRafRef.current) return;
    captionRafRef.current = window.requestAnimationFrame(() => {
      captionRafRef.current = undefined;
      updateCaptionPosition(clientX, clientY);
    });
  }, [updateCaptionPosition]);

  const stopCaptionDrag = useCallback((event: PointerEvent<HTMLParagraphElement>) => {
    event.stopPropagation();
    captionDragRef.current = false;
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
    setPipSupported(Boolean(document.pictureInPictureEnabled && video && "requestPictureInPicture" in video));
    if (!video) return;
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let hls: Hls | null = null;
    activeCaptionRef.current = "";
    setActiveCaption("");
    setPlaybackError("");
    setIsBuffering(true);
    setBufferedRanges([]);
    setBufferAhead(0);
    setBufferedPercent(0);
    setHasVideoFrame(false);
    setQualityLevels([]);
    setSelectedQuality(-1);
    setShowQualityMenu(false);
    restoredRef.current = false;
    playIntentRef.current = autoPlay;
    deepBufferArmedRef.current = false;
    lastTimeRef.current = initialTime;
    let playRequested = false;
    const targetForwardBuffer = deepBuffer
      ? (isMoonStream ? 2.5 * 60 : 6 * 60)
      : (isMoonStream ? 2 * 60 : 2 * 60);
    const initialForwardBuffer = Math.min(targetForwardBuffer, isMoonStream ? 18 : 60);
    const armDeepBuffer = () => {
      if (!hls || deepBufferArmedRef.current) return;
      deepBufferArmedRef.current = true;
      const config = hls.config as Hls["config"] & {
        maxBufferLength: number;
        maxMaxBufferLength: number;
        maxBufferSize: number;
        backBufferLength: number;
      };
      config.maxBufferLength = targetForwardBuffer;
      config.maxMaxBufferLength = Math.max(targetForwardBuffer, targetForwardBuffer + 120);
      config.maxBufferSize = isMoonStream ? 128 * 1000 * 1000 : deepBuffer ? 384 * 1000 * 1000 : 96 * 1000 * 1000;
      config.backBufferLength = isMoonStream ? 12 : 20;
    };
    let lastBufferUiAt = 0;
    const updateBuffered = (force = false) => {
      const ranges: Array<{ start: number; end: number }> = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
      }
      const ahead = bufferedAheadOf(video);
      const furthest = ranges.reduce((max, range) => Math.max(max, range.end), 0);
      const percent = video.duration ? Math.min(100, (furthest / video.duration) * 100) : 0;
      const now = performance.now();
      if (force || now - lastBufferUiAt > 1000) {
        lastBufferUiAt = now;
        setBufferedRanges(ranges);
        setBufferAhead(ahead);
        setBufferedPercent(percent);
      }
      return ahead;
    };
    const hasEnoughBuffer = () => updateBuffered(true) > 0.7 || video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
    const rememberTime = () => {
      if (Number.isFinite(video.currentTime) && video.currentTime > 0) {
        lastTimeRef.current = video.currentTime;
      }
      setCurrentTime(video.currentTime || 0);
      updateBuffered();
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
      if (playRequested) return;
      playRequested = true;
      playIntentRef.current = true;
      try {
        await video.play();
      } catch {
        video.muted = true;
        await video.play().catch(() => undefined);
      }
    };
    const markWaiting = () => {
      rememberTime();
      if (video.paused || video.ended || !playIntentRef.current || hasEnoughBuffer()) {
        setIsBuffering(false);
        return;
      }
      setIsBuffering(true);
    };
    const markPlaying = () => {
      setHasVideoFrame(true);
      playIntentRef.current = true;
      setIsBuffering(false);
      setPlaying(true);
      setControlsOpen(true);
      hideControlsSoon();
      armDeepBuffer();
      rememberTime();
    };
    const markCanPlay = () => {
      setHasVideoFrame(true);
      setIsBuffering(false);
      playWhenReady();
    };
    const markPause = () => {
      playIntentRef.current = false;
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
      setControlsOpen(true);
      setIsBuffering(false);
      setPlaying(false);
    };
    const markDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);

    video.addEventListener("loadedmetadata", restoreTime);
    video.addEventListener("loadedmetadata", markDuration);
    video.addEventListener("loadeddata", markCanPlay);
    video.addEventListener("canplay", markCanPlay);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("pause", markPause);
    video.addEventListener("durationchange", markDuration);
    video.addEventListener("timeupdate", rememberTime);
    video.addEventListener("waiting", markWaiting);
    video.addEventListener("stalled", markWaiting);
    const updateBufferedFromEvent = () => updateBuffered(true);
    video.addEventListener("progress", updateBufferedFromEvent);

    if (isHlsStream) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          progressive: true,
          lowLatencyMode: true,
          autoStartLoad: true,
          startFragPrefetch: true,
          startPosition: initialTime > 2 ? initialTime : 0,
          testBandwidth: false,
          capLevelToPlayerSize: true,
          startLevel: isMoonStream ? 0 : -1,
          maxBufferLength: initialForwardBuffer,
          maxMaxBufferLength: Math.max(initialForwardBuffer, 180),
          maxBufferSize: isMoonStream ? 96 * 1000 * 1000 : deepBuffer ? 240 * 1000 * 1000 : 140 * 1000 * 1000,
          maxBufferHole: 0.35,
          backBufferLength: isMoonStream ? 10 : 15,
          fragLoadingMaxRetry: isMoonStream ? 8 : 5,
          manifestLoadingMaxRetry: isMoonStream ? 5 : 3,
          levelLoadingMaxRetry: isMoonStream ? 5 : 3,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls?.startLoad(initialTime > 2 ? initialTime : 0);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          if (isMoonStream) {
            hls!.startLevel = 0;
            hls!.nextLevel = 0;
          }
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
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          setIsBuffering(false);
          updateBuffered(true);
          armDeepBuffer();
          playWhenReady();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          rememberTime();
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!video.paused && playIntentRef.current) setIsBuffering(true);
            hls?.startLoad(Math.max(0, lastTimeRef.current || video.currentTime || 0));
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
      try {
        hls?.stopLoad();
        hls?.detachMedia();
        hls?.destroy();
      } catch {
        // Best-effort shutdown; a new player instance will own the next source.
      }
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("canplay", playWhenReady);
      video.removeEventListener("loadedmetadata", restoreTime);
      video.removeEventListener("loadedmetadata", markDuration);
      video.removeEventListener("loadeddata", markCanPlay);
      video.removeEventListener("canplay", markCanPlay);
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("pause", markPause);
      video.removeEventListener("durationchange", markDuration);
      video.removeEventListener("timeupdate", rememberTime);
      video.removeEventListener("waiting", markWaiting);
      video.removeEventListener("stalled", markWaiting);
      video.removeEventListener("progress", updateBufferedFromEvent);
    };
  }, [autoPlay, deepBuffer, hideControlsSoon, initialTime, isHlsStream, isMoonStream, src, syncCaptionAt]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      playIntentRef.current = true;
      setIsBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && bufferedAheadOf(video) < 0.7);
      video.play().catch(() => undefined);
    } else {
      playIntentRef.current = false;
      setIsBuffering(false);
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }, [muted]);

  const fullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current as WebKitFullscreenVideo | null;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      (screen.orientation as LockableScreenOrientation | undefined)?.unlock?.();
    } else {
      try {
        await container.requestFullscreen({ navigationUI: "hide" });
        await (screen.orientation as LockableScreenOrientation | undefined)?.lock?.("landscape").catch(() => undefined);
      } catch {
        video?.webkitEnterFullscreen?.();
      }
    }
  }, []);

  const togglePictureInPicture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled || !("requestPictureInPicture" in video)) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => undefined);
    } else {
      video.requestPictureInPicture().catch(() => undefined);
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
        case "p":
          e.preventDefault();
          togglePictureInPicture();
          showControls();
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
  }, [togglePlay, toggleMute, fullscreen, togglePictureInPicture, showControls, flashSeek]);

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
    if (!hls || qualityLevels.length <= 1) {
      setShowQualityMenu(false);
      return;
    }
    hls.currentLevel = hlsIndex;
    setSelectedQuality(hlsIndex);
    setShowQualityMenu(false);
  }

  const hasSwitchableQuality = isHlsStream && qualityLevels.length > 1;
  const qualityLabel =
    !isHlsStream
      ? "Source"
      : qualityLevels.length === 1
        ? qualityLevels[0].label
        : selectedQuality === -1
      ? "Auto"
      : qualityLevels.find((l) => l.hlsIndex === selectedQuality)?.label ?? "Auto";
  const qualityNote = !isHlsStream
    ? "This server is a direct source, so quality is fixed."
    : qualityLevels.length <= 1
      ? "This playlist exposes one adaptive profile."
      : "Switch HLS variants without changing servers.";
  const displayedCaption = activeCaption || (captionSettingsOpen ? "Caption preview - drag me anywhere" : "");

  if (!src) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-white/[0.08] bg-black text-sm text-white/50 sm:aspect-video">
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
      className="video-player-shell group relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.095] bg-black shadow-[0_32px_110px_rgba(0,0,0,0.78)] outline-none ring-1 ring-white/[0.035] sm:rounded-[22px]"
      style={{ cursor: controlsOpen ? "default" : "none" }}
      onMouseMove={() => showControls()}
      onMouseLeave={() => {
        if (playing) hideControlsSoon();
      }}
      onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        width={1920}
        height={1080}
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        poster={poster}
        onClick={togglePlay}
        className="h-full w-full bg-black object-contain"
        crossOrigin="anonymous"
      />

      {poster && !hasVideoFrame && !playbackError ? (
        <div className="pointer-events-none absolute inset-0 z-10 bg-black">
          <Image src={poster} alt="" fill sizes="100vw" className="object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/32" />
          <div className="absolute inset-0 bg-black/12" />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,transparent_24%,transparent_58%,rgba(0,0,0,0.92)_100%)]" />

      {/* Top glass title rail */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 hidden items-start justify-between gap-3 px-3 pt-3 transition-opacity duration-300 sm:flex sm:px-5 sm:pt-5 ${
          controlsOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="min-w-0 rounded-3xl border border-white/[0.09] bg-black/34 px-3 py-2 shadow-2xl backdrop-blur-2xl sm:px-4">
          <p className="line-clamp-1 text-sm font-semibold text-white sm:text-base">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            <span>{stream?.server || "HLS"}</span>
            <span className="h-1 w-1 rounded-full bg-white/25" />
            <span>{qualityLabel}</span>
          </div>
        </div>

        <div className="hidden rounded-full border border-white/[0.08] bg-black/32 px-3 py-1.5 text-[11px] font-black text-white/58 shadow-2xl backdrop-blur-2xl sm:block">
          {bufferAhead > 2 ? `${bufferAheadLabel} ready` : "Starting"}
        </div>
      </div>

      {/* Captions */}
      {captionsOn && displayedCaption ? (
        <div
          className="anime-caption-wrap pointer-events-none absolute z-40 flex justify-center"
          style={{
            left: `${captionSettings.x}%`,
            top: `${captionSettings.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <p
            className={`anime-caption-text max-w-5xl whitespace-pre-line text-center text-white ${captionEditUnlocked ? "anime-caption-editable pointer-events-auto" : "pointer-events-none"}`}
            onPointerDown={handleCaptionPointerDown}
            onPointerMove={handleCaptionPointerMove}
            onPointerUp={stopCaptionDrag}
            onPointerCancel={stopCaptionDrag}
            style={{
              background: `rgba(0,0,0,${captionSettings.boxOpacity})`,
              fontSize: `${captionSettings.size}px`,
              fontWeight: captionSettings.weight,
              opacity: captionSettings.opacity,
              textShadow:
                "2px 2px 4px #000, -1px -1px 3px #000, 1px -1px 3px #000, -1px 1px 3px #000, 0 0 12px rgba(0,0,0,0.8)",
            }}
            title="Drag captions"
          >
            {displayedCaption}
          </p>
        </div>
      ) : null}

      {/* Buffering spinner */}
      {isBuffering && !playbackError ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="relative grid h-[72px] w-[72px] place-items-center rounded-full border border-white/[0.1] bg-black/22 shadow-[0_24px_80px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
            <div className="absolute inset-2.5 animate-spin rounded-full border-[3px] border-white/10 border-t-white/95" />
            <div className="h-2 w-2 rounded-full bg-white/95 shadow-[0_0_22px_rgba(255,255,255,0.85)]" />
          </div>
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
            <p className="text-base font-bold text-white">Playback issue</p>
            <p className="mt-2 text-sm text-white/50">{playbackError}</p>
          </div>
        </div>
      ) : null}

      {/* Skip intro button */}
      {showSkipIntro ? (
        <button
          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
          className="absolute bottom-[84px] right-3 z-50 inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cf2442]/35 bg-[#cf2442]/90 px-3 text-xs font-black text-white shadow-[0_14px_36px_rgba(207,36,66,0.24)] backdrop-blur-xl transition hover:border-[#ff8a9d]/50 hover:bg-[#dc2d4b] active:scale-95 sm:bottom-[86px] sm:right-4"
        >
          <span className="grid h-5 w-5 place-items-center rounded-lg bg-white/10">
            <SkipForward size={12} />
          </span>
          Skip
        </button>
      ) : null}

      {/* Next episode prompt */}
      {showNextPrompt && nextHref && !showSkipIntro ? (
        <a
          href={nextHref}
          className="absolute bottom-[132px] right-4 z-50 inline-flex h-10 items-center gap-1.5 rounded-full bg-[#cf2442] px-4 text-sm font-black text-white shadow-lg shadow-[#cf2442]/22 transition-colors hover:bg-[#dc2d4b] sm:bottom-[126px]"
        >
          Next Episode
          <ChevronRight size={15} />
        </a>
      ) : null}

      {/* Center play/pause overlay — only shown when paused */}
      {!playing && !isBuffering ? (
        <button
          aria-label="Play"
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full border border-white/18 bg-black/42 text-white shadow-[0_24px_90px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition hover:scale-105 hover:bg-black/58">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      ) : null}

      {/* Bottom controls gradient + bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300 ${
          controlsOpen || captionSettingsOpen || showSpeedMenu || showQualityMenu ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onMouseEnter={() => showControls(true)}
        onMouseLeave={() => {
          if (playing) hideControlsSoon();
        }}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/54 to-transparent pointer-events-none" />

        <div className="relative px-2 pb-2 pt-8 sm:px-5 sm:pb-5 sm:pt-10">
          {/* Custom seek bar */}
          <div
            ref={seekBarRef}
            role="slider"
            aria-label="Seek"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="group/seek relative mb-2 h-1 cursor-pointer rounded-full bg-white/[0.16] transition-[height] duration-150 hover:h-[7px] sm:mb-4 sm:h-1.5"
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
          >
            {/* Buffered ranges — green */}
            {duration > 0 && bufferedRanges.map((range, i) => (
              <div
                key={i}
                className="absolute inset-y-0 rounded-full bg-white/30 pointer-events-none"
                style={{
                  left: `${(range.start / duration) * 100}%`,
                  width: `${Math.min(100, ((range.end - range.start) / duration) * 100)}%`,
                }}
              />
            ))}
            {/* Played portion — sits on top of green */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#cf2442] pointer-events-none shadow-[0_0_20px_rgba(207,36,66,0.58)]"
              style={{ width: `${progress}%` }}
            />
            {/* Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Control row */}
          <div className="flex items-center gap-1 rounded-2xl border border-white/[0.1] bg-black/50 px-1.5 py-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.56)] backdrop-blur-2xl sm:gap-2 sm:rounded-[24px] sm:px-2.5 sm:py-2">
            {/* Play/Pause */}
            <button
              aria-label={playing ? "Pause" : "Play"}
              onClick={togglePlay}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white transition-colors hover:bg-white/10 hover:text-white"
            >
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
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
            <span className="min-w-[62px] font-mono text-[10px] tabular-nums text-white/70 sm:min-w-[100px] sm:text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <span
              className="hidden min-w-[74px] rounded-full bg-white/[0.06] px-2 py-1 text-center text-[10px] font-semibold text-white/42 sm:inline-block"
              title={`${Math.round(bufferedPercent)}% buffered`}
            >
              {bufferAhead > 2 ? bufferAheadLabel : "0s ready"}
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
            <button
              aria-label={subtitleCount > 0 ? "Toggle captions" : "Captions unavailable"}
              disabled={subtitleCount === 0}
              onClick={() => subtitleCount > 0 && setCaptionsOn((v) => !v)}
              title={subtitleCount > 0 ? (captionsOn ? "Hide captions" : "Show captions") : "No captions for this server"}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                captionsOn && subtitleCount > 0 ? "bg-white/10 text-white" : "text-white/45 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Captions size={18} />
            </button>

            {subtitleCount > 0 ? (
              <div className="relative">
                <button
                  aria-label="Caption settings"
                  aria-expanded={captionSettingsOpen}
                  onClick={() => {
                    setCaptionSettingsOpen((value) => {
                      const next = !value;
                      setCaptionEditUnlocked(next);
                      return next;
                    });
                    setShowSpeedMenu(false);
                    setShowQualityMenu(false);
                    setCaptionsOn(true);
                    showControls(true);
                  }}
                  title="Caption settings"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
                    captionSettingsOpen ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Settings2 size={17} />
                </button>
                {captionSettingsOpen ? (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setCaptionSettingsOpen(false);
                        setCaptionEditUnlocked(false);
                      }}
                    />
                    <div className="fixed inset-x-3 bottom-20 z-50 overflow-hidden rounded-2xl border border-white/15 bg-black/95 p-3 shadow-2xl sm:absolute sm:bottom-full sm:right-0 sm:left-auto sm:mb-2 sm:w-[280px]">
                      <div className="mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Captions</p>
                        <p className="mt-1 text-xs text-white/42">Drag is unlocked. Move captions on the video, then save to lock them.</p>
                      </div>

                      <div
                        className="mb-3 rounded-xl border border-white/[0.08] p-3 text-center text-white"
                        style={{
                          background: `rgba(0,0,0,${captionSettings.boxOpacity})`,
                          fontSize: `${Math.max(13, Math.min(20, captionSettings.size - 4))}px`,
                          fontWeight: captionSettings.weight,
                          opacity: captionSettings.opacity,
                        }}
                      >
                        Caption preview
                      </div>

                      {subtitleCount > 1 ? (
                        <div className="mb-3 max-h-28 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
                          {subtitles.map((subtitle, index) => (
                            <button
                              key={`${subtitle.file}-${index}`}
                              type="button"
                              onClick={() => {
                                setSelectedSubtitleIndex(index);
                                setCaptionsOn(true);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                                selectedSubtitleIndex === index
                                  ? "bg-[#cf2442]/18 text-white"
                                  : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              <span className="line-clamp-1">{subtitleLabel(subtitle, index)}</span>
                              {selectedSubtitleIndex === index ? <span className="h-1.5 w-1.5 rounded-full bg-[#cf2442]" /> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <CaptionSlider
                          label="X position"
                          value={captionSettings.x}
                          min={7}
                          max={93}
                          suffix="%"
                          onChange={(x) => setCaptionSettings((current) => ({ ...current, x }))}
                        />
                        <CaptionSlider
                          label="Y position"
                          value={captionSettings.y}
                          min={8}
                          max={90}
                          suffix="%"
                          onChange={(y) => setCaptionSettings((current) => ({ ...current, y }))}
                        />
                      </div>
                      <CaptionSlider
                        label="Size"
                        value={captionSettings.size}
                        min={12}
                        max={42}
                        suffix="px"
                        onChange={(size) => setCaptionSettings((current) => ({ ...current, size }))}
                      />
                      <CaptionSlider
                        label="Boldness"
                        value={captionSettings.weight}
                        min={400}
                        max={900}
                        step={100}
                        onChange={(weight) => setCaptionSettings((current) => ({ ...current, weight }))}
                      />
                      <CaptionSlider
                        label="Text opacity"
                        value={Math.round(captionSettings.opacity * 100)}
                        min={45}
                        max={100}
                        suffix="%"
                        onChange={(opacity) => setCaptionSettings((current) => ({ ...current, opacity: opacity / 100 }))}
                      />
                      <CaptionSlider
                        label="Box transparency"
                        value={Math.round((1 - captionSettings.boxOpacity) * 100)}
                        min={20}
                        max={100}
                        suffix="%"
                        onChange={(transparency) => setCaptionSettings((current) => ({ ...current, boxOpacity: (100 - transparency) / 100 }))}
                      />

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setCaptionSettings(DEFAULT_CAPTION_SETTINGS)}
                          className="h-9 rounded-xl border border-white/[0.1] bg-white/[0.05] text-xs font-black text-white/62 hover:bg-white/[0.08] hover:text-white"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptionSettings((current) => ({ ...current, y: window.innerHeight <= 540 ? 20 : 78 }))}
                          className="h-9 rounded-xl bg-[#cf2442] text-xs font-black text-white hover:bg-[#dc2d4b]"
                        >
                          Smart position
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.localStorage.setItem(CAPTION_SETTINGS_KEY, JSON.stringify(captionSettings));
                            setCaptionSettingsOpen(false);
                            setCaptionEditUnlocked(false);
                          }}
                          className="h-9 rounded-xl bg-white text-xs font-black text-black hover:bg-white/90"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* Speed selector */}
            <div className="relative">
              <button
                aria-label="Playback speed"
                aria-expanded={showSpeedMenu}
                onClick={() => { setShowSpeedMenu((v) => !v); setShowQualityMenu(false); setCaptionSettingsOpen(false); }}
                title="Playback speed (< / >)"
                className={`hidden h-8 items-center gap-1 rounded-xl px-2 text-xs font-bold transition-colors min-[390px]:flex ${
                  showSpeedMenu || playbackRate !== 1
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Gauge size={13} />
                {playbackRate === 1 ? "Speed" : `${playbackRate}x`}
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
                        {rate === 1 ? "Normal" : `${rate}x`}
                        {playbackRate === rate ? <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Quality selector */}
            <div className="relative">
              <button
                aria-label="Quality"
                aria-expanded={showQualityMenu}
                onClick={() => { setShowQualityMenu((v) => !v); setCaptionSettingsOpen(false); }}
                className={`hidden h-8 rounded-xl px-2 text-xs font-bold transition-colors min-[390px]:block ${
                  showQualityMenu || selectedQuality !== -1 || !hasSwitchableQuality
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {qualityLabel}
              </button>

              {showQualityMenu ? (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowQualityMenu(false)}
                  />
                  <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[150px] overflow-hidden rounded-xl border border-white/15 bg-black/95 py-1 shadow-2xl">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
                      Quality
                    </p>
                    {hasSwitchableQuality ? (
                      <>
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
                      </>
                    ) : (
                      <div className="px-3 py-2 text-xs">
                        <p className="font-bold text-white/82">{qualityLabel}</p>
                        <p className="mt-1 max-w-[190px] leading-snug text-white/42">{qualityNote}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {pipSupported ? (
              <button
                aria-label={pipActive ? "Exit picture in picture" : "Picture in picture"}
                onClick={togglePictureInPicture}
                className={`hidden h-8 w-8 place-items-center rounded-xl transition-colors sm:grid ${
                  pipActive ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <PictureInPicture2 size={18} />
              </button>
            ) : null}

            {/* Fullscreen */}
            <button
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={fullscreen}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptionSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mb-2 block rounded-xl bg-white/[0.035] p-2.5">
      <span className="mb-2 flex items-center justify-between text-[11px] font-bold text-white/55">
        <span>{label}</span>
        <span className="font-mono text-white/78">
          {value}{suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/18 accent-[#cf2442]"
      />
    </label>
  );
}

function preferredSubtitles(subtitles: Subtitle[] | undefined, subtitleUrl?: string, vttUrl?: string) {
  const collected: Subtitle[] = [...(subtitles ?? [])];
  if (subtitleUrl) {
    collected.push({
      file: subtitleUrl,
      label: "English",
      kind: "subtitles",
      default: !collected.length,
    });
  }
  if (vttUrl) {
    collected.push({
      file: vttUrl,
      label: "English",
      kind: "subtitles",
      default: !collected.length,
    });
  }

  const seen = new Set<string>();
  const valid = collected.filter((subtitle) => {
    if (!subtitle.file || seen.has(subtitle.file)) return false;
    seen.add(subtitle.file);
    return true;
  });
  const english = valid.filter((subtitle) => subtitleRank(subtitle) === 0);
  return (english.length ? english : valid).sort((a, b) => {
    if (a.default !== b.default) return a.default ? -1 : 1;
    return subtitleRank(a) - subtitleRank(b);
  });
}

function subtitleLabel(subtitle: Subtitle, index: number) {
  return subtitle.label || subtitle.kind || `Track ${index + 1}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function formatBufferAhead(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds)}s`;
}

function bufferedAheadOf(video: HTMLVideoElement) {
  const time = video.currentTime || 0;
  for (let i = 0; i < video.buffered.length; i += 1) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (time >= start && time <= end) return Math.max(0, end - time);
  }
  return 0;
}
