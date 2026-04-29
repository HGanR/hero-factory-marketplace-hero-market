import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4F — Recommendations, next actions, next-campaign brief (conversion + optional Bentley handoff).
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { loadBentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/loadBentleyContentBundleHandoff";
import { loadConversionAnalyticsForUser } from "@/lib/bentley-social-leads/loadConversionAnalyticsForUser";
import { buildConversionRecommendations } from "@/lib/bentley-social-leads/conversionRecommendations";
import { buildOperatorNextActions } from "@/lib/bentley-social-leads/operatorNextActions";
import { buildNextCampaignBrief } from "@/lib/bentley-social-leads/buildNextCampaignBrief";
import { toBentleyStructuredMarketIntelligence } from "@/lib/revenue-os/bentley-generation-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const source = url.searchParams.get("source")?.trim() || undefined;
  const platform = url.searchParams.get("platform")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const bentleyHandoffId = url.searchParams.get("bentleyHandoffId")?.trim() || "";

  const { summary, hints, rowCount } = await loadConversionAnalyticsForUser(userId, {
    from,
    to,
    source,
    platform,
    status,
  });

  let bentley = null as ReturnType<typeof toBentleyStructuredMarketIntelligence> | null;
  if (bentleyHandoffId) {
    const handoff = await loadBentleyContentBundleHandoff({ userId, handoffId: bentleyHandoffId });
    if (handoff) bentley = toBentleyStructuredMarketIntelligence(handoff);
  }

  const { topPerforming, recommendations } = buildConversionRecommendations(summary, bentley);
  const operatorNextActions = buildOperatorNextActions(summary, hints, {
    newLeadCount: summary.newCount,
  });
  const nextCampaignBrief = buildNextCampaignBrief({
    summary,
    topPerforming,
    recommendations,
    bentley,
  });

  return NextResponse.json({
    summary,
    hints,
    rowCount,
    topPerforming,
    recommendations,
    operatorNextActions,
    nextCampaignBrief,
    bentleyMarketIntelligence: bentley,
  });
}
