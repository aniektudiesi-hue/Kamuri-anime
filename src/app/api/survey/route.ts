import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const choice = body?.choice;
    if (choice !== "close" && choice !== "ads") {
      return NextResponse.json({ error: "invalid choice" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";

    await fetch(`${API_BASE}/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        path: `/survey/${choice}`,
        referrer: ip,
        language: ua.slice(0, 120),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `survey-${choice}`,
      }),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, choice });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 401 });
  }

  try {
    const r = await fetch(`${API_BASE}/admin/visits?limit=1000`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
        "X-Admin-Key": key,
      },
    });
    if (!r.ok) return NextResponse.json({ error: "upstream error" }, { status: r.status });

    const data = await r.json();
    const items = (data?.items || []) as Array<{ path?: string; referrer?: string; created_at?: string }>;

    let ads = 0;
    let close = 0;
    const voters: Array<{ choice: string; ip: string; at: string }> = [];

    for (const item of items) {
      if (item.path === "/survey/ads") {
        ads++;
        voters.push({ choice: "ads", ip: item.referrer || "?", at: item.created_at || "" });
      } else if (item.path === "/survey/close") {
        close++;
        voters.push({ choice: "close", ip: item.referrer || "?", at: item.created_at || "" });
      }
    }

    return NextResponse.json({
      ads,
      close,
      total: ads + close,
      voters,
    }, {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
