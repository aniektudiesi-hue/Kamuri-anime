# KairoStream

A full Next.js App Router frontend for the RO-ANIME v3 FastAPI API. It provides a dark anime streaming workflow with hero banners, fast search suggestions, anime detail pages, episode grids, HLS playback, server fallback, auth, watch history, watchlist, and downloads metadata.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- TanStack Query
- HLS.js
- RO-ANIME v3 API

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The default API base URL is `https://anime-search-api-burw.onrender.com`.

Override it with:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Features

- Home page fetches banners, thumbnails, recently added, and top rated anime in parallel.
- Global search uses `/suggest/{query}` with debounce and `/search/{query}` for full results.
- Anime detail pages fetch `/anime/episode/{mal_id}` and prefetch episode data from cards.
- Watch pages use MegaPlay first, then Moon and HD1 fallback, with sub/dub switching.
- HLS streams are played with HLS.js; iframe responses are embedded as fallback.
- Auth stores the bearer token in local storage and attaches it to user endpoints.
- History, watchlist, and downloads metadata pages use authenticated API calls.
- Next episode route and likely stream are prefetched while watching.

## Deploy On Vercel

The included `vercel.json` uses the standard Next.js build.

1. Import this repository into Vercel.
2. Set `NEXT_PUBLIC_API_BASE_URL` if you are not using the default API.
3. Deploy.

## API Source Of Truth

This app only uses endpoints available in the RO-ANIME OpenAPI schema:

- `GET /api/v1/banners`
- `GET /home/thumbnails`
- `GET /home/recently-added`
- `GET /home/top-rated`
- `GET /search/{query}`
- `GET /suggest/{query}`
- `GET /anime/episode/{mal_id}`
- `GET /api/stream/{mal_id}/{episode_num}`
- `GET /api/moon/{mal_id}/{episode_num}`
- `GET /api/hd1/{mal_id}/{episode_num}`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `/user/history`, `/user/watchlist`, `/user/downloads`
