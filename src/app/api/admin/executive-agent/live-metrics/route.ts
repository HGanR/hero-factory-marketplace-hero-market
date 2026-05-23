import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildLiveMetricsResponse, type LiveMetricsDbSnapshot } from "@/lib/executive-agent/executive-live-metrics";
import * as Tools from "@/lib/executive-agent/executive-agent-tools";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const ctx: Tools.ExecutiveToolContext = {
      db,
      adminUserId,
      selectedClientId: null,
      selectedCampaignId: null,
    };
    const [pending, approved, active, platform, inbox] = await Promise.all([
      Tools.getPendingAccounts(ctx),
      Tools.getApprovedAccounts(ctx),
      Tools.getActiveAccounts(ctx),
      Tools.getPlatformAnalyticsSummary(ctx),
      Tools.getInboxEngagementSummary(ctx),
    ]);
    const snap: LiveMetricsDbSnapshot = {
      pendingAllTime: pending.pendingAllTime ?? null,
      pendingApprox30d: pending.pendingApprox30d ?? null,
      approvedActive: approved.approvedActive ?? null,
      approvedInactive: approved.approvedInactive ?? null,
      activeUsers: active.activeUsers ?? null,
      marketplaceUsers: platform.marketplaceUsers ?? null,
      crmClients: platform.crmClients ?? null,
      socialCampaigns: platform.socialCampaigns ?? null,
      threadsLast7d: inbox.threadsLast7d ?? null,
      inboxUnavailable: Boolean((inbox as { unavailable?: boolean }).unavailable),
      inboxMessage: typeof (inbox as { message?: string }).message === "string" ? (inbox as { message: string }).message : undefined,
      siteTraffic: (platform as { siteTraffic?: LiveMetricsDbSnapshot["siteTraffic"] }).siteTraffic ?? null,
      approvedUserActivity:
        (platform as { approvedUserActivity?: LiveMetricsDbSnapshot["approvedUserActivity"] }).approvedUserActivity ??
        null,
    };
    return NextResponse.json(buildLiveMetricsResponse(snap));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LIVE_METRICS_FAILED", message: msg }, { status: 500 });
  }
}
