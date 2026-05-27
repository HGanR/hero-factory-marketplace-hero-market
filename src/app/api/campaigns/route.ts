import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureCampaignSchemaColumns } from "@/lib/db/campaigns-ensure";
import { campaignReviewerAssignments, campaigns } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import {
  mapMergedCampaignToListApiItem,
  mergeOwnedAndAssignedCampaignRows,
} from "@/lib/revenue-os/list-accessible-campaigns";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";
import { resolveClientIdForCampaignOrReject } from "@/lib/revenue-os/validate-campaign-client-id";
const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().optional(),
  clientId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateSchema.parse(body);
    const resolved = await resolveClientIdForCampaignOrReject(userId, parsed.clientId);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const clientId = resolved.clientId;

    const id = crypto.randomUUID();
    await ensureCampaignSchemaColumns();
    const db = await getDb();
    await db.insert(campaigns).values({
      id,
      userId: String(userId),
      clientId,
      name: parsed.name,
      objective: parsed.objective?.trim() || null,
      status: "DRAFT",
    });

    if (clientId) {
      await recordClientHubAutomationEvent(userId, clientId, "campaign_created", {
        refId: id,
        metadata: { name: parsed.name, source: "api_post_campaigns" },
      });
    }

    return NextResponse.json({ id, status: "DRAFT" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[campaigns]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Lists campaigns the user may access:
 * - owned (`campaigns.userId`)
 * - assigned (`campaign_reviewer_assignments` join), deduped when both
 *
 * `clientId` query param:
 * - **Omitted** — no client filter (all accessible rows).
 * - **Present** (including empty `?clientId=`) — restrict to that `campaigns.clientId` for both branches.
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
    const clientIdParamPresent = searchParams.has("clientId");
    const clientIdFilter = clientIdParamPresent ? (searchParams.get("clientId") ?? "").trim() : null;
    const status = searchParams.get("status")?.trim();

    await ensureCampaignSchemaColumns();
    const db = await getDb();
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

    const ownedConditions = [eq(campaigns.userId, String(userId))];
    if (clientIdFilter !== null) ownedConditions.push(eq(campaigns.clientId, clientIdFilter));
    if (status) ownedConditions.push(eq(campaigns.status, status));

    const ownedRows = await db
      .select()
      .from(campaigns)
      .where(and(...ownedConditions))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    const assignedConditions = [eq(campaignReviewerAssignments.userId, String(userId))];
    if (clientIdFilter !== null) assignedConditions.push(eq(campaigns.clientId, clientIdFilter));
    if (status) assignedConditions.push(eq(campaigns.status, status));

    const assignedJoined = await db
      .select({
        campaign: campaigns,
        assignmentRole: campaignReviewerAssignments.role,
      })
      .from(campaignReviewerAssignments)
      .innerJoin(campaigns, eq(campaignReviewerAssignments.campaignId, campaigns.id))
      .where(and(...assignedConditions))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    const merged = mergeOwnedAndAssignedCampaignRows({
      ownedRows,
      assignedRows: assignedJoined.map((j) => ({
        campaign: j.campaign,
        assignmentRole: j.assignmentRole,
      })),
    }).slice(0, 50);

    return NextResponse.json({
      campaigns: merged.map((m) => mapMergedCampaignToListApiItem(m, { adminSession })),
    });
  } catch (e) {
    console.error("[campaigns]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
