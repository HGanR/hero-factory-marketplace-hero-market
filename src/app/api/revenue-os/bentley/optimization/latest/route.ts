import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { bentleyOptimizationRuns } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";

const QuerySchema = z.object({
  campaignId: z.string().uuid(),
});

/**
 * GET /api/revenue-os/bentley/optimization/latest?campaignId=
 * Latest optimization run for operator UI / lineage.
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
    const parsed = QuerySchema.parse({
      campaignId: searchParams.get("campaignId")?.trim(),
    });

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(bentleyOptimizationRuns)
      .where(eq(bentleyOptimizationRuns.campaignId, parsed.campaignId))
      .orderBy(desc(bentleyOptimizationRuns.createdAt))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: true, run: null });
    }

    return NextResponse.json({
      ok: true,
      run: {
        id: row.id,
        campaignId: row.campaignId,
        childCampaignId: row.childCampaignId,
        executionMode: row.executionMode,
        createdAt: row.createdAt,
        result: row.resultJson,
        optimizationKey: row.optimizationKey,
        executionTrace: row.executionTraceJson,
        comparison: row.comparisonJson,
        improvementScore: row.improvementScore,
        winningVariant: row.winningVariant,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: e.flatten() }, { status: 400 });
    }
    console.warn("[revenue-os/bentley/optimization/latest]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
