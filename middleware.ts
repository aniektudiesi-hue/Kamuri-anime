import { NextResponse, type NextRequest } from "next/server";
import { SITE_MAINTENANCE } from "@/lib/maintenance";

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    !SITE_MAINTENANCE ||
    pathname === "/maintenance" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  return NextResponse.rewrite(url);
}

