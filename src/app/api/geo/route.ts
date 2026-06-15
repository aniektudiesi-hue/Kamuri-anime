import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") || "";
  const continent = request.headers.get("x-vercel-ip-continent") || "";
  const city = request.headers.get("x-vercel-ip-city") || "";
  return NextResponse.json(
    { country, continent, city },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
