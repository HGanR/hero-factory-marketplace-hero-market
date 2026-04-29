/**
 * Browser/client fetch for deployment feedback API (signal enrichment + UI).
 */

import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import type { DeploymentFeedbackRollup } from "@/lib/revenue-os/deployment-feedback-summary";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { PlatformMetricSyncSupportState } from "@/lib/social/platform-performance-sync-contract";
import type { SocialPlatform } from "@/lib/social/config";

export type RevenueOsDeploymentFeedbackApiResponse = {
  rollup: DeploymentFeedbackRollup;
  signalsInput: DeploymentFeedbackSignalsInput;
  rowCount: number;
  metricEnrichedCount: number;
  performanceMetricsRowCount?: number;
  publishOnlyCount: number;
  latest: NormalizedDeploymentFeedback | null;
  latestMetricFeedback?: NormalizedDeploymentFeedback | null;
  platformSyncSupport?: Partial<Record<SocialPlatform, PlatformMetricSyncSupportState>>;
  metricSyncContext?: {
    liveMetricPlatforms: SocialPlatform[];
    stubPublishPlatforms: SocialPlatform[];
    capabilityNarrativeLines: string[];
    firstMetricAdapterTarget: SocialPlatform;
  };
  metricSyncDebug?: {
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
  };
  rows: NormalizedDeploymentFeedback[];
};

export async function fetchRevenueOsDeploymentFeedback(
  clientId: string | undefined,
  init?: RequestInit,
  opts?: { includeSyncDebug?: boolean }
): Promise<RevenueOsDeploymentFeedbackApiResponse | null> {
  const c = clientId?.trim() ?? "";
  const q = new URLSearchParams();
  if (c) q.set("clientId", c);
  if (opts?.includeSyncDebug) q.set("includeSyncDebug", "1");
  const qs = q.toString();
  const url = qs ? `/api/revenue-os/deployment-feedback?${qs}` : "/api/revenue-os/deployment-feedback";
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) return null;
  return (await res.json()) as RevenueOsDeploymentFeedbackApiResponse;
}
