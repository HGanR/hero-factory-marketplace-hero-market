import { NextRequest, NextResponse } from "next/server";
import { sessionCookieBase } from "@/lib/auth-cookie-options";

export async function POST(_req: NextRequest) {
  const b = sessionCookieBase();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("client-portal-token", "", { ...b, maxAge: 0 });
  return res;
}
