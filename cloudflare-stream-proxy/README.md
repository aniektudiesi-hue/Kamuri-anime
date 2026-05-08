# animeTv Cloudflare stream proxy

This Worker fronts the RO-ANIME FastAPI backend and moves HLS playlist, segment,
MP4, and VTT proxying to Cloudflare Workers.

## Routes

- `/api/stream/*`, `/api/moon/*`, `/api/hd1/*`: forwarded to Render with
  `x-forwarded-host` set to the Worker host, then stream URLs are normalized to
  Worker `/proxy/*` URLs.
- `/proxy/m3u8`: fetches and rewrites HLS playlists.
- `/proxy/chunk`: streams media segments/MP4 responses with range headers.
- `/proxy/vtt`: streams captions with CORS.
- Everything else forwards to the Render backend so the frontend can use this
  Worker as `NEXT_PUBLIC_API_BASE_URL`.

## Commands

```powershell
cd "C:\Users\anike\OneDrive\Documents\GitHub\ro-anime-stream\cloudflare-stream-proxy"
npm install
npm run dry-run
npm run deploy
```

Then set the frontend production env var:

```powershell
vercel env add NEXT_PUBLIC_API_BASE_URL production
```

Use the deployed Worker URL as the value, then redeploy the frontend.
