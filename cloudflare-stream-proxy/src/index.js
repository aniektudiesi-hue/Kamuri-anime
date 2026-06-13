const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STREAM_API_PREFIXES = ["/api/stream/", "/api/moon/", "/api/hd1/"];
const CATALOG_API_PREFIXES = [
  "/api/catalog",
  "/api/search",
  "/api/streams/",
  "/api/stream/",
  "/api/episodes/",
  "/api/cr/",
  "/api/image-transform",
  "/api/anime/",
  "/api/image-db/",
  "/api/images/",
];
const CATALOG_API_PATHS = ["/", "/api/status"];
const PUBLIC_API_PREFIXES = [
  ...STREAM_API_PREFIXES,
  ...CATALOG_API_PREFIXES,
  "/home/",
  "/anime/episode/",
  "/search/",
  "/suggest/",
];
const PUBLIC_API_PATHS = ["/api/v1/banners", ...CATALOG_API_PATHS];
const REGIONAL_CATALOG_ORIGINS = {
  india: "https://animetvplus-stream-backup-india.onrender.com",
  usWest: "https://animetvplus-catalog-api-us-west.onrender.com",
  usEast: "https://animetvplus-catalog-api-usa-east.onrender.com",
  europe: "https://animetvplus-catalog-api-europe.onrender.com",
};
const CATALOG_FAILOVER_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const CATALOG_CR_ENRICH_PREFIXES = ["/api/search", "/api/anime/", "/api/catalog"];
const CATALOG_CACHE_VERSION = "catalog-v4";
const MOON_CACHE_TTL = 3600;
const MANIFEST_CACHE_TTL = 600;
const MANIFEST_STALE_TTL = 1800;
const SEGMENT_CACHE_TTL = 86400;
const MOON_SEGMENT_CACHE_TTL = SEGMENT_CACHE_TTL;
const STREAM_API_MEMORY_TTL = 30 * 60 * 1000;
const IMAGE_CACHE_TTL = 60 * 60 * 24 * 30;
const STREAM_CACHE_VERSION = "v5";
const GENERIC_WARM_DEFAULT_SEGMENTS = 18;
const GENERIC_WARM_MAX_SEGMENTS = 36;
const GENERIC_WARM_STARTUP_SEGMENTS = 6;
const MOON_WARM_DEFAULT_SEGMENTS = 18;
const MOON_WARM_MAX_SEGMENTS = 36;
const MOON_WARM_STARTUP_SEGMENTS = 6;
const WARM_CONCURRENCY = 4;
const moonInflight = new Map();
const moonPlaybackMemoryCache = new Map();
const genericInflight = new Map();
const streamApiMemoryCache = new Map();
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

// Hotlink / scraping protection: stream proxy routes only serve requests that
// present a Referer or Origin from our own site (or have no Referer at all,
// e.g. native players). Cross-site embedding / bulk scrapers that spoof a
// browser fetch but send a foreign Referer/Origin get a 403.
const ALLOWED_HOSTS = new Set(["animetvplus.xyz", "www.animetvplus.xyz", "localhost", "127.0.0.1"]);
const PROTECTED_PREFIXES = ["/proxy/"];

function isAllowedHost(hostname, env) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".vercel.app")) return true;
  if (env.ALLOWED_ORIGIN_HOST && hostname === env.ALLOWED_ORIGIN_HOST) return true;
  return false;
}

function isAllowedClient(request, env) {
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  for (const value of [referer, origin]) {
    if (!value) continue;
    try {
      if (!isAllowedHost(new URL(value).hostname, env)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const worker = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return corsPreflight();

    const url = new URL(request.url);
    try {
      if (PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p)) && !isAllowedClient(request, env)) {
        return json({ error: "Forbidden" }, 403, { "cache-control": "no-store" });
      }
      if (url.pathname === "/health") return json({ ok: true, worker: "anime-tv-stream-proxy" });
      if (url.pathname === "/api/edge-session") return edgeSession(request, env);
      if (url.pathname === "/image") return await proxyImage(request, ctx);
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/warm")) return await warmMoon(request, env, ctx);
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/m3u8")) return await proxyMoonM3u8(request, env, ctx);
      if (url.pathname.startsWith("/proxy/moon/") && url.pathname.endsWith("/chunk")) return await proxyMoonChunk(request, env, ctx);
      if (url.pathname === "/proxy/m3u8") return await proxyM3u8(request, env, ctx);
      if (url.pathname === "/proxy/chunk") return await proxyChunk(request, env, ctx);
      if (url.pathname === "/proxy/vtt") return await proxyVtt(request, env, ctx);
      return await proxyOrigin(request, env, ctx);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Proxy error" }, 502);
    }
  },
};

export default worker;

async function proxyOrigin(request, env, ctx) {
  const incoming = new URL(request.url);
  const catalogApi = isCatalogApiPath(incoming.pathname);
  const streamApi = STREAM_API_PREFIXES.some((prefix) => incoming.pathname.startsWith(prefix)) && !catalogApi;
  const canCache =
    request.method === "GET" &&
    (PUBLIC_API_PREFIXES.some((prefix) => incoming.pathname.startsWith(prefix)) || PUBLIC_API_PATHS.includes(incoming.pathname));
  const apiCacheControl = originApiCacheControl(incoming.pathname);
  const cache = caches.default;
  const primaryOrigin = catalogApi ? selectCatalogOrigin(request, env) : env.ORIGIN_BASE;
  const primaryTarget = new URL(incoming.pathname + incoming.search, primaryOrigin);
  const cacheKeyUrl = catalogCacheKeyUrl(incoming);
  const cacheKey = new Request(catalogApi ? cacheKeyUrl : primaryTarget.toString(), { headers: cacheVaryHeaders(request) });
  if (canCache) {
    const hot = streamApi ? streamApiMemoryGet(primaryTarget.toString()) : null;
    if (hot) {
      const payload = rewriteStreamPayload(hot, incoming.origin);
      return json(payload, 200, cacheHeaders(apiCacheControl));
    }

    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, streamApi);
    if (catalogApi && incoming.searchParams.get("__cf_cache_only") === "1") {
      return new Response(null, { status: 204, headers: cacheHeaders("no-store") });
    }
  }

  const upstream = await fetchOriginWithFailover(request, incoming, env, catalogApi, canCache);
  const response = upstream.response;

  if (canCache && isJson(response)) {
    const payload = await response.json();
    const enriched = catalogApi ? await enrichCatalogPayload(payload, incoming, upstream.origin, env) : payload;
    const body = streamApi ? rewriteStreamPayload(enriched, incoming.origin) : enriched;
    const rewritten = json(
      body,
      response.status,
      originHeaders(apiCacheControl, upstream.origin, upstream.attempts),
    );
    if (canCache && response.ok) {
      if (streamApi) streamApiMemorySet(primaryTarget.toString(), payload);
      ctx.waitUntil(cache.put(cacheKey, rewritten.clone()));
    }
    return rewritten;
  }

  return withCatalogDebugHeaders(withCors(response, streamApi), upstream.origin, upstream.attempts);
}

function catalogCacheKeyUrl(incoming) {
  const key = new URL(`${incoming.origin}/${CATALOG_CACHE_VERSION}${incoming.pathname}`);
  for (const [name, value] of incoming.searchParams.entries()) {
    if (name === "__cf_cache_only" || name === "__cf_warm") continue;
    key.searchParams.append(name, value);
  }
  return key.toString();
}

function isCatalogApiPath(pathname) {
  return CATALOG_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || CATALOG_API_PATHS.includes(pathname);
}

async function fetchOriginWithFailover(request, incoming, env, catalogApi, canCache) {
  const origins = catalogApi ? catalogOriginPool(request, env) : [env.ORIGIN_BASE];
  const attempts = [];
  let lastResponse = null;
  let lastOrigin = origins[0] || env.ORIGIN_BASE;

  for (const originValue of origins) {
    const origin = new URL(originValue);
    const target = new URL(incoming.pathname + incoming.search, origin);
    const headers = copyRequestHeaders(request.headers);
    headers.set("host", origin.host);
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
    headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");
    lastOrigin = origin.toString().replace(/\/$/, "");
    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: bodyFor(request),
        redirect: "follow",
        cf: canCache ? { cacheEverything: true, cacheTtl: originApiTtl(incoming.pathname) } : undefined,
      });
      attempts.push(`${origin.host}:${response.status}`);
      lastResponse = response;
      if (catalogApi && request.method === "GET" && response.ok && await isStaleCatalogJson(response, incoming.pathname)) {
        attempts[attempts.length - 1] = `${origin.host}:${response.status}:STALE`;
        continue;
      }
      if (!catalogApi || !CATALOG_FAILOVER_STATUSES.has(response.status) || request.method !== "GET") {
        return { response, origin: lastOrigin, attempts };
      }
    } catch (error) {
      attempts.push(`${origin.host}:ERR`);
      if (!catalogApi || request.method !== "GET") throw error;
    }
  }

  if (lastResponse) return { response: lastResponse, origin: lastOrigin, attempts };
  return { response: json({ error: "All catalog origins failed", attempts }, 502, cacheHeaders("no-store")), origin: lastOrigin, attempts };
}

function catalogOriginPool(request, env) {
  const primary = selectCatalogOrigin(request, env);
  const ordered = [
    primary,
    env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast,
    env.CATALOG_ORIGIN_US_WEST || REGIONAL_CATALOG_ORIGINS.usWest,
    env.CATALOG_ORIGIN_EUROPE || REGIONAL_CATALOG_ORIGINS.europe,
    env.CATALOG_ORIGIN_INDIA || REGIONAL_CATALOG_ORIGINS.india,
  ];
  return [...new Set(ordered.filter(Boolean).map((value) => value.replace(/\/$/, "")))];
}

function selectCatalogOrigin(request, env) {
  const sticky = stickyCatalogRegion(request);
  if (sticky) return originForRegion(sticky, env);

  const cf = request.cf || {};
  const country = String(cf.country || "").toUpperCase();
  const continent = String(cf.continent || "").toUpperCase();
  const longitude = Number(cf.longitude || 0);

  if (continent === "EU" || continent === "AF") return env.CATALOG_ORIGIN_EUROPE || REGIONAL_CATALOG_ORIGINS.europe;
  if (continent === "AS" || continent === "OC") return env.CATALOG_ORIGIN_INDIA || REGIONAL_CATALOG_ORIGINS.india;
  if (country === "US" || country === "CA" || country === "MX") {
    return longitude && longitude < -100
      ? env.CATALOG_ORIGIN_US_WEST || REGIONAL_CATALOG_ORIGINS.usWest
      : env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast;
  }
  if (continent === "NA" || continent === "SA") return env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast;
  return env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast;
}

function edgeSession(request, env) {
  const cf = request.cf || {};
  const region = stickyCatalogRegion(request) || regionForRequest(request);
  return json(
    {
      region,
      country: String(cf.country || ""),
      colo: String(cf.colo || ""),
      continent: String(cf.continent || ""),
      origin: originForRegion(region, env),
    },
    200,
    {
      ...cacheHeaders("private, max-age=21600"),
      "set-cookie": `atv_catalog_region=${encodeURIComponent(region)}; Path=/; Max-Age=21600; SameSite=None; Secure`,
    },
  );
}

function stickyCatalogRegion(request) {
  const url = new URL(request.url);
  const explicit = normalizeRegion(url.searchParams.get("region") || request.headers.get("x-atv-catalog-region"));
  if (explicit) return explicit;
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)atv_catalog_region=([^;]+)/);
  return normalizeRegion(match ? decodeURIComponent(match[1]) : "");
}

function regionForRequest(request) {
  const cf = request.cf || {};
  const country = String(cf.country || "").toUpperCase();
  const continent = String(cf.continent || "").toUpperCase();
  const longitude = Number(cf.longitude || 0);
  if (continent === "EU" || continent === "AF") return "europe";
  if (continent === "AS" || continent === "OC") return "india";
  if (country === "US" || country === "CA" || country === "MX") return longitude && longitude < -100 ? "usWest" : "usEast";
  if (continent === "NA" || continent === "SA") return "usEast";
  return "usEast";
}

function originForRegion(region, env) {
  if (region === "india") return env.CATALOG_ORIGIN_INDIA || REGIONAL_CATALOG_ORIGINS.india;
  if (region === "usWest") return env.CATALOG_ORIGIN_US_WEST || REGIONAL_CATALOG_ORIGINS.usWest;
  if (region === "europe") return env.CATALOG_ORIGIN_EUROPE || REGIONAL_CATALOG_ORIGINS.europe;
  return env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast;
}

function normalizeRegion(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[-_\s]+(.)/g, (_m, char) => char.toUpperCase());
  if (raw === "india" || raw === "usWest" || raw === "usEast" || raw === "europe") return raw;
  if (raw === "uswest") return "usWest";
  if (raw === "useast") return "usEast";
  return "";
}

async function enrichCatalogPayload(payload, incoming, origin, env) {
  if (!shouldEnrichCatalogPayload(incoming.pathname) || !payload || typeof payload !== "object") return payload;
  const items = Array.isArray(payload.items) ? payload.items : null;
  if (!items?.length) return payload;

  const ids = [...new Set(items
    .map((item) => String(item?.mal_id || item?.anime_id || item?.id || ""))
    .filter(Boolean))]
    .slice(0, 80);
  if (!ids.length) return payload;

  const posters = await fetchCrPosterMap(origin, ids, env).catch(() => null);
  if (!posters) return payload;

  return {
    ...payload,
    items: items.map((item) => {
      const id = String(item?.mal_id || item?.anime_id || item?.id || "");
      const cr = posters[id];
      if (!cr) return item;
      return {
        ...item,
        cr_poster: cr.poster || item.cr_poster,
        cr_hero: cr.hero || item.cr_hero,
        cover_image: cr.poster || item.cover_image,
        banner_image: cr.hero || item.banner_image,
        thumbnail_1080_url: cr.poster || item.thumbnail_1080_url,
        thumbnail_4k_url: cr.hero || item.thumbnail_4k_url,
        cr_mapped: Boolean(cr.has_cr || cr.poster || cr.hero || item.cr_mapped),
      };
    }),
  };
}

function shouldEnrichCatalogPayload(pathname) {
  return CATALOG_CR_ENRICH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function isStaleCatalogJson(response, pathname) {
  if (!isJson(response)) return false;
  try {
    const payload = await response.clone().json();
    if (pathname.startsWith("/api/search")) {
      return !Object.prototype.hasOwnProperty.call(payload, "has_more")
        || !Object.prototype.hasOwnProperty.call(payload, "count")
        || !Object.prototype.hasOwnProperty.call(payload, "page")
        || !payload.facets;
    }
    if (pathname.startsWith("/api/cr/card/")) {
      const hasCr = Number(payload?.has_cr || 0) === 1;
      const seasonCount = Number(payload?.season_count || payload?.seasons?.length || 0);
      const totalEpisodes = Number(payload?.total_episodes || 0);
      return hasCr && seasonCount <= 1 && totalEpisodes >= 50;
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchCrPosterMap(origin, ids, env) {
  const base = origin || env.CATALOG_ORIGIN_US_EAST || REGIONAL_CATALOG_ORIGINS.usEast;
  const url = new URL(`/api/cr/posters?ids=${encodeURIComponent(ids.join(","))}`, base);
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 1800 },
  });
  if (!response.ok || !isJson(response)) return null;
  const payload = await response.json();
  return payload?.posters && typeof payload.posters === "object" ? payload.posters : null;
}

async function proxyImage(request, ctx) {
  const url = new URL(request.url);
  const src = url.searchParams.get("url") || url.searchParams.get("src") || "";
  if (!src) return json({ error: "Missing image url" }, 400, cacheHeaders("no-store"));

  const source = new URL(src);
  if (source.protocol !== "https:" && source.protocol !== "http:") return json({ error: "Invalid image url" }, 400, cacheHeaders("no-store"));
  if (!isAllowedImageHost(source.hostname)) return json({ error: "Image host not allowed" }, 403, cacheHeaders("no-store"));

  if (url.searchParams.get("transform") !== "1") {
    const redirectKey = new Request(`${url.origin}/image-redirect/${encodeURIComponent(source.toString())}`);
    const cachedRedirect = await caches.default.match(redirectKey);
    if (cachedRedirect) return cachedRedirect;

    const redirect = new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders(),
        location: source.toString(),
        "cache-control": `public, max-age=${IMAGE_CACHE_TTL}, immutable`,
      },
    });
    ctx.waitUntil(caches.default.put(redirectKey, redirect.clone()));
    return redirect;
  }

  const width = clampInt(url.searchParams.get("w"), 80, 1920, 480);
  const quality = clampInt(url.searchParams.get("q"), 45, 95, 82);
  const format = imageFormatFor(request, url);
  const cacheKey = new Request(`${url.origin}/image-cache/${format}/${width}/${quality}/${encodeURIComponent(source.toString())}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return withImageHeaders(cached);

  const response = await fetch(source.toString(), {
    headers: {
      "accept": "image/avif,image/webp,image/*,*/*;q=0.8",
      "user-agent": DESKTOP_UA,
      "referer": imageRefererFor(source.hostname),
    },
    redirect: "follow",
    cf: {
      cacheEverything: true,
      cacheTtl: IMAGE_CACHE_TTL,
      image: {
        width,
        quality,
        fit: "scale-down",
        format,
      },
    },
  });

  if (!response.ok) return upstreamError(response);
  const cacheable = withImageHeaders(response);
  ctx.waitUntil(caches.default.put(cacheKey, cacheable.clone()));
  return cacheable;
}

async function proxyM3u8(request, env, ctx) {
  const src = sourceUrl(request);
  const cache = caches.default;
  const cacheKey = streamCacheRequest("m3u8", src);
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached, false);

  const upstream = await fetch(src, {
    headers: upstreamHeaders(src, env),
    redirect: "follow",
    cf: { cacheTtl: MANIFEST_CACHE_TTL, cacheEverything: true },
  });

  if (!upstream.ok) return upstreamError(upstream);

  const upstreamText = await upstream.text();
  ctx.waitUntil(warmGenericPipeline(src, upstreamText, env, GENERIC_WARM_STARTUP_SEGMENTS));
  const rewritten = rewriteM3u8(upstreamText, src, new URL(request.url).origin);
  const response = new Response(rewritten, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
      "vary": "Accept-Encoding",
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function warmMoon(request, env, ctx) {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/")[3];
  if (!/^[A-Za-z0-9_-]+$/.test(videoId || "")) return json({ error: "Invalid Moon video id" }, 400);
  const segments = clampInt(url.searchParams.get("segments"), MOON_WARM_STARTUP_SEGMENTS, MOON_WARM_MAX_SEGMENTS, MOON_WARM_DEFAULT_SEGMENTS);
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}${url.pathname}?segments=${segments}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const seededPlayback = moonSeedPlaybackFromUrl(url);
  ctx.waitUntil(warmMoonPipeline(videoId, env, segments, seededPlayback));
  const response = json(
    { ok: true, video_id: videoId, warming: true, segments },
    202,
    cacheHeaders("public, max-age=120, stale-while-revalidate=300"),
  );
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function proxyMoonM3u8(request, env, ctx) {
  const url = new URL(request.url);
  const videoId = url.pathname.split("/")[3];
  if (!/^[A-Za-z0-9_-]+$/.test(videoId || "")) return json({ error: "Invalid Moon video id" }, 400);
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { headers: cacheVaryHeaders(request) });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
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
    ctx.waitUntil(warmMoonSegments(videoId, variant, child.text, variantUrl, env, MOON_WARM_STARTUP_SEGMENTS));
    const rewrittenChild = rewriteMoonVariant(child.text, variantUrl, new URL(request.url).origin, videoId, variant);
    return cacheMoonManifest(ctx, cacheKey, new Response(rewrittenChild, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
      },
    }));
  }

  if (fastStart) {
    const variantUrl = firstMoonVariantUrl(master.text, playback.url);
    if (variantUrl) {
      const fastVariant = new URL(variantUrl).pathname.split("/").pop() || "index-v1-a1.m3u8";
      const child = await fetchMoonTextCached(variantUrl, env, `moon-variant:${videoId}:${fastVariant}`);
      ctx.waitUntil(warmMoonSegments(videoId, fastVariant, child.text, variantUrl, env, MOON_WARM_STARTUP_SEGMENTS));
      const rewrittenChild = rewriteMoonVariant(child.text, variantUrl, url.origin, videoId, fastVariant);
      return cacheMoonManifest(ctx, cacheKey, new Response(rewrittenChild, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
        },
      }));
    }
    const directVariant = "direct.m3u8";
    ctx.waitUntil(warmMoonSegments(videoId, directVariant, master.text, playback.url, env, MOON_WARM_STARTUP_SEGMENTS));
    const rewrittenDirect = rewriteMoonVariant(master.text, playback.url, url.origin, videoId, directVariant);
    return cacheMoonManifest(ctx, cacheKey, new Response(rewrittenDirect, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
      },
    }));
  }

  ctx.waitUntil(warmMoonPipeline(videoId, env, MOON_WARM_STARTUP_SEGMENTS, playback, master.text));
  if (!firstMoonVariantUrl(master.text, playback.url)) {
    const directVariant = "direct.m3u8";
    const rewrittenDirect = rewriteMoonVariant(master.text, playback.url, url.origin, videoId, directVariant);
    return cacheMoonManifest(ctx, cacheKey, new Response(rewrittenDirect, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
      },
    }));
  }
  const rewritten = rewriteMoonMaster(master.text, playback.url, url.origin, videoId);
  return cacheMoonManifest(ctx, cacheKey, new Response(rewritten, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
    },
  }));
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

function cacheMoonManifest(ctx, cacheKey, response) {
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()).catch((error) => logMoonError("moon_manifest_cache_put_failed", "manifest", error)));
  return response;
}

async function proxyChunk(request, env, ctx) {
  const src = sourceUrl(request);
  const headers = upstreamHeaders(src, env);
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const cache = caches.default;
  const cacheKey = streamCacheRequest("chunk", src, range || "");
  if (!range) {
    const cached = await cache.match(cacheKey);
    if (cached) return streamUpstream(cached, detectMime(src));
  }

  const upstream = range
    ? await fetchGenericSegment(src, headers, range)
    : await genericInflightDedupe(`chunk:${src}`, async () => {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        const fetched = await fetchGenericSegment(src, headers, "");
        if (fetched.status === 200) {
          const cacheable = streamUpstream(fetched, detectMime(src), `public, max-age=${SEGMENT_CACHE_TTL}, immutable`);
          await cache.put(cacheKey, cacheable.clone());
          return cacheable;
        }
        return fetched;
      });

  if (!upstream.ok && upstream.status !== 206) return upstreamError(upstream);
  return streamUpstream(upstream, detectMime(src), range ? undefined : `public, max-age=${SEGMENT_CACHE_TTL}, immutable`);
}

async function proxyVtt(request, env, ctx) {
  const src = sourceUrl(request);
  const cache = caches.default;
  const cacheKey = streamCacheRequest("vtt", src);
  const cached = await cache.match(cacheKey);
  if (cached) return streamUpstream(cached, "text/vtt; charset=utf-8");

  const upstream = await fetch(src, {
    headers: upstreamHeaders(src, env),
    redirect: "follow",
    cf: { cacheTtl: 3600, cacheEverything: true },
  });

  if (!upstream.ok) return upstreamError(upstream);
  const response = streamUpstream(upstream, "text/vtt; charset=utf-8", "public, max-age=3600, stale-while-revalidate=86400");
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchGenericSegment(src, headers, range = "") {
  const requestHeaders = new Headers(headers);
  if (range) requestHeaders.set("range", range);
  return fetch(src, {
    method: "GET",
    headers: requestHeaders,
    redirect: "follow",
    cf: { cacheTtl: range ? 0 : SEGMENT_CACHE_TTL, cacheEverything: !range },
  });
}

async function warmGenericPipeline(playlistUrl, playlistText, env, segmentCount = GENERIC_WARM_DEFAULT_SEGMENTS) {
  return genericInflightDedupe(`warm:${playlistUrl}`, async () => {
    try {
      const variants = genericVariantUrls(playlistText, playlistUrl);
      if (variants.length) {
        await Promise.allSettled(variants.map(async (variant, index) => {
          const variantText = await fetchGenericTextCached(variant.url, env);
          const depth = index === 0 ? segmentCount : GENERIC_WARM_STARTUP_SEGMENTS;
          await warmGenericSegments(variant.url, variantText, env, depth);
        }));
        return;
      }
      await warmGenericSegments(playlistUrl, playlistText, env, segmentCount);
    } catch {
      // Best-effort warming only; playback request path must never wait on this.
    }
  });
}

async function warmGenericSegments(playlistUrl, playlistText, env, segmentCount = GENERIC_WARM_DEFAULT_SEGMENTS) {
  const safeSegmentCount = Math.max(1, Math.min(GENERIC_WARM_MAX_SEGMENTS, segmentCount));
  const entries = [
    ...genericKeyUrls(playlistText, playlistUrl),
    ...genericSegmentUrls(playlistText, playlistUrl).slice(0, safeSegmentCount),
  ];
  await runWarmQueue(entries, (entry) => warmGenericResource(entry.url, env));
}

async function warmGenericResource(url, env) {
  return genericInflightDedupe(`resource:${url}`, async () => {
    const cache = caches.default;
    const key = streamCacheRequest("chunk", url);
    if (await cache.match(key)) return;
    const upstream = await fetchGenericSegment(url, upstreamHeaders(url, env));
    if (upstream.status !== 200) return;
    await cache.put(key, streamUpstream(upstream, detectMime(url), `public, max-age=${SEGMENT_CACHE_TTL}, immutable`));
  });
}

async function fetchGenericTextCached(url, env) {
  const cache = caches.default;
  const key = streamCacheRequest("m3u8-raw", url);
  const cached = await cache.match(key);
  if (cached) return cached.text();
  const upstream = await fetch(url, {
    headers: upstreamHeaders(url, env),
    redirect: "follow",
    cf: { cacheTtl: MANIFEST_CACHE_TTL, cacheEverything: true },
  });
  if (!upstream.ok) throw new Error(`CDN ${upstream.status}`);
  const text = await upstream.text();
  await cache.put(key, new Response(text, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
      "cache-control": `public, s-maxage=${MANIFEST_CACHE_TTL}, stale-while-revalidate=${MANIFEST_STALE_TTL}`,
    },
  }));
  return text;
}

function firstGenericVariantUrl(text, baseUrl) {
  return genericVariantUrls(text, baseUrl)[0]?.url || "";
}

function genericVariantUrls(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const variants = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number((lines[i].match(/BANDWIDTH=(\d+)/i) || [])[1] || 0);
    const next = lines.slice(i + 1).find((line) => line && !line.startsWith("#"));
    if (next) variants.push({ url: new URL(next, baseUrl).toString(), bandwidth });
  }
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}

function genericSegmentUrls(text, baseUrl) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !/\.m3u8(?:$|[?#])/i.test(line))
    .map((line) => {
      const url = new URL(line, baseUrl).toString();
      return { url, segment: new URL(url).pathname.split("/").pop() || line };
    });
}

function genericKeyUrls(text, baseUrl) {
  const urls = [];
  const keyPattern = /#EXT-X-KEY:[^\n\r]*URI=(?:"([^"]+)"|([^,\s]+))/gi;
  let match;
  while ((match = keyPattern.exec(text))) {
    const raw = match[1] || match[2];
    if (!raw) continue;
    const url = new URL(raw, baseUrl).toString();
    urls.push({ url, segment: new URL(url).pathname.split("/").pop() || raw });
  }
  return urls;
}

function genericInflightDedupe(key, factory) {
  const existing = genericInflight.get(key);
  if (existing) return existing;
  if (genericInflight.size > 500) genericInflight.clear();
  const promise = factory().finally(() => genericInflight.delete(key));
  genericInflight.set(key, promise);
  return promise;
}

async function runWarmQueue(entries, worker) {
  const queue = entries.slice();
  const workers = Array.from({ length: Math.min(WARM_CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      if (!entry) return;
      try {
        await worker(entry);
      } catch {
        // Warming is best effort; a bad segment must not abort the rest.
      }
    }
  });
  await Promise.allSettled(workers);
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
  const headers = moonPlaybackHeaders(videoId);
  const fingerprint = makeMoonFingerprint();

  let response = await fetch(`https://398fitus.com/api/videos/${videoId}/embed/playback`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fingerprint }),
  });
  let text = await response.text();

  if (response.status === 428 && text.includes("captcha_required")) {
    const token = await fetchMoonCaptchaToken(videoId, headers, fingerprint);
    response = await fetch(`https://398fitus.com/api/videos/${videoId}/embed/playback`, {
      method: "POST",
      headers: { ...headers, "X-Captcha-Token": token },
      body: JSON.stringify({ fingerprint }),
    });
    text = await response.text();
  }

  if (!response.ok) throw new Error(`Moon playback ${response.status}: ${text.slice(0, 120)}`);

  const playback = (JSON.parse(text).playback || {});
  const keys = [
    concatBytes(selectMoonKeyParts(playback).map(base64UrlBytes)),
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

function moonPlaybackHeaders(videoId) {
  return {
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
}

function makeMoonFingerprint() {
  return {
    token: crypto.randomUUID().replaceAll("-", ""),
    viewer_id: crypto.randomUUID().replaceAll("-", ""),
    device_id: crypto.randomUUID().replaceAll("-", ""),
    confidence: 1,
  };
}

async function fetchMoonCaptchaToken(videoId, headers, fingerprint) {
  const challengeResponse = await fetch(`https://398fitus.com/api/videos/${videoId}/embed/captcha`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fingerprint }),
  });
  const challengeText = await challengeResponse.text();
  if (!challengeResponse.ok) {
    throw new Error(`Moon captcha ${challengeResponse.status}: ${challengeText.slice(0, 120)}`);
  }
  const challenge = JSON.parse(challengeText);
  const solution = await solveMoonPow(challenge.pow_nonce, Number(challenge.pow_difficulty || 0));
  if (!solution) throw new Error("Moon captcha pow solve timed out");

  const verifyResponse = await fetch(`https://398fitus.com/api/videos/${videoId}/embed/captcha/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      pow_token: challenge.pow_token,
      solution,
      fingerprint,
    }),
  });
  const verifyText = await verifyResponse.text();
  if (!verifyResponse.ok) throw new Error(`Moon captcha verify ${verifyResponse.status}: ${verifyText.slice(0, 120)}`);
  const verified = JSON.parse(verifyText);
  if (verified.status !== "ok" || !verified.token) {
    throw new Error(`Moon captcha verify failed: ${verified.reason || "missing token"}`);
  }
  return verified.token;
}

async function solveMoonPow(nonce, difficulty, timeoutMs = 12000) {
  if (!nonce || !Number.isFinite(difficulty)) return null;
  if (difficulty <= 0) return "0";
  const prefix = `${nonce}:`;
  const started = Date.now();
  for (let solution = 0; ; solution += 1) {
    const words = moonPowHash(`${prefix}${solution}`);
    if (moonLeadingZeroBits(words) >= difficulty) return String(solution);
    if (solution % 1024 === 0) {
      if (Date.now() - started > timeoutMs) return null;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

const MOON_POW_BUFFER = 512;
const MOON_POW_MASK = MOON_POW_BUFFER - 1;
const MOON_POW_ROUNDS = 2;
const MOON_POW_MUL_A = 2654435761;
const MOON_POW_MUL_B = 2246822519;

function moonPowHash(text) {
  const state = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762]);
  const input = moonPowBytes(text);
  for (const byte of input) {
    state[0] = (state[0] + byte) >>> 0;
    state[0] = moonRotateLeft(state[0], 7);
    moonPowMix(state);
  }
  for (let i = 0; i < 8; i += 1) moonPowMix(state);

  const scratch = new Uint32Array(MOON_POW_BUFFER);
  for (let i = 0; i < MOON_POW_BUFFER; i += 1) {
    moonPowMix(state);
    scratch[i] = (state[0] ^ state[2]) >>> 0;
  }

  for (let round = 0; round < MOON_POW_ROUNDS; round += 1) {
    for (let index = 0; index < MOON_POW_BUFFER; index += 1) {
      const selected = scratch[index] & MOON_POW_MASK;
      let value = (scratch[index] + scratch[selected]) >>> 0;
      value = moonRotateLeft(value, 13);
      value = (value ^ Math.imul(scratch[(index + 1) & MOON_POW_MASK], MOON_POW_MUL_A)) >>> 0;
      scratch[index] = value;
      state[0] = (state[0] ^ value) >>> 0;
      moonPowMix(state);
    }
  }

  const output = new Uint32Array(8);
  const chunk = MOON_POW_BUFFER / 8;
  for (let i = 0; i < 8; i += 1) {
    moonPowMix(state);
    let value = state[0];
    const offset = i * chunk;
    for (let cursor = 0; cursor < chunk; cursor += 1) {
      const entry = scratch[offset + cursor];
      value = (value + entry) >>> 0;
      value = moonRotateLeft(value, 5);
      value = (value ^ Math.imul(entry, MOON_POW_MUL_B)) >>> 0;
    }
    output[i] = (value ^ state[2]) >>> 0;
  }
  return output;
}

function moonPowMix(state) {
  state[0] = (state[0] + state[1]) >>> 0;
  state[3] = moonRotateLeft(state[3] ^ state[0], 16);
  state[2] = (state[2] + state[3]) >>> 0;
  state[1] = moonRotateLeft(state[1] ^ state[2], 12);
  state[0] = (state[0] + state[1]) >>> 0;
  state[3] = moonRotateLeft(state[3] ^ state[0], 8);
  state[2] = (state[2] + state[3]) >>> 0;
  state[1] = moonRotateLeft(state[1] ^ state[2], 7);
}

function moonRotateLeft(value, bits) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function moonLeadingZeroBits(words) {
  let count = 0;
  for (const word of words) {
    if (word === 0) {
      count += 32;
      continue;
    }
    return count + Math.clz32(word);
  }
  return count;
}

function moonPowBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index) & 255;
  }
  return bytes;
}

function selectMoonKeyParts(playback) {
  const parts = Array.isArray(playback?.key_parts)
    ? playback.key_parts.filter((part) => typeof part === "string" && part.length > 0)
    : [];
  const version = String(playback?.version || "").trim();
  if (/^\d+$/.test(version)) {
    const first = Number(version);
    const second = 31 - first;
    if (first >= 1 && second >= 1 && first <= parts.length && second <= parts.length) {
      const selected = [parts[first - 1], parts[second - 1]];
      if (selected.every(Boolean)) return selected;
    }
  }
  return parts;
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
    const hot = moonPlaybackMemoryGet(videoId);
    if (hot) return hot;

    const cached = await cache.match(key);
    if (cached) {
      const payload = await cached.json();
      moonPlaybackMemorySet(videoId, payload);
      return payload;
    }
  }

  const playback = await fetchMoonPlayback(videoId);
  moonPlaybackMemorySet(videoId, playback);
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
  headers.set("vary", "Accept-Encoding");
  return new Response(response.body, { status: response.status, headers });
}

async function warmMoonPipeline(videoId, env, segmentCount = MOON_WARM_DEFAULT_SEGMENTS, playback, masterText) {
  try {
    const cachedPlayback = playback || await fetchMoonPlaybackCached(videoId);
    const master = masterText ? { text: masterText } : await fetchMoonTextCached(cachedPlayback.url, env, `moon-master:${videoId}`);
    const variants = moonVariantUrls(master.text, cachedPlayback.url);
    if (!variants.length) return;
    await Promise.allSettled(variants.map(async (variantEntry, index) => {
      const variant = new URL(variantEntry.url).pathname.split("/").pop() || "index-v1-a1.m3u8";
      const child = await fetchMoonTextCached(variantEntry.url, env, `moon-variant:${videoId}:${variant}`);
      const depth = index === 0 ? segmentCount : MOON_WARM_STARTUP_SEGMENTS;
      await warmMoonSegments(videoId, variant, child.text, variantEntry.url, env, depth);
    }));
  } catch (error) {
    logMoonError("moon_warm_failed", videoId, error);
  }
}

async function warmMoonSegments(videoId, variant, playlistText, playlistUrl, env, segmentCount = MOON_WARM_DEFAULT_SEGMENTS) {
  const safeSegmentCount = Math.max(1, Math.min(MOON_WARM_MAX_SEGMENTS, segmentCount));
  const entries = [
    ...moonKeyUrls(playlistText, playlistUrl),
    ...moonSegmentUrls(playlistText, playlistUrl).slice(0, safeSegmentCount),
  ];
  await runWarmQueue(entries, (entry) => warmMoonResource(videoId, variant, entry.segment, entry.url, env));
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
  return moonVariantUrls(text, baseUrl)[0]?.url || "";
}

function moonVariantUrls(text, baseUrl) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const variants = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number((lines[index].match(/BANDWIDTH=(\d+)/i) || [])[1] || 0);
    const next = lines.slice(index + 1).find((line) => line && !line.startsWith("#"));
    if (next) variants.push({ url: new URL(next, baseUrl).toString(), bandwidth });
  }
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
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

function isAllowedImageHost(hostname) {
  const host = hostname.toLowerCase();
  return [
    "cdn.myanimelist.net",
    "myanimelist.net",
    "s4.anilist.co",
    "media.kitsu.io",
    "img.youtube.com",
    "anime-search-api-burw.onrender.com",
    "crunchyroll.com",
    "imgsrv.crunchyroll.com",
  ].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function imageRefererFor(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes("anilist")) return "https://anilist.co/";
  if (host.includes("myanimelist")) return "https://myanimelist.net/";
  if (host.includes("youtube")) return "https://www.youtube.com/";
  return "https://animetvplus.xyz/";
}

function imageFormatFor(request, url) {
  const requested = (url.searchParams.get("f") || url.searchParams.get("format") || "auto").toLowerCase();
  if (requested === "webp" || requested === "avif") return requested;
  const accept = request.headers.get("accept") || "";
  return accept.includes("image/avif") ? "avif" : "webp";
}

function withImageHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  if (headers.get("vary") === "*") headers.delete("vary");
  headers.set("access-control-allow-origin", "*");
  headers.set("cache-control", `public, max-age=${IMAGE_CACHE_TTL}, stale-while-revalidate=${IMAGE_CACHE_TTL}`);
  headers.set("vary", "Accept");
  return new Response(response.body, { status: response.status, headers });
}

function streamUpstream(upstream, forcedContentType, cacheControl) {
  const headers = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", "Content-Length, Content-Range, Accept-Ranges");
  headers.set("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");
  headers.set("cache-control", cacheControl || upstream.headers.get("cache-control") || `public, max-age=${SEGMENT_CACHE_TTL}, immutable`);
  headers.set("vary", "Accept-Encoding");
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
  return { ...corsHeaders(), "cache-control": cacheControl, "vary": "Accept-Encoding" };
}

function originHeaders(cacheControl, origin, attempts) {
  return {
    ...cacheHeaders(cacheControl),
    "x-catalog-origin": origin || "",
    "x-catalog-origin-attempts": attempts.join(","),
  };
}

function withCatalogDebugHeaders(response, origin, attempts) {
  const headers = new Headers(response.headers);
  if (origin) headers.set("x-catalog-origin", origin);
  if (attempts?.length) headers.set("x-catalog-origin-attempts", attempts.join(","));
  return new Response(response.body, { status: response.status, headers });
}

function corsPreflight() {
  return new Response(null, { status: 204, headers: { ...corsHeaders(), "cache-control": "public, max-age=86400" } });
}

function json(payload, status = 200, headers = corsHeaders()) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "content-type": "application/json; charset=utf-8" },
  });
}

function streamCacheRequest(kind, src, range = "") {
  return new Request(`https://anime-tv-stream-proxy.local/${STREAM_CACHE_VERSION}/${kind}/${encodeURIComponent(src)}${range ? `?range=${encodeURIComponent(range)}` : ""}`);
}

function originApiTtl(pathname) {
  if (pathname === "/api/status") return 10;
  if (pathname.startsWith("/api/search")) return 300;
  if (pathname.startsWith("/api/cr/")) return 1800;
  if (pathname.startsWith("/api/episodes/") || pathname.startsWith("/api/streams/") || pathname.startsWith("/api/stream/")) return 300;
  if (pathname.startsWith("/api/anime/") || pathname.startsWith("/api/catalog")) return 900;
  if (pathname.startsWith("/api/image-transform") || pathname.startsWith("/api/image-db/") || pathname.startsWith("/api/images/")) return IMAGE_CACHE_TTL;
  if (pathname.startsWith("/anime/episode/")) return 3600;
  if (pathname.startsWith("/home/") || pathname === "/api/v1/banners") return 600;
  if (pathname.startsWith("/search/") || pathname.startsWith("/suggest/")) return 300;
  return 120;
}

function originApiCacheControl(pathname) {
  if (pathname === "/api/status") return "public, s-maxage=10, stale-while-revalidate=60";
  if (pathname.startsWith("/api/search")) return "public, s-maxage=300, stale-while-revalidate=1800";
  if (pathname.startsWith("/api/cr/")) return "public, s-maxage=1800, stale-while-revalidate=86400";
  if (pathname.startsWith("/api/episodes/") || pathname.startsWith("/api/streams/") || pathname.startsWith("/api/stream/")) return "public, s-maxage=300, stale-while-revalidate=1800";
  if (pathname.startsWith("/api/anime/") || pathname.startsWith("/api/catalog")) return "public, s-maxage=900, stale-while-revalidate=3600";
  if (pathname.startsWith("/api/image-transform") || pathname.startsWith("/api/image-db/") || pathname.startsWith("/api/images/")) return `public, s-maxage=${IMAGE_CACHE_TTL}, stale-while-revalidate=${IMAGE_CACHE_TTL}`;
  if (pathname.startsWith("/anime/episode/")) return "public, s-maxage=3600, stale-while-revalidate=86400";
  if (pathname.startsWith("/home/") || pathname === "/api/v1/banners") return "public, s-maxage=600, stale-while-revalidate=3600";
  if (pathname.startsWith("/search/") || pathname.startsWith("/suggest/")) return "public, s-maxage=300, stale-while-revalidate=900";
  return "public, s-maxage=120, stale-while-revalidate=600";
}

function cacheVaryHeaders(request) {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  return headers;
}

function streamApiMemoryGet(key) {
  const entry = streamApiMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    streamApiMemoryCache.delete(key);
    return null;
  }
  return entry.payload;
}

function streamApiMemorySet(key, payload) {
  if (streamApiMemoryCache.size > 300) {
    const firstKey = streamApiMemoryCache.keys().next().value;
    if (firstKey) streamApiMemoryCache.delete(firstKey);
  }
  streamApiMemoryCache.set(key, { payload, expiresAt: Date.now() + STREAM_API_MEMORY_TTL });
}

function moonPlaybackMemoryGet(videoId) {
  const entry = moonPlaybackMemoryCache.get(videoId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    moonPlaybackMemoryCache.delete(videoId);
    return null;
  }
  return entry.payload;
}

function moonPlaybackMemorySet(videoId, payload) {
  if (moonPlaybackMemoryCache.size > 200) {
    const firstKey = moonPlaybackMemoryCache.keys().next().value;
    if (firstKey) moonPlaybackMemoryCache.delete(firstKey);
  }
  moonPlaybackMemoryCache.set(videoId, {
    payload,
    expiresAt: Date.now() + MOON_CACHE_TTL * 1000,
  });
}
