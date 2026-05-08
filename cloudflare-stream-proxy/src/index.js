const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STREAM_API_PREFIXES = ["/api/stream/", "/api/moon/", "/api/hd1/"];
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
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsPreflight();

    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") return json({ ok: true, worker: "anime-tv-stream-proxy" });
      if (url.pathname === "/proxy/m3u8") return proxyM3u8(request, env);
      if (url.pathname === "/proxy/chunk") return proxyChunk(request, env);
      if (url.pathname === "/proxy/vtt") return proxyVtt(request, env);
      return proxyOrigin(request, env);
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
  const path = new URL(src).pathname.toLowerCase();
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
