import { NextRequest } from "next/server";

// Server-side proxy for the VAST ad tag. Keeps the ad network endpoint flexible,
// avoids browser CORS issues, and lets us swap/disable ads from one place.
const VAST_TAG = "https://s.magsrv.com/v1/vast.php?idz=5947422&ex_av=name";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const upstream = await fetch(VAST_TAG, {
      headers: { Accept: "application/xml,text/xml,*/*", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    const xml = await upstream.text();
    return new Response(xml, {
      status: upstream.ok ? 200 : 204,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // No ad — let the player start content immediately.
    return new Response("", { status: 204 });
  }
}
