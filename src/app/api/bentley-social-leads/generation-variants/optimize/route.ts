import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4I — Winner / runner-up / underperformers + scaling recommendations for one experiment group.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyGenerationVariants } from "@/lib/db/schema.bentley-social-leads";
import { extractScalingSignals } from "@/lib/generation-memory/extractScalingSignals";
import { buildVariantOptimization } from "@/lib/generation-memory/variantOptimization";
import { getVariantRollupsForExperimentGroup } from "@/lib/generation-memory/variantRollupsQuery";

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
  const experimentGroupId = url.searchParams.get("experimentGroupId")?.trim();
  if (!experimentGroupId) {
    return NextResponse.json({ error: "experimentGroupId is required" }, { status: 400 });
  }

  const rollups = await getVariantRollupsForExperimentGroup(userId, experimentGroupId);
  if (rollups.length === 0) {
    return NextResponse.json({ experimentGroupId, optimization: null, error: "No variants in group" }, { status: 404 });
  }

  const db = await getDb();
  const variantRows = await db
    .select()
    .from(bentleyGenerationVariants)
    .where(
      and(
        eq(bentleyGenerationVariants.userId, userId),
        eq(bentleyGenerationVariants.experimentGroupId, experimentGroupId)
      )
    );

  const byId = new Map(variantRows.map((r) => [r.id, r]));
  const base = buildVariantOptimization(rollups);
  const winnerId = base.winner?.variantId;
  const worstId = base.ranked[base.ranked.length - 1]?.variantId;

  const winRow = winnerId ? byId.get(winnerId) : null;
  const loseRow = worstId && worstId !== winnerId ? byId.get(worstId) : null;

  const winSig = winRow
    ? extractScalingSignals(
        winRow.unifiedContextSnapshotJson as Record<string, unknown>,
        winRow.generatedOutputJson as Record<string, unknown>
      )
    : { painThemes: [], ctaAngles: [], offerAngles: [] };
  const loseSig = loseRow
    ? extractScalingSignals(
        loseRow.unifiedContextSnapshotJson as Record<string, unknown>,
        loseRow.generatedOutputJson as Record<string, unknown>
      )
    : { painThemes: [], ctaAngles: [], offerAngles: [] };

  const optimization = buildVariantOptimization(rollups, undefined, {
    winnerPainThemes: winSig.painThemes,
    winnerCtaAngles: winSig.ctaAngles,
    winnerOfferAngles: winSig.offerAngles,
    loserPainThemes: loseSig.painThemes,
    loserCtaAngles: loseSig.ctaAngles,
  });

  return NextResponse.json({
    experimentGroupId,
    optimization,
    scalingSignals: {
      winnerVariantId: winnerId ?? null,
      loserVariantId: worstId ?? null,
      winner: winSig,
      contrast: loseRow ? loseSig : null,
    },
  });
}
