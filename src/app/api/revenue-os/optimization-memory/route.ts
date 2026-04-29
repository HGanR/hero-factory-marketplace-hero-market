import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  getOptimizationMemoryStatsForUser,
  getOptimizationMemorySummaryForUser,
} from "@/lib/revenue-os/post-optimization-memory-db";
import { resolveOptimizationMemoryForGeneration } from "@/lib/revenue-os/resolve-optimization-memory-for-generation";
import { summarizePlatformEvidenceWeighting } from "@/lib/revenue-os/platform-evidence-weighting";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/revenue-os/optimization-memory?clientId=
 * Summary + bounded entries + whether unified generation would inject the memory block.
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
    const clientId = searchParams.get("clientId")?.trim() ?? "";
    const includeWeightingDebug = searchParams.get("includeWeightingDebug") === "1";

    const db = await getDb();
    const uid = String(userId);
    const scope = clientId || undefined;

    const [{ summary, entries }, stats, memSlice] = await Promise.all([
      getOptimizationMemorySummaryForUser(db, uid, { clientId: scope, limit: 48 }),
      getOptimizationMemoryStatsForUser(db, uid, { clientId: scope }),
      resolveOptimizationMemoryForGeneration(db, { userId, clientId: scope }),
    ]);

    const sw = includeWeightingDebug ? summarizePlatformEvidenceWeighting(null) : null;
    const weightingDebug = sw
      ? {
          platformWeights: sw.weights,
          live: sw.live,
          publishOnly: sw.publishOnly,
          entryConfidence: entries.slice(0, 16).map((e) => ({
            id: e.id,
            platform: e.platform,
            evidenceQuality: e.evidenceQuality,
            confidence: e.confidence,
          })),
          recommendationBasis: summary.recommendationEvidenceBasis,
          promptWeightingSummary: memSlice?.promptWeightingSummary,
          crossPlatformMemory: {
            measuredStrongestAttentionPlatform: summary.measuredStrongestAttentionPlatform ?? null,
            measuredStrongestEngagementPlatform: summary.measuredStrongestEngagementPlatform ?? null,
            crossPlatformComparisonConfidence: summary.crossPlatformComparisonConfidence ?? null,
            primaryPreferenceBasis:
              summary.measuredStrongestAttentionPlatform &&
              summary.measuredStrongestEngagementPlatform &&
              summary.measuredStrongestAttentionPlatform !== summary.measuredStrongestEngagementPlatform
                ? "mixed_attention_engagement"
                : summary.measuredStrongestAttentionPlatform
                  ? "attention"
                  : summary.measuredStrongestEngagementPlatform
                    ? "engagement"
                    : "none",
            measuredPlatformRoleHint: summary.measuredPlatformRoleHint ?? null,
            platformRoleRoutingHintInGeneration: memSlice?.platformRoleRoutingHint ?? null,
          },
        }
      : undefined;

    return NextResponse.json({
      summary,
      entries: entries.slice(0, 24),
      stats,
      generation: {
        hasEnoughData: memSlice?.hasEnoughData ?? false,
        promptWouldInject: Boolean(memSlice?.promptBlock?.trim()),
        injectedEntryIds: memSlice?.injectedEntryIds ?? [],
        promptWeightingSummary: memSlice?.promptWeightingSummary,
        instagramPreferenceHint: memSlice?.instagramPreferenceHint ?? null,
        measuredPlatformRoleHint: memSlice?.measuredPlatformRoleHint ?? null,
        platformRoleRoutingHint: memSlice?.platformRoleRoutingHint ?? null,
      },
      weightingDebug,
    });
  } catch (e) {
    console.error("[revenue-os/optimization-memory]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
