import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Production apex host (no www). Host-only cookies differ between www and apex — redirect GETs to one host. */
const CANONICAL_HOST = "troothhurtz.app";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next/") || pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || host !== `www.${CANONICAL_HOST}`) {
    return NextResponse.next();
  }
  // Avoid redirecting POST (e.g. login) — body may not replay reliably; use AUTH_COOKIE_DOMAIN for www+apex cookies.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.hostname = CANONICAL_HOST;
  return NextResponse.redirect(url, 308);
}

export const config = {
  /**
   * Skip static assets. Also skip all `/_next/*` in the matcher so the www→apex redirect never runs on
   * RSC/flight/chunks (only `_next/static` + `_next/image` is not enough on Next 15+).
   */
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\..*).*)"],
};
