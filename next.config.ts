import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "myanimelist.net" },
      { protocol: "https", hostname: "s4.anilist.co" },
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
