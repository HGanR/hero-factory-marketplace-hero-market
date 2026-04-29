import { verifyToken, normalizeJwtUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type RevenueOsSessionVerdict = "allow" | "deny" | "no_session";

/**
 * Shared product-access evaluation for Revenue OS (pages + APIs).
 * - Admin session (admin-token or auth-token with isAdmin): allow
 * - No usable marketplace session: no_session
 * - Logged-in marketplace user with revenueOsAccess === false, or missing user row: deny
 */
export async function evaluateRevenueOsSession(
  getCookie: (name: string) => string | undefined
): Promise<RevenueOsSessionVerdict> {
  const adminTok = getCookie("admin-token");
  if (adminTok) {
    const adminDecoded = verifyToken(adminTok);
    if (adminDecoded?.isAdmin) return "allow";
  }

  const authTok = getCookie("auth-token");
  if (!authTok) return "no_session";

  const decoded = verifyToken(authTok);
  if (decoded?.isAdmin) return "allow";

  const uid = normalizeJwtUserId(decoded?.userId);
  if (uid == null) return "no_session";

  const db = await getDb();
  const rows = await db
    .select({ revenueOsAccess: marketplaceUsers.revenueOsAccess })
    .from(marketplaceUsers)
    .where(eq(marketplaceUsers.id, uid))
    .limit(1);

  if (!rows[0] || rows[0].revenueOsAccess === false) return "deny";
  return "allow";
}
