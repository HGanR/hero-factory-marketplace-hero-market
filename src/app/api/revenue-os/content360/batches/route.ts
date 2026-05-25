import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { providerPublishBatches } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { toPublicProviderPublishBatch } from "@/lib/revenue-os/content360-public";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

/**
 * GET /api/revenue-os/content360/batches?clientId=&campaignId=
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const owned = await requireOwnedClientId(userId, clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();

  const conds = [eq(providerPublishBatches.clientId, owned.clientId), eq(providerPublishBatches.provider, CONTENT360_PROVIDER_ID)];
  const campaignId = req.nextUrl.searchParams.get("campaignId")?.trim();
  if (campaignId) {
    conds.push(eq(providerPublishBatches.campaignId, campaignId));
  }

  const rows = await db
    .select()
    .from(providerPublishBatches)
    .where(and(...conds))
    .orderBy(desc(providerPublishBatches.createdAt))
    .limit(50);

  return NextResponse.json({
    batches: rows.map(toPublicProviderPublishBatch),
  });
}
