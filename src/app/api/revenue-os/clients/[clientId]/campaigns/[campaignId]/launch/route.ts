import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";
import { getCampaignForOwnedClient } from "@/lib/revenue-os/client-hub-campaign-scope";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

type Ctx = { params: Promise<{ clientId: string; campaignId: string }> };

const TERMINAL = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"]);

/**
 * POST — Mark campaign as LIVE (owner) when the campaign is owned and attributed to this client.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  void req;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { clientId, campaignId } = await ctx.params;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }

    const row = await getCampaignForOwnedClient(userId, clientId, campaignId, true);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access || access.reviewerRole !== "owner") {
      return NextResponse.json({ error: "Only the campaign owner can launch" }, { status: 403 });
    }

    const st = String(row.status);
    if (st === "LIVE") {
      return NextResponse.json({ ok: true, state: "already" as const, status: row.status });
    }
    if (TERMINAL.has(st.toUpperCase())) {
      return NextResponse.json(
        { error: "Cannot launch a completed or cancelled campaign", status: row.status },
        { status: 409 }
      );
    }

    await db
      .update(campaigns)
      .set({ status: "LIVE", updatedAt: new Date() })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, String(userId))));

    await recordClientHubAutomationEvent(userId, clientId, "campaign_launched", {
      refId: campaignId,
      metadata: { name: row.name },
    });

    return NextResponse.json({ ok: true, state: "launched" as const, status: "LIVE" });
  } catch (e) {
    console.error("POST client campaign launch", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
