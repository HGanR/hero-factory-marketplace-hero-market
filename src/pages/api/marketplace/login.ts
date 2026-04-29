import type { NextApiRequest, NextApiResponse } from "next";
import { eq, or, sql } from "drizzle-orm";
import { getDb, withDbTimeout } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { verifyPassword, createToken } from "@/lib/auth";
import { sessionCookieBase } from "@/lib/auth-cookie-options";

/**
 * Pages Router Node — `/api/marketplace/login`.
 * Keeps marketplace user sign-in on the currently stable runtime.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    const db = await withDbTimeout(getDb(), 5000, "getDb");

    const users = await withDbTimeout(
      db
        .select()
        .from(marketplaceUsers)
        .where(
          or(
            sql`LOWER(${marketplaceUsers.email}) = LOWER(${identifier})`,
            sql`LOWER(${marketplaceUsers.username}) = LOWER(${identifier})`
          )
        )
        .limit(1),
      10_000,
      "marketplace login user lookup"
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0]!;
    const hash = user.passwordHash ?? "";

    if (!user.isApproved) {
      return res.status(403).json({ error: "Account not yet approved" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account has been deactivated" });
    }

    if (!hash || hash.length < 10) {
      console.warn("[login] Approved user has no passwordHash", {
        userId: user.id,
        email: user.email,
        username: user.username,
      });
      return res.status(403).json({
        error:
          "Password not set. Your account is approved but no password was generated. Ask admin to click 'Generate Password' for your account.",
      });
    }

    let passwordValid = false;
    try {
      passwordValid = verifyPassword(password, hash);
    } catch (err) {
      console.error("[login] verifyPassword error", {
        userId: user.id,
        err: err instanceof Error ? err.message : String(err),
      });
      return res.status(500).json({ error: "Login failed" });
    }

    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    await withDbTimeout(
      db
        .update(marketplaceUsers)
        .set({ lastLogin: new Date() })
        .where(eq(marketplaceUsers.id, user.id)),
      5000,
      "marketplace login update lastLogin"
    );

    const token = createToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    res.setHeader("Set-Cookie", [
      serializeCookie("auth-token", token, {
        ...sessionCookieBase(),
        maxAge: 60 * 60 * 24 * 7,
      }),
    ]);

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        hasTokenAccess: user.hasTokenAccess,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { code?: string };
    const message = err instanceof Error ? err.message : String(error);
    console.error("[marketplace-login] error", {
      code: err.code ?? null,
      message,
    });

    const safeMessage =
      message.includes("DATABASE_URL") ||
      message.includes("Database") ||
      message.includes("Misconfigured") ||
      message.includes("hero-market") ||
      /timed out after|econn|enotfound|etimedout|getaddrinfo/i.test(message)
        ? message
        : "Login failed";

    return res.status(500).json({ error: safeMessage });
  }
}

type CookieOpts = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
  maxAge?: number;
};

function serializeCookie(name: string, value: string, opts: CookieOpts): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  return parts.join("; ");
}
