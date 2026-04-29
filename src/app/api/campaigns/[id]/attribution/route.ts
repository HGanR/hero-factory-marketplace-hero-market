import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { resolveClientIdForCampaignOrReject } from "@/lib/revenue-os/validate-campaign-client-id";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const Body = z
  .object({
    clientId: z.union([z.string().uuid(), z.null(), z.literal("")]),
  })
  .strict();

/**
 * PATCH /api/campaigns/:id/attribution
 * Sets `campaigns.clientId` when the user owns the campaign and (if non-empty) owns the target client.
 */
export async function PATCH(
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
    const body = await req.json();
    const parsed = Body.parse(body);
    const raw = parsed.clientId === null || parsed.clientId === "" ? "" : parsed.clientId;
    const resolved = await resolveClientIdForCampaignOrReject(userId, raw);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, id);
    if (!access) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());
    if (access.reviewerRole !== "owner" && !adminSession) {
      return NextResponse.json({ error: "Only the campaign owner can set client attribution" }, { status: 403 });
    }
    if (String(access.campaign.userId).trim() !== String(userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(campaigns)
      .set({ clientId: resolved.clientId || "", updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, String(userId))));

    return NextResponse.json({ ok: true, clientId: resolved.clientId || "" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: e.flatten() }, { status: 400 });
    }
    console.error("[campaigns/attribution PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
