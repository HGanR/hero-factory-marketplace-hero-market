import { marketplaceUserIdFromSessionCookiePair } from "@/lib/auth";
import { getCookieFromHeader } from "@/lib/http/cookie-parse";

export { getCookieFromHeader };

/** Same semantics as `getAuthedUserId` in `@/lib/api/auth` (admin-token when platform admin, else auth-token). */
export function getAuthedMarketplaceUserIdFromCookieHeader(header: string | undefined): number | null {
  return marketplaceUserIdFromSessionCookiePair(
    getCookieFromHeader(header, "auth-token")?.trim() ?? "",
    getCookieFromHeader(header, "admin-token")?.trim() ?? "",
  );
}

/** Trust Records `/me` historically only reads `auth-token`. */
export function getTrustRecordsUserIdFromCookieHeader(header: string | undefined): number | null {
  const token = getCookieFromHeader(header, "auth-token")?.trim() || "";
  if (!token) return null;
  const payload = verifyToken(token);
  return marketplaceUserIdFromJwtPayload(payload);
}
