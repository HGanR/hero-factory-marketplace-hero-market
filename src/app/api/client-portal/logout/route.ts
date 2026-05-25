import { NextRequest, NextResponse } from "next/server";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";

export async function POST(_req: NextRequest) {
  const b = sessionCookieBase(cookieHostFromRequest(_req));
  const res = NextResponse.json({ ok: true });
  res.cookies.set("client-portal-token", "", { ...b, maxAge: 0 });
  return res;
}
