import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4J — Posting frequency + platform focus from conversion analytics + recent deploy volume.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyContentDeployments } from "@/lib/db/schema.bentley-social-leads";
import { loadConversionAnalyticsForUser } from "@/lib/bentley-social-leads/loadConversionAnalyticsForUser";
import { buildVolumeRecommendations } from "@/lib/distribution/volumeRecommendations";

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
  const platformHint = url.searchParams.get("platformHint")?.trim() || null;

  const { summary, rowCount } = await loadConversionAnalyticsForUser(userId, {});
  const bookedRate = summary.total > 0 ? summary.booked / summary.total : 0;
  const closeRate = summary.total > 0 ? summary.closed / summary.total : 0;

  const db = await getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPosted = await db
    .select({ id: bentleyContentDeployments.id })
    .from(bentleyContentDeployments)
    .where(
      and(
        eq(bentleyContentDeployments.userId, userId),
        eq(bentleyContentDeployments.status, "posted"),
        isNotNull(bentleyContentDeployments.postedAt),
        gte(bentleyContentDeployments.postedAt, since)
      )
    )
    .limit(500);

  const lastDeploy = await db
    .select({ platform: bentleyContentDeployments.platform })
    .from(bentleyContentDeployments)
    .where(eq(bentleyContentDeployments.userId, userId))
    .orderBy(desc(bentleyContentDeployments.updatedAt))
    .limit(1);

  const hint = platformHint || lastDeploy[0]?.platform || null;

  const rec = buildVolumeRecommendations({
    bookedRate,
    closeRate,
    trackedLeadCount: rowCount,
    postedDeploymentsLast30d: recentPosted.length,
    winningPlatformHint: hint,
  });

  return NextResponse.json({
    conversion: {
      total: summary.total,
      bookedRate,
      closeRate,
      trackedLeadCount: rowCount,
    },
    activity: {
      postedDeploymentsLast30d: recentPosted.length,
    },
    recommendation: rec,
  });
}
