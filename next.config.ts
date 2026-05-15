import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.88.55.120"],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.animetvplus.xyz" },
      { protocol: "https", hostname: "anime-tv-stream-proxy.kamuri-anime.workers.dev" },
      { protocol: "https", hostname: "myanimelist.net" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "s4.anilist.co", pathname: "/file/anilistcdn/**" },
      { protocol: "https", hostname: "media.kitsu.io" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "anime-search-api-burw.onrender.com" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [80, 120, 160, 240, 320, 480],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|png|jpg|jpeg|webp|avif|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.animetvplus.xyz" }],
        destination: "https://animetvplus.xyz/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
