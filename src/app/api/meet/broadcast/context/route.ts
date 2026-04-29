import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { maskEmailForBroadcast, maskWalletForBroadcast } from "@/lib/meet/broadcast-identity";

/** Never cache: identity + rules must match the current session cookie. */
export const dynamic = "force-dynamic";

/**
 * GET /api/meet/broadcast/context
 * Authoritative, cheap read: JWT cookie → marketplace_users row (email + wallet only).
 * Does not accept client wallet in the query; the UI shows the meeting wallet separately for comparison.
 */
export async function GET() {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = await getDb();
    const rows = await db
      .select({
        email: marketplaceUsers.email,
        walletAddress: marketplaceUsers.walletAddress,
      })
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { code: BROADCAST_CODES.userNotFound, error: "User not found" },
        { status: 403 }
      );
    }

    const linked = (row.walletAddress ?? "").trim();
    const hostRule = linked ? "wallet_must_match" : "sign_in_only";

    return NextResponse.json({
      code: BROADCAST_CODES.ok,
      userId,
      identityEmailMasked: maskEmailForBroadcast(row.email),
      linkedWalletMasked: linked ? maskWalletForBroadcast(linked) : null,
      hostRule,
      hostRuleDetail:
        hostRule === "wallet_must_match"
          ? "Your Troo account has a linked wallet. The wallet connected in the meeting must be the same address, or broadcast APIs return broadcast_host_mismatch."
          : "Broadcast uses your Troo sign-in only (no linked wallet on file).",
    });
  } catch (e) {
    console.error("[meet/broadcast/context]", e);
    return NextResponse.json({ error: "Context unavailable" }, { status: 503 });
  }
}
