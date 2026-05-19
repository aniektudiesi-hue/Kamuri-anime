import type {
  LevelDetails,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderStats,
} from "hls.js";

type HlsFragmentLike = {
  url?: string;
  start?: number;
  duration?: number;
  initSegment?: { url?: string } | null;
};

type CacheJob = {
  url: string;
  priority: number;
};

type SegmentCacheIndex = {
  namespaces: Array<{
    namespace: string;
    urls: string[];
    bytes: number;
    touchedAt: number;
  }>;
};

type SegmentCacheSessionOptions = {
  enabled: boolean;
  namespace: string;
  concurrency?: number;
  immediateAheadSeconds?: number;
  maxNamespaces?: number;
  maxUrlsPerNamespace?: number;
};

const CACHE_NAME = "anime-tv-hls-segments-v1";
const CACHE_INDEX_KEY = "anime-tv-hls-cache-index-v1";
const DEBUG_KEY = "anime-tv-hls-cache-debug";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_IMMEDIATE_AHEAD_SECONDS = 300;
const DEFAULT_MAX_NAMESPACES = 4;
const DEFAULT_MAX_URLS_PER_NAMESPACE = 2400;
const CACHEABLE_RESPONSE_TYPES = new Set(["arraybuffer", ""]);

export function isHlsSegmentCacheDebugEnabled() {
  try {
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function createHlsSegmentCacheSession(options: SegmentCacheSessionOptions) {
  return new HlsSegmentCacheSession(options);
}

export function createHlsSegmentCacheLoader(session: HlsSegmentCacheSession) {
  return class AnimeTvHlsCacheLoader implements Loader<LoaderContext> {
    context: LoaderContext | null = null;
    stats: LoaderStats = createLoaderStats();
    private controller: AbortController | null = null;

    constructor() {}

    destroy() {
      this.abort();
      this.context = null;
    }

    abort() {
      this.stats.aborted = true;
      this.controller?.abort();
      this.controller = null;
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      this.context = context;
      this.stats = createLoaderStats();
      this.controller = new AbortController();
      void this.loadInternal(context, config, callbacks, this.controller).catch((error) => {
        if (this.stats.aborted) {
          callbacks.onAbort?.(this.stats, context, error);
          return;
        }
        callbacks.onError(
          { code: 0, text: error instanceof Error ? error.message : "HLS load failed" },
          context,
          error,
          this.stats,
        );
      });
    }

    getCacheAge() {
      return null;
    }

    getResponseHeader() {
      return null;
    }

    private async loadInternal(
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
      controller: AbortController,
    ) {
      const timeoutMs = loaderTimeoutMs(config);
      let didTimeout = false;
      const timeout = window.setTimeout(() => {
        didTimeout = true;
        this.stats.aborted = true;
        controller.abort();
        callbacks.onTimeout(this.stats, context, new DOMException("HLS load timed out", "TimeoutError"));
      }, timeoutMs);

      try {
        this.stats.loading.start = performance.now();
        const cached = await session.match(context);
        if (cached) {
          const data = await responseData(cached, context);
          markLoaded(this.stats, data);
          session.noteCacheHit(context.url);
          callbacks.onSuccess({ url: context.url, data, code: cached.status || 200, text: cached.statusText }, this.stats, context, cached);
          return;
        }

        const headers = new Headers(context.headers);
        if (Number.isFinite(context.rangeStart) && Number.isFinite(context.rangeEnd)) {
          headers.set("Range", `bytes=${context.rangeStart}-${Number(context.rangeEnd) - 1}`);
        }

        const response = await fetch(context.url, {
          cache: session.shouldCache(context) ? "force-cache" : "default",
          headers,
          signal: controller.signal,
        });
        this.stats.loading.first = performance.now();
        this.stats.loading.end = this.stats.loading.first;

        if (!response.ok && response.status !== 206) {
          callbacks.onError(
            { code: response.status, text: response.statusText || `HTTP ${response.status}` },
            context,
            response,
            this.stats,
          );
          return;
        }

        const cacheable = response.clone();
        const data = await responseData(response, context);
        markLoaded(this.stats, data, response.headers);
        session.noteCacheMiss(context.url);
        if (response.status === 200) {
          session.put(context, cacheable, byteLengthOf(data, response.headers));
        }
        callbacks.onSuccess(
          { url: response.url || context.url, data, code: response.status, text: response.statusText },
          this.stats,
          context,
          response,
        );
      } finally {
        window.clearTimeout(timeout);
        if (didTimeout) return;
      }
    }
  };
}

export class HlsSegmentCacheSession {
  private readonly enabled: boolean;
  private readonly namespace: string;
  private readonly concurrency: number;
  private readonly immediateAheadSeconds: number;
  private readonly maxNamespaces: number;
  private readonly maxUrlsPerNamespace: number;
  private readonly knownUrls = new Set<string>();
  private readonly cachedUrls = new Set<string>();
  private readonly queuedUrls = new Set<string>();
  private readonly inflight = new Set<string>();
  private readonly queue: CacheJob[] = [];
  private readonly indexedUrls = new Set<string>();
  private stopped = false;
  private currentTime = 0;
  private indexFlushTimer: number | undefined;
  private bytes = 0;
  private hits = 0;
  private misses = 0;

  constructor(options: SegmentCacheSessionOptions) {
    this.enabled = options.enabled && supportsSegmentCache();
    this.namespace = stableNamespace(options.namespace);
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, 10));
    this.immediateAheadSeconds = Math.max(30, options.immediateAheadSeconds ?? DEFAULT_IMMEDIATE_AHEAD_SECONDS);
    this.maxNamespaces = Math.max(1, options.maxNamespaces ?? DEFAULT_MAX_NAMESPACES);
    this.maxUrlsPerNamespace = Math.max(200, options.maxUrlsPerNamespace ?? DEFAULT_MAX_URLS_PER_NAMESPACE);
    if (this.enabled) {
      void this.pruneOldNamespaces();
    }
  }

  get active() {
    return this.enabled && !this.stopped;
  }

  updateLevel(details: LevelDetails | undefined, time: number) {
    if (!this.active || !details?.fragments?.length) return;
    this.currentTime = Number.isFinite(time) ? Math.max(0, time) : this.currentTime;
    const jobs = fragmentsToJobs(details.fragments as HlsFragmentLike[], this.currentTime, this.immediateAheadSeconds);
    for (const job of jobs) {
      this.knownUrls.add(job.url);
      this.enqueue(job);
    }
    this.pump();
  }

  setCurrentTime(time: number) {
    if (!this.active || !Number.isFinite(time)) return;
    this.currentTime = Math.max(0, time);
    if (this.queue.length > 1) {
      this.queue.sort((a, b) => a.priority - b.priority);
    }
    this.pump();
  }

  noteFragment(fragment: HlsFragmentLike | undefined) {
    if (!this.active || !fragment?.url) return;
    this.knownUrls.add(fragment.url);
    this.enqueue({ url: fragment.url, priority: 0 });
    if (fragment.initSegment?.url) {
      this.knownUrls.add(fragment.initSegment.url);
      this.enqueue({ url: fragment.initSegment.url, priority: 0 });
    }
    this.pump();
  }

  shouldCache(context: LoaderContext) {
    if (!this.active) return false;
    if (context.rangeStart !== undefined || context.rangeEnd !== undefined) return false;
    return this.knownUrls.has(context.url) || isLikelySegmentRequest(context);
  }

  async match(context: LoaderContext) {
    if (!this.shouldCache(context)) return undefined;
    try {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(cacheRequest(this.namespace, context.url))) ?? undefined;
    } catch {
      return undefined;
    }
  }

  put(context: LoaderContext, response: Response, size = 0) {
    if (!this.shouldCache(context)) return;
    this.putUrl(context.url, response, size);
  }

  noteCacheHit(url: string) {
    this.hits += 1;
    this.log("hit", { url, hits: this.hits, misses: this.misses });
  }

  noteCacheMiss(url: string) {
    this.misses += 1;
    this.log("miss", { url, hits: this.hits, misses: this.misses });
  }

  stop() {
    this.stopped = true;
    if (this.indexFlushTimer) window.clearTimeout(this.indexFlushTimer);
    this.flushIndex();
  }

  private enqueue(job: CacheJob) {
    if (!this.active || this.cachedUrls.has(job.url) || this.inflight.has(job.url) || this.queuedUrls.has(job.url)) return;
    this.queue.push(job);
    this.queuedUrls.add(job.url);
  }

  private pump() {
    if (!this.active) return;
    this.queue.sort((a, b) => a.priority - b.priority);
    while (this.inflight.size < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;
      this.queuedUrls.delete(job.url);
      if (this.cachedUrls.has(job.url) || this.inflight.has(job.url)) continue;
      this.inflight.add(job.url);
      void this.prefetch(job.url).finally(() => {
        this.inflight.delete(job.url);
        this.pump();
      });
    }
  }

  private async prefetch(url: string) {
    if (!this.active) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      const request = cacheRequest(this.namespace, url);
      if (await cache.match(request)) {
        this.cachedUrls.add(url);
        this.trackUrl(url, 0);
        return;
      }
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok || response.status !== 200) return;
      const size = numberHeader(response.headers, "content-length");
      await cache.put(request, response);
      this.cachedUrls.add(url);
      this.trackUrl(url, size);
      this.log("prefetched", { url, queued: this.queue.length, inflight: this.inflight.size });
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        await this.evictOldestNamespace();
      }
      this.log("prefetch failed", { url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private putUrl(url: string, response: Response, size: number) {
    void caches.open(CACHE_NAME)
      .then((cache) => cache.put(cacheRequest(this.namespace, url), response))
      .then(() => {
        this.cachedUrls.add(url);
        this.trackUrl(url, size);
      })
      .catch((error) => {
        this.log("put failed", { url, error: error instanceof Error ? error.message : String(error) });
      });
  }

  private trackUrl(url: string, size: number) {
    this.indexedUrls.add(url);
    this.bytes += Math.max(0, size);
    if (this.indexedUrls.size > this.maxUrlsPerNamespace) {
      const first = this.indexedUrls.values().next().value as string | undefined;
      if (first) this.indexedUrls.delete(first);
    }
    this.scheduleIndexFlush();
  }

  private scheduleIndexFlush() {
    if (this.indexFlushTimer) return;
    this.indexFlushTimer = window.setTimeout(() => {
      this.indexFlushTimer = undefined;
      this.flushIndex();
    }, 2000);
  }

  private flushIndex() {
    if (!this.enabled || !this.indexedUrls.size) return;
    const index = readCacheIndex();
    const nextNamespaces = index.namespaces.filter((item) => item.namespace !== this.namespace);
    nextNamespaces.unshift({
      namespace: this.namespace,
      urls: [...this.indexedUrls],
      bytes: this.bytes,
      touchedAt: Date.now(),
    });
    writeCacheIndex({ namespaces: nextNamespaces.slice(0, this.maxNamespaces + 1) });
  }

  private async pruneOldNamespaces() {
    const index = readCacheIndex();
    if (index.namespaces.length <= this.maxNamespaces) return;
    const stale = index.namespaces
      .filter((item) => item.namespace !== this.namespace)
      .sort((a, b) => b.touchedAt - a.touchedAt)
      .slice(this.maxNamespaces - 1);
    if (!stale.length) return;
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(stale.flatMap((item) => item.urls.map((url) => cache.delete(cacheRequest(item.namespace, url)))));
    writeCacheIndex({
      namespaces: index.namespaces.filter((item) => !stale.some((old) => old.namespace === item.namespace)),
    });
  }

  private async evictOldestNamespace() {
    const index = readCacheIndex();
    const oldest = index.namespaces
      .filter((item) => item.namespace !== this.namespace)
      .sort((a, b) => a.touchedAt - b.touchedAt)[0];
    if (!oldest) return;
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(oldest.urls.map((url) => cache.delete(cacheRequest(oldest.namespace, url))));
    writeCacheIndex({ namespaces: index.namespaces.filter((item) => item.namespace !== oldest.namespace) });
  }

  private log(message: string, details?: Record<string, unknown>) {
    if (!isHlsSegmentCacheDebugEnabled()) return;
    console.debug(`[hls-cache] ${message}`, details ?? "");
  }
}

function fragmentsToJobs(fragments: HlsFragmentLike[], currentTime: number, immediateAhead: number) {
  return fragments.flatMap((fragment, index) => {
    const start = Number(fragment.start ?? index * Number(fragment.duration ?? 0));
    const duration = Number(fragment.duration ?? 0);
    const urls = [fragment.initSegment?.url, fragment.url].filter(Boolean) as string[];
    const priority =
      start + duration < currentTime
        ? 50000 + index
        : start < currentTime + immediateAhead
          ? Math.max(0, start - currentTime)
          : 10000 + Math.max(0, start - currentTime);
    return urls.map((url) => ({ url, priority }));
  });
}

function supportsSegmentCache() {
  return typeof window !== "undefined" && "caches" in window && "fetch" in window;
}

function isLikelySegmentRequest(context: LoaderContext) {
  if (!CACHEABLE_RESPONSE_TYPES.has(context.responseType)) return false;
  return /(?:\/proxy\/(?:chunk|moon\/[^/]+\/chunk)\b|\.m4s(?:$|[?#])|\.ts(?:$|[?#])|\.mp4(?:$|[?#]))/i.test(context.url);
}

function cacheRequest(namespace: string, url: string) {
  return new Request(`https://anime-tvplus.local/hls-cache/${namespace}/${hashString(url)}`);
}

function stableNamespace(value: string) {
  return hashString(value || "stream");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readCacheIndex(): SegmentCacheIndex {
  try {
    const raw = window.localStorage.getItem(CACHE_INDEX_KEY);
    if (!raw) return { namespaces: [] };
    const parsed = JSON.parse(raw) as SegmentCacheIndex;
    return { namespaces: Array.isArray(parsed.namespaces) ? parsed.namespaces : [] };
  } catch {
    return { namespaces: [] };
  }
}

function writeCacheIndex(index: SegmentCacheIndex) {
  try {
    window.localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {
    // Best-effort index only; cached responses remain valid without it.
  }
}

function createLoaderStats(): LoaderStats {
  const now = performance.now();
  return {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: now, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };
}

function loaderTimeoutMs(config: LoaderConfiguration) {
  return config.loadPolicy?.maxLoadTimeMs || config.timeout || 12000;
}

async function responseData(response: Response, context: LoaderContext) {
  if (context.responseType === "arraybuffer") return response.arrayBuffer();
  return response.text();
}

function markLoaded(stats: LoaderStats, data: string | ArrayBuffer, headers?: Headers) {
  const now = performance.now();
  stats.loading.first ||= now;
  stats.loading.end = now;
  stats.parsing.start = now;
  stats.parsing.end = now;
  stats.buffering.start = now;
  stats.buffering.first = now;
  stats.buffering.end = now;
  stats.loaded = byteLengthOf(data, headers);
  stats.total = stats.loaded;
  stats.chunkCount = 1;
}

function byteLengthOf(data: string | ArrayBuffer, headers?: Headers) {
  const headerLength = headers ? numberHeader(headers, "content-length") : 0;
  if (headerLength) return headerLength;
  if (typeof data === "string") return new Blob([data]).size;
  return data.byteLength;
}

function numberHeader(headers: Headers, key: string) {
  const value = Number(headers.get(key));
  return Number.isFinite(value) ? value : 0;
}
