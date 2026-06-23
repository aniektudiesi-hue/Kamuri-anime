import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://anime-search-api-burw.onrender.com";
const MAX_ITEMS = 300;

type HelpRequest = {
  id: string;
  type: "help";
  region: string;
  name: string;
  email: string;
  issue_type: string;
  message: string;
  ip: string;
  ua: string;
  created_at: number;
};

const store = ((globalThis as Record<string, unknown>).__helpRequests ??= {
  items: [] as HelpRequest[],
}) as { items: HelpRequest[] };

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const region = clean(body?.region, 80);
    const name = clean(body?.name, 120);
    const email = clean(body?.email, 180).toLowerCase();
    const issueType = clean(body?.issueType ?? body?.issue_type, 160);
    const message = clean(body?.message, 2000);

    if (!region || !name || !email || !issueType || !message) {
      return NextResponse.json({ error: "region, name, email, issueType and message required" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ua = request.headers.get("user-agent") || "";
    const item: HelpRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: "help",
      region,
      name,
      email,
      issue_type: issueType,
      message,
      ip,
      ua: ua.slice(0, 160),
      created_at: Math.floor(Date.now() / 1000),
    };

    store.items.unshift(item);
    store.items = store.items.slice(0, MAX_ITEMS);

    fetch(`${API_BASE}/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/help/${issueType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "request"}`,
        referrer: email,
        screen: `help:${message.slice(0, 200)}`,
      }),
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(
    { items: store.items, total: store.items.length },
    { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}
