import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  countPostedCampaignPostsRemoteIdStatsForUser,
  getDeploymentFeedbackSummaryForUser,
  getLatestPerformanceMetricRowForUser,
} from "@/lib/revenue-os/deployment-feedback-db";
import { feedbackRowKind } from "@/lib/revenue-os/deployment-feedback-summary";
import { buildPlatformMetricSyncSupportMap } from "@/lib/social/platform-performance-adapters";
import {
  buildMetricSyncCapabilitySummary,
  getMetricSyncAdapterDebugLabel,
  listAllPlatformPerformanceCapabilities,
} from "@/lib/social/platform-performance-adapter-capabilities";
import type { SocialPlatform } from "@/lib/social/config";
import { summarizePlatformEvidenceWeighting } from "@/lib/revenue-os/platform-evidence-weighting";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/revenue-os/deployment-feedback?clientId=&limit=
 * Normalized feedback + rollup for UI, Bentley, and signal enrichment.
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
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const includeSyncDebug = searchParams.get("includeSyncDebug") === "1";

    const db = await getDb();
    const summary = await getDeploymentFeedbackSummaryForUser(db, String(userId), {
      clientId: clientId || undefined,
      limit,
    });

    const metricEnriched = summary.normalized.filter(
      (n) =>
        feedbackRowKind(n) === "performance_metrics" ||
        n.impressions != null ||
        n.clicks != null ||
        n.engagement != null ||
        n.comments != null ||
        n.shares != null ||
        n.saves != null ||
        n.leads != null
    ).length;

    const performanceMetricsRowCount = summary.normalized.filter(
      (n) => feedbackRowKind(n) === "performance_metrics"
    ).length;

    const latestMetricFeedback = await getLatestPerformanceMetricRowForUser(db, String(userId), {
      clientId: clientId || undefined,
    });

    const caps = listAllPlatformPerformanceCapabilities();
    const liveMetricPlatforms = caps.filter((c) => c.metricSyncImplementation === "live").map((c) => c.platform);
    const stubPublishPlatforms = caps
      .filter((c) => c.supportsPublish && c.metricSyncImplementation === "stub")
      .map((c) => c.platform);
    const capNarr = buildMetricSyncCapabilitySummary();

    let metricSyncDebug: {
      adapterImplementationByPlatform: Record<SocialPlatform, "real" | "stub" | "none">;
      remoteIdStats: { posted: number; withRemoteId: number };
      authConstraintsByPlatform: Partial<Record<SocialPlatform, string[]>>;
      evidenceWeightsByPlatform: Record<string, number>;
      rollupMeasuredVsPublished: {
        bestMeasuredPlatform?: string;
        bestPublishedPlatform?: string;
      };
      latestMetricSnapshot: {
        platform: string;
        sourcePlatform: string | null;
        syncedAt: string | null;
        campaignPostId: string;
      } | null;
    } | undefined;

    if (includeSyncDebug) {
      const remoteIdStats = await countPostedCampaignPostsRemoteIdStatsForUser(db, String(userId), {
        clientId: clientId || undefined,
      });
      const adapterImplementationByPlatform = {} as Record<SocialPlatform, "real" | "stub" | "none">;
      const authConstraintsByPlatform: Partial<Record<SocialPlatform, string[]>> = {};
      for (const c of caps) {
        adapterImplementationByPlatform[c.platform] = getMetricSyncAdapterDebugLabel(c.platform);
        authConstraintsByPlatform[c.platform] = c.authConstraints;
      }
      const lm = latestMetricFeedback;
      const ew = summarizePlatformEvidenceWeighting({
        liveMetricPlatforms,
        stubPublishPlatforms,
      });
      metricSyncDebug = {
        adapterImplementationByPlatform,
        remoteIdStats,
        authConstraintsByPlatform,
        evidenceWeightsByPlatform: ew.weights,
        rollupMeasuredVsPublished: {
          bestMeasuredPlatform: summary.rollup.bestMeasuredPlatform,
          bestPublishedPlatform: summary.rollup.bestPublishedPlatform,
        },
        latestMetricSnapshot: lm
          ? {
              platform: lm.platform,
              sourcePlatform: lm.sourcePlatform ?? lm.platform,
              syncedAt: lm.syncedAt ?? null,
              campaignPostId: lm.campaignPostId,
            }
          : null,
      };
    }

    return NextResponse.json({
      rollup: summary.rollup,
      signalsInput: summary.signalsInput,
      rowCount: summary.normalized.length,
      metricEnrichedCount: metricEnriched,
      performanceMetricsRowCount,
      publishOnlyCount: summary.normalized.length - metricEnriched,
      latest: summary.normalized[0] ?? null,
      latestMetricFeedback,
      platformSyncSupport: buildPlatformMetricSyncSupportMap(),
      metricSyncContext: {
        liveMetricPlatforms,
        stubPublishPlatforms,
        capabilityNarrativeLines: capNarr.narrativeLines,
        firstMetricAdapterTarget: capNarr.firstImplementationTarget,
      },
      metricSyncDebug,
      rows: summary.normalized.slice(0, 40),
    });
  } catch (e) {
    console.error("[revenue-os/deployment-feedback]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
