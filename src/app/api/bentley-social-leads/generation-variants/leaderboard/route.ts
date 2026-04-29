import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4I — Top experiment groups by winning variant score (bounded work per request).
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyGenerationVariants } from "@/lib/db/schema.bentley-social-leads";
import { buildVariantOptimization } from "@/lib/generation-memory/variantOptimization";
import { getVariantRollupsForExperimentGroup } from "@/lib/generation-memory/variantRollupsQuery";

export const runtime = "nodejs";

const MAX_GROUPS = 20;

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
  const limit = Math.min(MAX_GROUPS, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10) || 10));

  const db = await getDb();
  const recent = await db
    .select({ experimentGroupId: bentleyGenerationVariants.experimentGroupId })
    .from(bentleyGenerationVariants)
    .where(eq(bentleyGenerationVariants.userId, userId))
    .orderBy(desc(bentleyGenerationVariants.createdAt))
    .limit(400);

  const seen = new Set<string>();
  const groupIds: string[] = [];
  for (const r of recent) {
    if (seen.has(r.experimentGroupId)) continue;
    seen.add(r.experimentGroupId);
    groupIds.push(r.experimentGroupId);
    if (groupIds.length >= MAX_GROUPS) break;
  }

  const entries: Array<{
    experimentGroupId: string;
    variantCount: number;
    winner: ReturnType<typeof buildVariantOptimization>["winner"];
    runnerUp: ReturnType<typeof buildVariantOptimization>["runnerUp"];
    insufficientSample: boolean;
    topScore: number;
  }> = [];

  for (const gid of groupIds) {
    const rollups = await getVariantRollupsForExperimentGroup(userId, gid);
    if (rollups.length === 0) continue;
    const opt = buildVariantOptimization(rollups);
    const variantCount = rollups.length;
    const topScore = opt.winner?.score ?? opt.ranked[0]?.score ?? 0;
    entries.push({
      experimentGroupId: gid,
      variantCount,
      winner: opt.winner,
      runnerUp: opt.runnerUp,
      insufficientSample: opt.insufficientSample,
      topScore,
    });
  }

  entries.sort((a, b) => b.topScore - a.topScore);
  const top = entries.slice(0, limit);

  return NextResponse.json({ leaderboard: top });
}
