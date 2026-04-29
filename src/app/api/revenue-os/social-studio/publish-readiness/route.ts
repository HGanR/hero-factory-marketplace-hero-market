import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { readEffectivePublishApprovalRequiredFromRequest } from "@/lib/social/effective-publish-approval-request";
import { resolveStudioPublishReadiness } from "@/lib/revenue-os/social-studio-unified-readiness";
import type { StudioPostMode } from "@/lib/revenue-os/social-studio-promote-readiness";

/**
 * GET /api/revenue-os/social-studio/publish-readiness
 * Preflight for Social Studio composer (same `resolveStudioPublishReadiness` as promote).
 *
 * Query: clientId, targetPlatform, postMode, socialAccountId?, scheduledAt?, hasHostedMedia?, assetCreativeType?
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = (searchParams.get("clientId") || "").trim();
  const targetPlatform = (searchParams.get("targetPlatform") || searchParams.get("platform") || "").trim();
  const postMode = (searchParams.get("postMode") || "draft") as StudioPostMode;
  const saId = (searchParams.get("socialAccountId") || "").trim() || null;
  const sched = (searchParams.get("scheduledAt") || "").trim();
  const hasHosted = searchParams.get("hasHostedMedia") === "1" || searchParams.get("hostPublishReady") === "1";
  const creative = (searchParams.get("assetCreativeType") || "IMAGE").trim() || "IMAGE";
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!targetPlatform) {
    return NextResponse.json({ error: "targetPlatform is required" }, { status: 400 });
  }
  if (!["draft", "schedule", "publish_now"].includes(postMode)) {
    return NextResponse.json({ error: "Invalid postMode" }, { status: 400 });
  }

  const requireApproval = readEffectivePublishApprovalRequiredFromRequest(req);
  const db = await getDb();
  const connectedAccRows = await db
    .select()
    .from(socialAccounts)
    .where(
      and(eq(socialAccounts.userId, String(userId)), eq(socialAccounts.clientId, String(clientId)))
    );

  let accountRow: (typeof socialAccounts.$inferSelect) | null = null;
  if (saId) {
    const a = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, saId))
      .limit(1);
    const row = a[0];
    if (row) {
      if (String(row.userId) !== String(userId) || String(row.clientId) !== String(clientId)) {
        return NextResponse.json({ error: "FORBIDDEN_ACCOUNT" }, { status: 403 });
      }
      accountRow = row;
    }
  }

  const scheduledAtIso = postMode === "schedule" && sched ? new Date(sched).toISOString() : null;
  if (postMode === "schedule" && sched && Number.isNaN(new Date(sched).getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
  }

  const studioReadiness = resolveStudioPublishReadiness({
    targetPlatform: targetPlatform.toLowerCase(),
    socialAccount: accountRow,
    postMode,
    scheduledAtIso,
    campaignAssetId: null,
    assetCreativeType: creative,
    hasHostedHttpsAssetUrl: hasHosted,
    treatAsHasStorageUrlForValidation: hasHosted,
    connectedAccountRows: connectedAccRows,
    governanceRequiresApproval: requireApproval,
  });

  return NextResponse.json({ studioReadiness });
}
