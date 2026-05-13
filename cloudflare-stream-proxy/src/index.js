const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STREAM_API_PREFIXES = ["/api/stream/", "/api/moon/", "/api/hd1/"];
const MOON_CACHE_TTL = 1800;
const MOON_SEGMENT_CACHE_TTL = 3600;
const moonInflight = new Map();
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const worker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return corsPreflight();

    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json({ ok: true, worker: "anime-tv-stream-proxy" });
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/warm")) return await warmMoon(request, env, ctx);
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/m3u8")) return await proxyMoonM3u8(request, env, ctx);
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/chunk")) return await proxyMoonChunk(request, env, ctx);
      if (url.pathname === "/proxy/m3u8") return await proxyM3u8(request, env);
      if (url.pathname === "/proxy/chunk") return await proxyChunk(request, env);
      if (url.pathname === "/proxy/vtt") return await proxyVtt(request, env);
      return await proxyOrigin(request, env);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Proxy error" }, 502);
    }
  },
};

export default worker;

async function proxyOrigin(request, env) {
  const incoming = new URL(request.url);
  const origin = new URL(env.ORIGIN_BASE);
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = copyRequestHeaders(request.headers);

  headers.set("host", origin.host);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: bodyFor(request),
    redirect: "follow",
  });

  if (STREAM_API_PREFIXES.some((prefix) => incoming.pathname.startsWith(prefix)) && isJson(response)) {
    const payload = await response.json();
    return json(rewriteStreamPayload(payload, incoming.origin), response.status, cacheHeaders("public, max-age=120"));
  }

  return withCors(response, STREAM_API_PREFIXES.some((prefix) => incoming.pathname.startsWith(prefix)));
}

async function proxyM3u8(request, env) {
  const src = sourceUrl(request);
  const upstream = await fetch(src, {
    headers: upstreamHeaders(src, env),
    redirect: "follow",
    cf: { cacheTtl: 12, cacheEverything: false },
  });

  if (!upstream.ok) return upstreamError(upstream);

  const rewritten = rewriteM3u8(await upstream.text(), src, new URL(request.url).origin);
  return new Response(rewritten, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

async function warmMoon(request, env, ctx) {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/")[3];
  if (!/^[A-Za-z0-9_-]+$/.test(videoId || "")) return json({ error: "Invalid Moon video id" }, 400);
  const segments = clampInt(url.searchParams.get("segments"), 1, 2, 2);
  const seededPlayback = moonSeedPlaybackFromUrl(url);
  ctx.waitUntil(warmMoonPipeline(videoId, env, segments, seededPlayback));
  return json({ ok: true, video_id: videoId, warming: true, segments }, 202, cacheHeaders("no-store"));
}

async function proxyMoonM3u8(request, env, ctx) {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/")[3];
  if (!/^[A-Za-z0-9_-]+$/.test(videoId || "")) return json({ error: "Invalid Moon video id" }, 400);
  const variant = url.searchParams.get("variant");
  const fastStart = url.searchParams.get("fast") === "1" || url.searchParams.get("direct") === "1";
  const seededPlayback = moonSeedPlaybackFromUrl(url);
  let playback = seededPlayback || await fetchMoonPlaybackCached(videoId);
  let master;
  try {
    master = await fetchMoonTextCached(playback.url, env, `moon-master:${videoId}`);
    if (seededPlayback) {
      ctx.waitUntil(cacheMoonPlayback(videoId, seededPlayback).catch((error) => logMoonError("moon_seed_cache_failed", videoId, error)));
    }
  } catch (error) {
    logMoonError(seededPlayback ? "moon_seed_rejected" : "moon_cached_playback_rejected", videoId, error);
    playback = await fetchMoonPlaybackCached(videoId, true);
    master = await fetchMoonTextCached(playback.url, env, `moon-master:${videoId}`, true);
  }

  if (variant) {
    const variantUrl = findPlaylistEntry(master.text, playback.url, variant);
    if (!variantUrl) return json({ error: "Moon variant missing", variant }, 404, cacheHeaders("no-store"));
    const child = await fetchMoonTextCached(variantUrl, env, `moon-variant:${videoId}:${variant}`);
    ctx.waitUntil(warmMoonSegments(videoId, variant, child.text, variantUrl, env, 2));
    const rewrittenChild = rewriteMoonVariant(child.text, variantUrl, new URL(request.url).origin, videoId, variant);
    return new Response(rewrittenChild, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }

  if (fastStart) {
    const variantUrl = firstMoonVariantUrl(master.text, playback.url);
    if (variantUrl) {
      const fastVariant = new URL(variantUrl).pathname.split("/").pop() || "index-v1-a1.m3u8";
      const child = await fetchMoonTextCached(variantUrl, env, `moon-variant:${videoId}:${fastVariant}`);
      ctx.waitUntil(warmMoonSegments(videoId, fastVariant, child.text, variantUrl, env, 2));
      const rewrittenChild = rewriteMoonVariant(child.text, variantUrl, url.origin, videoId, fastVariant);
      return new Response(rewrittenChild, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }
    const directVariant = "direct.m3u8";
    ctx.waitUntil(warmMoonSegments(videoId, directVariant, master.text, playback.url, env, 2));
    const rewrittenDirect = rewriteMoonVariant(master.text, playback.url, url.origin, videoId, directVariant);
    return new Response(rewrittenDirect, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }

  ctx.waitUntil(warmMoonPipeline(videoId, env, 2, playback, master.text));
  if (!firstMoonVariantUrl(master.text, playback.url)) {
    const directVariant = "direct.m3u8";
    const rewrittenDirect = rewriteMoonVariant(master.text, playback.url, url.origin, videoId, directVariant);
    return new Response(rewrittenDirect, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }
  const rewritten = rewriteMoonMaster(master.text, playback.url, url.origin, videoId);
  return new Response(rewritten, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

async function proxyMoonChunk(request, env, ctx) {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/")[3];
  const variant = url.searchParams.get("variant") || "";
  const segment = url.searchParams.get("segment") || "";
  if (!/^[A-Za-z0-9_-]+$/.test(videoId || "")) return json({ error: "Invalid Moon video id" }, 400);
  if (!variant || !segment) return json({ error: "Missing Moon segment info" }, 400);

  const cached = await matchMoonResourceCache(videoId, variant, segment, request.headers.get("range") || "");
  if (cached) return streamUpstream(cached, detectMime(segment));

  let segmentUrl = await resolveMoonSegmentUrl(videoId, variant, segment, env);
  let upstream = await fetchMoonSegment(segmentUrl, request, env, ctx, videoId, variant, segment);
  if (upstream.status === 403 || upstream.status === 404) {
    await clearMoonPlaylistCache(videoId, variant);
    segmentUrl = await resolveMoonSegmentUrl(videoId, variant, segment, env, true);
    upstream = await fetchMoonSegment(segmentUrl, request, env, ctx, videoId, variant, segment);
  }
  if (!upstream.ok && upstream.status !== 206) return upstreamError(upstream);
  return streamUpstream(upstream, detectMime(segmentUrl));
}

async function proxyChunk(request, env) {
  const src = sourceUrl(request);
  const headers = upstreamHeaders(src, env);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(src, {
    method: "GET",
    headers,
    redirect: "follow",
    cf: { cacheTtl: range ? 0 : 3600, cacheEverything: !range },
  });

  if (!upstream.ok && upstream.status !== 206) return upstreamError(upstream);
  return streamUpstream(upstream, detectMime(src));
}

async function proxyVtt(request, env) {
  const src = sourceUrl(request);
  const upstream = await fetch(src, {
    headers: upstreamHeaders(src, env),
    redirect: "follow",
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!upstream.ok) return upstreamError(upstream);
  return streamUpstream(upstream, "text/vtt; charset=utf-8");
}

function sourceUrl(request) {
  const raw = new URL(request.url).searchParams.get("src") || "";
  const decoded = decodeURIComponent(raw);
  const parsed = new URL(decoded);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Invalid src URL");
  return parsed.toString();
}

function rewriteM3u8(text, originalUrl, workerOrigin) {
  const base = new URL(originalUrl);
  let nextIsPlaylist = false;
  const out = [];

  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trimEnd();
    if (!line) {
      out.push(line);
      continue;
    }

    if (line.startsWith("#EXT-X-KEY") || line.startsWith("#EXT-X-MAP")) {
      out.push(rewriteAttributeUri(line, base, workerOrigin, "/proxy/chunk"));
      continue;
    }

    if (line.startsWith("#EXT-X-STREAM-INF") || line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
      if (line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
        line = rewriteAttributeUri(line, base, workerOrigin, "/proxy/m3u8");
      }
      out.push(line);
      nextIsPlaylist = true;
      continue;
    }

    if (line.startsWith("#")) {
      out.push(line);
      continue;
    }

    const absolute = new URL(line, base).toString();
    out.push(proxyUrl(workerOrigin, nextIsPlaylist ? "/proxy/m3u8" : "/proxy/chunk", absolute));
    nextIsPlaylist = false;
  }

  return `${out.join("\n")}\n`;
}

function rewriteAttributeUri(line, base, workerOrigin, route) {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${proxyUrl(workerOrigin, route, new URL(uri, base).toString())}"`);
}

function rewriteStreamPayload(value, workerOrigin) {
  if (Array.isArray(value)) return value.map((item) => rewriteStreamPayload(item, workerOrigin));
  if (!value || typeof value !== "object") return value;

  const copy = { ...value };
  for (const key of ["m3u8_url", "url", "stream_url"]) {
    if (typeof copy[key] === "string" && copy[key]) {
      copy[key] = streamProxyUrl(workerOrigin, copy[key]);
    }
  }
  if (Array.isArray(copy.subtitles)) {
    copy.subtitles = copy.subtitles.map((track) => {
      if (!track || typeof track !== "object" || typeof track.file !== "string") return track;
      const file = normalizeMaybeOriginUrl(track.file, workerOrigin);
      return { ...track, file: isAlreadyWorkerProxy(file, workerOrigin) ? file : proxyUrl(workerOrigin, "/proxy/vtt", file) };
    });
  }
  return copy;
}

async function fetchMoonPlayback(videoId) {
  const headers = {
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9,en-IN;q=0.8",
    "Content-Type": "application/json",
    "Origin": "https://398fitus.com",
    "Referer": `https://398fitus.com/ed4/${videoId}`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Storage-Access": "active",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0",
    "X-Embed-Origin": "9animetv.org.lv",
    "X-Embed-Parent": `https://bysesayeveum.com/e/${videoId}`,
    "X-Embed-Referer": "https://9animetv.org.lv/",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
  };
  const fingerprint = {
    token: crypto.randomUUID().replaceAll("-", ""),
    viewer_id: crypto.randomUUID().replaceAll("-", ""),
    device_id: crypto.randomUUID().replaceAll("-", ""),
    confidence: 1,
  };

  const response = await fetch(`https://398fitus.com/api/videos/${videoId}/embed/playback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fingerprint }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Moon playback ${response.status}: ${text.slice(0, 120)}`);

  const playback = (JSON.parse(text).playback || {});
  const keys = [
    concatBytes((playback.key_parts || []).map(base64UrlBytes)),
    ...Object.values(playback.decrypt_keys || {}).map(base64UrlBytes),
  ];

  for (const key of keys) {
    try {
      const raw = await decryptMoonPayload(playback.payload, key, base64UrlBytes(playback.iv));
      const url = findDeepUrl(JSON.parse(raw));
      if (url) return { url };
    } catch {
      // Try the next key; Moon sometimes returns alternates.
    }
  }
  throw new Error("Moon playback decrypt failed");
}

async function fetchMoonText(url, env) {
  const upstream = await fetch(url, {
    headers: upstreamHeaders(url, env),
    redirect: "follow",
    cf: { cacheTtl: MOON_CACHE_TTL, cacheEverything: true },
  });
  const text = await upstream.text();
  if (!upstream.ok) throw new Error(`Moon CDN ${upstream.status}: ${text.slice(0, 80)}`);
  return { text };
}

async function fetchMoonPlaybackCached(videoId, fresh = false) {
  return moonInflightDedupe(`playback:${videoId}:${fresh ? "fresh" : "cached"}`, async () => fetchMoonPlaybackCachedInner(videoId, fresh));
}

async function fetchMoonPlaybackCachedInner(videoId, fresh = false) {
  const cache = caches.default;
  const key = moonCacheRequest(`playback:${videoId}`);
  if (!fresh) {
    const cached = await cache.match(key);
    if (cached) return cached.json();
  }

  const playback = await fetchMoonPlayback(videoId);
  await cacheMoonPlayback(videoId, playback);
  return playback;
}

async function cacheMoonPlayback(videoId, playback) {
  await caches.default.put(moonCacheRequest(`playback:${videoId}`), new Response(JSON.stringify(playback), {
    headers: {
      "cache-control": `public, max-age=${MOON_CACHE_TTL}`,
      "content-type": "application/json; charset=utf-8",
    },
  }));
}

async function fetchMoonTextCached(url, env, cacheId, fresh = false) {
  return moonInflightDedupe(`text:${cacheId}:${fresh ? "fresh" : "cached"}`, async () => fetchMoonTextCachedInner(url, env, cacheId, fresh));
}

async function fetchMoonTextCachedInner(url, env, cacheId, fresh = false) {
  const cache = caches.default;
  const key = moonCacheRequest(cacheId);
  if (!fresh) {
    const cached = await cache.match(key);
    if (cached) return { text: await cached.text() };
  }

  const result = await fetchMoonText(url, env);
  await cache.put(key, new Response(result.text, {
    headers: {
      "cache-control": `public, max-age=${MOON_CACHE_TTL}`,
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
    },
  }));
  return result;
}

function moonInflightDedupe(key, factory) {
  const existing = moonInflight.get(key);
  if (existing) return existing;
  if (moonInflight.size > 100) moonInflight.clear();
  const promise = factory().finally(() => moonInflight.delete(key));
  moonInflight.set(key, promise);
  return promise;
}

async function resolveMoonSegmentUrl(videoId, variant, segment, env, fresh = false) {
  const playback = await fetchMoonPlaybackCached(videoId, fresh);
  const master = await fetchMoonTextCached(playback.url, env, `moon-master:${videoId}`, fresh);
  const variantUrl = findPlaylistEntry(master.text, playback.url, variant);
  if (!variantUrl) throw new Error(`Moon variant missing: ${variant}`);
  const child = await fetchMoonTextCached(variantUrl, env, `moon-variant:${videoId}:${variant}`, fresh);
  const segmentUrl = findPlaylistEntry(child.text, variantUrl, segment);
  if (!segmentUrl) throw new Error(`Moon segment missing: ${segment}`);
  return segmentUrl;
}

async function fetchMoonSegment(segmentUrl, request, env, ctx, videoId = "", variant = "", segment = "") {
  const headers = upstreamHeaders(segmentUrl, env);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const cache = caches.default;
  const stableKey = videoId && variant && segment ? moonResourceCacheRequest(videoId, variant, segment) : null;
  if (stableKey) {
    const cached = await matchMoonResourceCache(videoId, variant, segment, range || "");
    if (cached) return cached;
  }

  const upstream = await fetch(segmentUrl, {
    headers,
    redirect: "follow",
    cf: { cacheTtl: range ? 0 : MOON_SEGMENT_CACHE_TTL, cacheEverything: !range },
  });

  if (!range && stableKey && upstream.status === 200) {
    const cacheable = moonCacheableResponse(upstream, MOON_SEGMENT_CACHE_TTL);
    if (ctx) {
      ctx.waitUntil(cache.put(stableKey, cacheable.clone()).catch((error) => logMoonError("moon_segment_cache_put_failed", videoId, error)));
    } else {
      await cache.put(stableKey, cacheable.clone());
    }
    return cacheable;
  }

  return upstream;
}

async function clearMoonPlaylistCache(videoId, variant) {
  const cache = caches.default;
  await Promise.all([
    cache.delete(moonCacheRequest(`playback:${videoId}`)),
    cache.delete(moonCacheRequest(`moon-master:${videoId}`)),
    cache.delete(moonCacheRequest(`moon-variant:${videoId}:${variant}`)),
  ]);
}

function moonCacheRequest(key) {
  return new Request(`https://anime-tv-stream-proxy.local/${encodeURIComponent(key)}`);
}

function moonResourceCacheRequest(videoId, variant, segment, range = "") {
  const url = `https://anime-tv-stream-proxy.local/moon-resource/${encodeURIComponent(videoId)}/${encodeURIComponent(variant)}/${encodeURIComponent(segment)}`;
  const headers = new Headers();
  if (range) headers.set("range", range);
  return new Request(url, { headers });
}

async function matchMoonResourceCache(videoId, variant, segment, range = "") {
  return caches.default.match(moonResourceCacheRequest(videoId, variant, segment, range));
}

function moonSeedPlaybackFromUrl(url) {
  const raw = url.searchParams.get("src") || url.searchParams.get("source") || "";
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || !isAllowedMoonSourceHost(parsed.hostname)) {
      return null;
    }
    return { url: parsed.toString() };
  } catch {
    return null;
  }
}

function isAllowedMoonSourceHost(hostname) {
  const host = hostname.toLowerCase();
  return host.includes("r66nv9ed.com") || host.includes("sprintcdn") || host.includes("bysesayeveum.com") || host.includes("398fitus.com");
}

function moonCacheableResponse(response, ttl) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  if (headers.get("vary") === "*") headers.delete("vary");
  headers.set("cache-control", `public, max-age=${ttl}`);
  return new Response(response.body, { status: response.status, headers });
}

async function warmMoonPipeline(videoId, env, segmentCount = 2, playback, masterText) {
  try {
    const cachedPlayback = playback || await fetchMoonPlaybackCached(videoId);
    const master = masterText ? { text: masterText } : await fetchMoonTextCached(cachedPlayback.url, env, `moon-master:${videoId}`);
    const variantUrl = firstMoonVariantUrl(master.text, cachedPlayback.url);
    if (!variantUrl) return;
    const variant = new URL(variantUrl).pathname.split("/").pop() || "index-v1-a1.m3u8";
    const child = await fetchMoonTextCached(variantUrl, env, `moon-variant:${videoId}:${variant}`);
    await warmMoonSegments(videoId, variant, child.text, variantUrl, env, segmentCount);
  } catch (error) {
    logMoonError("moon_warm_failed", videoId, error);
  }
}

async function warmMoonSegments(videoId, variant, playlistText, playlistUrl, env, segmentCount = 2) {
  const entries = [
    ...moonKeyUrls(playlistText, playlistUrl),
    ...moonSegmentUrls(playlistText, playlistUrl).slice(0, segmentCount),
  ];
  await Promise.allSettled(entries.map((entry) => warmMoonResource(videoId, variant, entry.segment, entry.url, env)));
}

async function warmMoonResource(videoId, variant, segment, url, env) {
  return moonInflightDedupe(`resource:${videoId}:${variant}:${segment}`, async () => warmMoonResourceInner(videoId, variant, segment, url, env));
}

async function warmMoonResourceInner(videoId, variant, segment, url, env) {
  const cache = caches.default;
  const key = moonResourceCacheRequest(videoId, variant, segment);
  if (await cache.match(key)) return;

  const upstream = await fetch(url, {
    headers: upstreamHeaders(url, env),
    redirect: "follow",
    cf: { cacheTtl: MOON_SEGMENT_CACHE_TTL, cacheEverything: true },
  });
  if (upstream.status !== 200) return;

  await cache.put(key, moonCacheableResponse(upstream, MOON_SEGMENT_CACHE_TTL));
}

function firstMoonVariantUrl(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) continue;
    const next = lines.slice(index + 1).find((line) => line && !line.startsWith("#"));
    return next ? new URL(next, baseUrl).toString() : "";
  }
  return "";
}

function moonSegmentUrls(text, baseUrl) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !/\.m3u8(?:$|[?#])/i.test(line))
    .map((line) => {
      const url = new URL(line, baseUrl).toString();
      return { url, segment: new URL(url).pathname.split("/").pop() || line };
    });
}

function moonKeyUrls(text, baseUrl) {
  const urls = [];
  const keyPattern = /#EXT-X-(?:KEY|MAP):[^\n\r]*URI="([^"]+)"/gi;
  let match;
  while ((match = keyPattern.exec(text))) {
    const url = new URL(match[1], baseUrl).toString();
    urls.push({ url, segment: new URL(url).pathname.split("/").pop() || match[1] });
  }
  return urls;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function logMoonError(event, videoId, error) {
  console.log(JSON.stringify({
    event,
    videoId,
    error: error instanceof Error ? error.message : String(error),
  }));
}

function rewriteMoonMaster(text, originalUrl, workerOrigin, videoId) {
  const base = new URL(originalUrl);
  let nextIsPlaylist = false;
  const out = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) {
      out.push(line);
      if (line.startsWith("#EXT-X-STREAM-INF")) nextIsPlaylist = true;
      if (line.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
        out[out.length - 1] = rewriteAttributeUri(line, base, workerOrigin, "/proxy/m3u8");
      }
      continue;
    }
    if (nextIsPlaylist) {
      const absolute = new URL(line, base).toString();
      const variant = new URL(absolute).pathname.split("/").pop() || line;
      out.push(`${workerOrigin}/proxy/moon/${encodeURIComponent(videoId)}/m3u8?variant=${encodeURIComponent(variant)}`);
      nextIsPlaylist = false;
      continue;
    }
    out.push(line);
  }
  return `${out.join("\n")}\n`;
}

function rewriteMoonVariant(text, originalUrl, workerOrigin, videoId, variant) {
  const base = new URL(originalUrl);
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("#EXT-X-KEY") || line.startsWith("#EXT-X-MAP")) {
      out.push(rewriteMoonAttributeUri(line, base, workerOrigin, videoId, variant));
      continue;
    }
    if (!line || line.startsWith("#")) {
      out.push(line);
      continue;
    }
    const absolute = new URL(line, base).toString();
    const segment = new URL(absolute).pathname.split("/").pop() || line;
    out.push(`${workerOrigin}/proxy/moon/${encodeURIComponent(videoId)}/chunk?variant=${encodeURIComponent(variant)}&segment=${encodeURIComponent(segment)}`);
  }
  return `${out.join("\n")}\n`;
}

function rewriteMoonAttributeUri(line, base, workerOrigin, videoId, variant) {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
    const absolute = new URL(uri, base).toString();
    const segment = new URL(absolute).pathname.split("/").pop() || uri;
    return `URI="${workerOrigin}/proxy/moon/${encodeURIComponent(videoId)}/chunk?variant=${encodeURIComponent(variant)}&segment=${encodeURIComponent(segment)}"`;
  });
}

function findPlaylistEntry(text, baseUrl, name) {
  const target = decodeURIComponent(name).split("?")[0];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const absolute = new URL(line, baseUrl).toString();
    const filename = new URL(absolute).pathname.split("/").pop() || "";
    if (filename === target || filename.startsWith(target.split("?")[0])) return absolute;
  }
  const attrMatch = text.match(new RegExp(`URI="([^"]*${escapeRegExp(target)}[^"]*)"`, "i"));
  return attrMatch ? new URL(attrMatch[1], baseUrl).toString() : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function decryptMoonPayload(payload, keyBytes, ivBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, key, base64UrlBytes(payload));
  return new TextDecoder().decode(clear);
}

function base64UrlBytes(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function concatBytes(parts) {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function findDeepUrl(value) {
  if (typeof value === "string") {
    return value.startsWith("http") && (value.includes(".m3u8") || value.includes("stream") || value.includes("video")) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepUrl(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const key of ["url", "stream", "src", "file", "hls", "source"]) {
      if (typeof value[key] === "string" && value[key].startsWith("http")) return value[key];
    }
    for (const nested of Object.values(value)) {
      const found = findDeepUrl(nested);
      if (found) return found;
    }
  }
  return null;
}

function streamProxyUrl(workerOrigin, value) {
  const absolute = normalizeMaybeOriginUrl(value, workerOrigin);
  if (isAlreadyWorkerProxy(absolute, workerOrigin)) return absolute;
  const parsed = new URL(absolute);
  if (parsed.pathname.endsWith(".m3u8") || parsed.search.includes(".m3u8")) return proxyUrl(workerOrigin, "/proxy/m3u8", absolute);
  return proxyUrl(workerOrigin, "/proxy/chunk", absolute);
}

function normalizeMaybeOriginUrl(value, workerOrigin) {
  if (value.startsWith("/")) return `${workerOrigin}${value}`;
  return value;
}

function isAlreadyWorkerProxy(value, workerOrigin) {
  const parsed = new URL(value);
  const worker = new URL(workerOrigin);
  return parsed.host === worker.host && parsed.pathname.startsWith("/proxy/");
}

function proxyUrl(origin, route, src) {
  return `${origin}${route}?src=${encodeURIComponent(src)}`;
}

function upstreamHeaders(src, env) {
  const host = new URL(src).hostname.toLowerCase();
  const policy = proxyPolicy(host, env);
  const headers = new Headers();
  headers.set("user-agent", policy.ua);
  headers.set("accept", "*/*");
  headers.set("accept-language", "en-US,en;q=0.9");
  headers.set("origin", policy.origin);
  headers.set("referer", policy.referer);
  return headers;
}

function proxyPolicy(host, env) {
  if (host.includes("watching.onl") || host.includes("cinewave")) {
    return { referer: `${env.MEGAPLAY_BASE}/`, origin: env.MEGAPLAY_BASE, ua: ANDROID_UA };
  }
  if (host.includes("vidwish.live")) {
    return { referer: `${env.VIDWISH_BASE}/`, origin: env.VIDWISH_BASE, ua: ANDROID_UA };
  }
  if (host.includes("r66nv9ed.com") || host.includes("sprintcdn") || host.includes("bysesayeveum.com") || host.includes("398fitus.com")) {
    return { referer: "https://bysesayeveum.com/", origin: "https://bysesayeveum.com", ua: DESKTOP_UA };
  }
  if (host.includes("workers.dev") || host.includes("owocdn.top") || host.includes("gogoanime.me.uk")) {
    return { referer: "https://9animetv.org.lv/", origin: "https://9animetv.org.lv", ua: DESKTOP_UA };
  }
  return { referer: `${env.MEGAPLAY_BASE}/`, origin: env.MEGAPLAY_BASE, ua: ANDROID_UA };
}

function streamUpstream(upstream, forcedContentType) {
  const headers = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", "Content-Length, Content-Range, Accept-Ranges");
  headers.set("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");
  headers.set("cache-control", upstream.headers.get("cache-control") || "public, max-age=3600");
  if (forcedContentType) headers.set("content-type", forcedContentType);
  return new Response(upstream.body, { status: upstream.status, headers });
}

function upstreamError(upstream) {
  return json({ error: `CDN ${upstream.status}` }, upstream.status || 502, cacheHeaders("no-store"));
}

function isJson(response) {
  return (response.headers.get("content-type") || "").includes("application/json");
}

function bodyFor(request) {
  return request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
}

function copyRequestHeaders(headers) {
  const next = new Headers();
  for (const [key, value] of headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "host") next.set(key, value);
  }
  return next;
}

function detectMime(src) {
  let path = src.toLowerCase();
  try {
    path = new URL(src).pathname.toLowerCase();
  } catch {
    // Plain Moon segment names are enough to infer the type.
  }
  if (path.endsWith(".ts")) return "video/mp2t";
  if (path.endsWith(".m4s")) return "video/iso.segment";
  if (path.endsWith(".mp4")) return "video/mp4";
  return undefined;
}

function withCors(response, cacheStreamApi = false) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "Authorization,Content-Type,Range");
  if (cacheStreamApi) headers.set("cache-control", headers.get("cache-control") || "public, max-age=120");
  return new Response(response.body, { status: response.status, headers });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type,Range",
    "access-control-expose-headers": "Content-Length,Content-Range,Accept-Ranges",
  };
}

function cacheHeaders(cacheControl) {
  return { ...corsHeaders(), "cache-control": cacheControl };
}

function corsPreflight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function json(payload, status = 200, headers = corsHeaders()) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "content-type": "application/json; charset=utf-8" },
  });
}
