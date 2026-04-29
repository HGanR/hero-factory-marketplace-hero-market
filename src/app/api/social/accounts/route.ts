import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { mapSocialAccountRowToPublicApi } from "@/lib/social/social-account-public";
import { eq, and } from "drizzle-orm";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/social/accounts?clientId=...
 * List connected social accounts (no tokens returned).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim() || "";

    const db = await getDb();
    const rows = await db
      .select({
        id: socialAccounts.id,
        platform: socialAccounts.platform,
        displayName: socialAccounts.displayName,
        externalAccountId: socialAccounts.externalAccountId,
        expiresAt: socialAccounts.expiresAt,
        createdAt: socialAccounts.createdAt,
      })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, String(userId)),
          eq(socialAccounts.clientId, clientId)
        )
      );

    const accounts = rows.map((r) => {
      const base = mapSocialAccountRowToPublicApi({
        id: r.id,
        platform: r.platform,
        displayName: r.displayName,
        externalAccountId: r.externalAccountId,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      });
      const exp = r.expiresAt ? new Date(r.expiresAt as Date) : null;
      const expired = exp != null && !Number.isNaN(exp.getTime()) && exp.getTime() < Date.now();
      return {
        ...base,
        provider: base.platform,
        providerAccountId: base.externalAccountId,
        status: expired ? "expired" : "connected",
        tokenExpiresAt: base.expiresAt,
        connectedAt: base.createdAt,
      };
    });

    return NextResponse.json({ accounts });
  } catch (e) {
    console.error("[social/accounts]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
