import { verifyToken, normalizeJwtUserId } from "@/lib/auth";
import { getCookieFromHeader } from "@/lib/http/cookie-parse";

export { getCookieFromHeader };

/** Same semantics as `getAuthedUserId` in `@/lib/api/auth` (auth-token or admin-token). */
export function getAuthedMarketplaceUserIdFromCookieHeader(header: string | undefined): number | null {
  const token =
    getCookieFromHeader(header, "auth-token")?.trim() ||
    getCookieFromHeader(header, "admin-token")?.trim() ||
    "";
  if (!token) return null;
  const payload = verifyToken(token);
  return normalizeJwtUserId(payload?.userId);
}

/** Trust Records `/me` historically only reads `auth-token`. */
export function getTrustRecordsUserIdFromCookieHeader(header: string | undefined): number | null {
  const token = getCookieFromHeader(header, "auth-token")?.trim() || "";
  if (!token) return null;
  const payload = verifyToken(token);
  return normalizeJwtUserId(payload?.userId);
}
