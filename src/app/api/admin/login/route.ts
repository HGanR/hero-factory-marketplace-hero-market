// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password.trim() : "";

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
      return NextResponse.json(
        { error: "Admin credentials not configured" },
        { status: 500 }
      );
    }

    const usernameMatch = username.toLowerCase() === adminUsername.toLowerCase();
    const passwordMatch = password === adminPassword;

    if (!usernameMatch || !passwordMatch) {
      console.warn("[admin-login] Invalid credentials", {
        usernameLen: username.length,
        passwordLen: password.length,
        envUsernameLen: adminUsername.length,
        envPasswordLen: adminPassword.length,
        usernameMatch,
        passwordMatch,
      });
      return NextResponse.json(
        {
          error: "Invalid admin credentials",
          hint: [
            "Username or password does not match Vercel ADMIN_USERNAME / ADMIN_PASSWORD.",
            "If password starts with #, set it WITHOUT the leading # in env.",
            "Redeploy after changing env vars.",
          ].join(" "),
        },
        { status: 401 }
      );
    }

    const canonicalUsername = adminUsername;
    const cookieBase = sessionCookieBase(cookieHostFromRequest(request));

    const db = await getDb();
    let adminUser = await db
      .select()
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.username, canonicalUsername))
      .limit(1);

    if (adminUser.length === 0) {
      await db.insert(marketplaceUsers).values({
        email: `${canonicalUsername}@admin.local`,
        username: canonicalUsername,
        passwordHash: "",
        isActive: true,
        isApproved: true,
        hasTokenAccess: true,
      });
      adminUser = await db
        .select()
        .from(marketplaceUsers)
        .where(eq(marketplaceUsers.username, canonicalUsername))
        .limit(1);
    }

    const userId = adminUser[0].id;

    const adminToken = createToken({
      userId,
      isAdmin: true,
      username: canonicalUsername,
    });
    const userToken = createToken({ userId, username: canonicalUsername, isAdmin: true });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: canonicalUsername,
        email: adminUser[0].email,
      },
    });

    response.cookies.set("admin-token", adminToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24,
    });

    response.cookies.set("auth-token", userToken, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-login] error", {
      message,
      code: (error as NodeJS.ErrnoException)?.code ?? null,
    });
    const lower = message.toLowerCase();
    const looksDbOrConfig =
      lower.includes("database") ||
      lower.includes("database_url") ||
      lower.includes("mysql") ||
      lower.includes("tidb") ||
      lower.includes("econn") ||
      lower.includes("etimedout") ||
      lower.includes("access denied");
    const safeMessage =
      process.env.NODE_ENV === "development"
        ? message
        : looksDbOrConfig
          ? message.length > 600
            ? `${message.slice(0, 600)}…`
            : message
          : "Login failed";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
