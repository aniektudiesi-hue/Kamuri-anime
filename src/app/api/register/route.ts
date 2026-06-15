import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body?.email || "").trim();
    const platform = (body?.platform || "").trim();
    const errors = (body?.errors || "").trim();

    if (!email || !platform) {
      return NextResponse.json({ error: "email and platform required" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    fetch(`${API_BASE}/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/register/${platform}`,
        referrer: email,
        screen: errors ? `errors:${errors.slice(0, 200)}` : "no-errors",
      }),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
