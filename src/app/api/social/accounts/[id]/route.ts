import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialAccounts, campaignAuditEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * DELETE /api/social/accounts/:id
 * Disconnect a social account.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.id, id), eq(socialAccounts.userId, String(userId))))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await db.delete(socialAccounts).where(eq(socialAccounts.id, id));

    await db.insert(campaignAuditEvents).values({
      id: crypto.randomUUID(),
      userId: String(userId),
      action: "disconnect",
      platform: rows[0].platform,
      details: { accountId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[social/accounts/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
