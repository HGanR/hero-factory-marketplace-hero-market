import type { NextRequest } from "next/server";
import { getCookieFromHeader } from "@/lib/http/cookie-parse";
import { npcJwtPayloadIsAdmin, verifyNpcAdminJwt } from "@/lib/admin/admin-session-jwt";

const adminCookieCandidates = (request: NextRequest) =>
  [request.cookies.get("admin-token")?.value, request.cookies.get("auth-token")?.value].filter((t): t is string =>
    Boolean(t?.trim()),
  );

/**
 * NPC admin APIs historically only read `admin-token`. After `/api/admin/login`, both
 * `admin-token` and `auth-token` are set with `isAdmin: true`. Accept either JWT so a
 * missing/stale `admin-token` alone does not blank the admin NPC UI when the user session is valid.
 *
 * Uses `jose` so this works on Edge routes and avoids pulling `@/lib/auth` (bcrypt/jsonwebtoken).
 */
export async function resolveNpcAdminSession(request: NextRequest): Promise<{ username?: string } | null> {
  for (const token of adminCookieCandidates(request)) {
    const decoded = await verifyNpcAdminJwt(token);
    if (npcJwtPayloadIsAdmin(decoded)) {
      const username = typeof decoded?.username === "string" ? decoded.username : undefined;
      return { username };
    }
  }
  return null;
}

export async function requireNpcAdminSession(request: NextRequest): Promise<boolean> {
  return (await resolveNpcAdminSession(request)) !== null;
}

/** Pages API / raw `Cookie` header — same JWT rules as {@link resolveNpcAdminSession}. */
export async function resolveNpcAdminSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<{ username?: string } | null> {
  const candidates = [
    getCookieFromHeader(cookieHeader, "admin-token"),
    getCookieFromHeader(cookieHeader, "auth-token"),
  ].filter((t): t is string => Boolean(t?.trim()));
  for (const token of candidates) {
    const decoded = await verifyNpcAdminJwt(token);
    if (npcJwtPayloadIsAdmin(decoded)) {
      const username = typeof decoded?.username === "string" ? decoded.username : undefined;
      return { username };
    }
  }
  return null;
}
