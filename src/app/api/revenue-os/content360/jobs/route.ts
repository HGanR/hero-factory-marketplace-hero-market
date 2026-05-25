import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { providerPublishJobs } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { toPublicProviderPublishJob } from "@/lib/revenue-os/content360-public";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * GET /api/revenue-os/content360/jobs?clientId=&campaignId=&status=
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

  const conds = [
    eq(providerPublishJobs.clientId, owned.clientId),
    eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
  ];
  const campaignId = req.nextUrl.searchParams.get("campaignId")?.trim();
  if (campaignId) {
    conds.push(eq(providerPublishJobs.campaignId, campaignId));
  }
  const status = req.nextUrl.searchParams.get("status")?.trim();
  if (status) {
    conds.push(eq(providerPublishJobs.status, status));
  }
  const batchId = req.nextUrl.searchParams.get("batchId")?.trim();
  if (batchId) {
    conds.push(eq(providerPublishJobs.batchId, batchId));
  }

  const rows = await db
    .select()
    .from(providerPublishJobs)
    .where(and(...conds))
    .orderBy(desc(providerPublishJobs.createdAt))
    .limit(100);

  return NextResponse.json({
    jobs: rows.map(toPublicProviderPublishJob),
  });
}
