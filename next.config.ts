import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.88.55.120"],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "myanimelist.net" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "s4.anilist.co", pathname: "/file/anilistcdn/**" },
      { protocol: "https", hostname: "media.kitsu.io" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "anime-search-api-burw.onrender.com" },
    ],
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
