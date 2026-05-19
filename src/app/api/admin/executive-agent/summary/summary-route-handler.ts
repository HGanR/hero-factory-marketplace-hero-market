import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "@/lib/db/schema";

export function shouldIncludeFullPendingMarketplaceUsers(searchParams: URLSearchParams): boolean {
  return searchParams.get("includePendingMarketplaceUsers")?.trim().toLowerCase() === "full";
}

export type ExecutiveAgentSummaryToolContext = {
  db: MySql2Database<typeof schema>;
  adminUserId: number;
  selectedClientId?: string | null;
  selectedCampaignId?: string | null;
};

export type ExecutiveAgentSummaryTools = {
  getPendingAccounts: (ctx: ExecutiveAgentSummaryToolContext) => Promise<unknown>;
  getApprovedAccounts: (ctx: ExecutiveAgentSummaryToolContext) => Promise<unknown>;
  getPlatformAnalyticsSummary: (ctx: ExecutiveAgentSummaryToolContext) => Promise<unknown>;
  getInboxEngagementSummary: (ctx: ExecutiveAgentSummaryToolContext) => Promise<unknown>;
  getBentleyExecutiveBridgeSummary: (ctx: ExecutiveAgentSummaryToolContext) => Promise<unknown>;
  getPendingMarketplaceUsersPreview: (
    ctx: ExecutiveAgentSummaryToolContext,
    limit?: number,
    options?: { includeFullPii?: boolean },
  ) => Promise<unknown>;
};

export type ExecutiveAgentSummaryGetDeps = {
  getExecutiveAdminUserId: (req: NextRequest) => Promise<number | null>;
  getDb: () => Promise<ExecutiveAgentSummaryToolContext["db"]>;
  tools?: ExecutiveAgentSummaryTools;
};

export async function handleExecutiveAgentSummaryGet(
  req: NextRequest,
  deps: ExecutiveAgentSummaryGetDeps,
): Promise<NextResponse> {
  const adminUserId = await deps.getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tools =
    deps.tools ??
    (await import("@/lib/executive-agent/executive-agent-tools")) as ExecutiveAgentSummaryTools;
  try {
    const db = await deps.getDb();
    const clientId = req.nextUrl.searchParams.get("clientId")?.trim() || null;
    const includeFullPii = shouldIncludeFullPendingMarketplaceUsers(req.nextUrl.searchParams);
    const ctx: ExecutiveAgentSummaryToolContext = {
      db,
      adminUserId,
      selectedClientId: clientId,
      selectedCampaignId: null,
    };
    const [pending, approved, platform, inbox, bentleyBridge, pendingPreview] = await Promise.all([
      tools.getPendingAccounts(ctx),
      tools.getApprovedAccounts(ctx),
      tools.getPlatformAnalyticsSummary(ctx),
      tools.getInboxEngagementSummary(ctx),
      tools.getBentleyExecutiveBridgeSummary(ctx),
      tools.getPendingMarketplaceUsersPreview(ctx, 30, { includeFullPii }),
    ]);
    return NextResponse.json({
      pendingAccounts: pending,
      pendingMarketplaceUsers: pendingPreview,
      approvedAccounts: approved,
      platform,
      inbox,
      bentleyBridge,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "SUMMARY_FAILED", message: msg }, { status: 500 });
  }
}
