import { NextRequest, NextResponse } from "next/server";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";
import { signNpcAdminSessionTokens } from "@/lib/admin/admin-session-jwt";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function parseAdminUserIdFromEnv(): number {
  const raw = (process.env.ADMIN_USER_ID ?? "").trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.trunc(parsed);
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const username = typeof (body as { username?: string })?.username === "string"
      ? (body as { username: string }).username.trim()
      : "";
    const password = typeof (body as { password?: string })?.password === "string"
      ? (body as { password: string }).password.trim()
      : "";

    const adminUsername = (process.env.ADMIN_USERNAME ?? "")
      .trim()
      .replace(/\r?\n/g, "");
    let adminPassword = (process.env.ADMIN_PASSWORD ?? "")
      .trim()
      .replace(/\r?\n/g, "");
    if (adminPassword.startsWith("#")) {
      adminPassword = adminPassword.slice(1);
    }

    if (!adminUsername || !adminPassword) {
      return NextResponse.json({ error: "Admin credentials not configured" }, { status: 500 });
    }

    const usernameMatch = username.toLowerCase() === adminUsername.toLowerCase();
    const passwordMatch = password === adminPassword;

    if (!usernameMatch || !passwordMatch) {
      return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
    }

    const canonicalUsername = adminUsername;
    const userId = parseAdminUserIdFromEnv();
    const { adminToken, userToken } = await signNpcAdminSessionTokens({
      userId,
      username: canonicalUsername,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: canonicalUsername,
        email: `${canonicalUsername}@admin.local`,
      },
    });

    const host = cookieHostFromRequest(request);
    response.cookies.set("admin-token", adminToken, {
      ...sessionCookieBase(host),
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("auth-token", userToken, {
      ...sessionCookieBase(host),
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-login-edge]", message);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
