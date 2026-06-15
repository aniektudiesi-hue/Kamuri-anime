import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

type Voter = { choice: string; ip: string; ua: string; at: string };

const store = ((globalThis as Record<string, unknown>).__surveyVotes ??= {
  ads: 0,
  close: 0,
  voters: [] as Voter[],
}) as { ads: number; close: number; voters: Voter[] };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const choice = body?.choice;
    if (choice !== "close" && choice !== "ads") {
      return NextResponse.json({ error: "invalid choice" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";

    store[choice]++;
    store.voters.push({ choice, ip, ua: ua.slice(0, 80), at: new Date().toISOString() });

    // Also fire-and-forget to analytics as backup
    fetch(`${API_BASE}/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `/survey/${choice}`, referrer: ip, screen: `survey-${choice}` }),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, choice });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

export async function GET() {
  const total = store.ads + store.close;
  return NextResponse.json(
    { ads: store.ads, close: store.close, total, voters: store.voters },
    { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}
