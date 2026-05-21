import { NextResponse } from "next/server";
import { getHomepageSchedule } from "@/lib/home-server";

export const revalidate = 21600;

export async function GET() {
  const schedule = await getHomepageSchedule();
  return NextResponse.json(
    { schedule },
    {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
