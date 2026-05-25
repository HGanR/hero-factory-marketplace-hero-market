import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  const base = sessionCookieBase(cookieHostFromRequest(request));

  // Clear both marketplace + admin auth cookies (match login cookie domain/path)
  response.cookies.set("auth-token", "", {
    ...base,
    maxAge: 0,
  });

  response.cookies.set("admin-token", "", {
    ...base,
    maxAge: 0,
  });

  return response;
}


