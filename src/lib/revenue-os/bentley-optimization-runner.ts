/**
 * Gather real metrics, diagnose, persist, optionally create child campaign,
 * optionally sync variant posts (controlled relaunch) and persist comparison.
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { buildCampaignGovernedSocialAnalyticsAggregate } from "@/lib/social/governed-post-analytics-aggregate";
import { computePublishApprovalAnalytics } from "@/lib/revenue-os/publish-approval-analytics";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import {
  runBentleyOptimizationDiagnosis,
  metricsFingerprintFromSummary,
  type BentleyOptimizationResult,
} from "@/lib/revenue-os/bentley-optimization";
import {
  evaluateBentleyOptimizationAutoExecuteGates,
  isBentleyOptimizationAutoExecuteEnvEnabled,
} from "@/lib/revenue-os/bentley-optimization-auto-execute";
import {
  buildBentleyOptimizationComparison,
  persistBentleyOptimizationComparison,
} from "@/lib/revenue-os/bentley-optimization-compare";
import { countCampaignOptimizationLineageDepth, readMaxOptimizationLineageDepthEnv } from "@/lib/revenue-os/bentley-optimization-lineage";
import { loadBentleyOptimizationPriorHints } from "@/lib/revenue-os/bentley-optimization-prior-runs";
import {
  computeBentleyOptimizationKey,
  persistBentleyOptimizationRun,
  updateBentleyOptimizationRunExecutionTrace,
  type BentleyOptimizationExecutionMode,
} from "@/lib/revenue-os/bentley-optimization-persist";
import { buildBentleyOptimizationVariantDraft } from "@/lib/revenue-os/bentley-optimization-variants";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";
import type { BentleyGenerationPayload } from "@/lib/revenue-os/ensure-campaign-from-bentley";

export type BentleyOptimizationRunnerOptions = {
  mode: BentleyOptimizationExecutionMode;
  /** Allow creating child campaign when confidence is low (dangerous — ops only). */
  forceVariant?: boolean;
  bentleyRunId?: string | null;
};

export type BentleyOptimizationExecutionTrace = {
  autoExecuteEnv: boolean;
  autoExecuteEvaluated: boolean;
  gates: { allowed: boolean; reasons: string[] };
  syncAttempted: boolean;
  postCreationMode?: "scheduled" | "draft_unscheduled";
  sync?: {
    created: number;
    skipped: number;
    rescheduled: number;
    postIds: string[];
    requireApproval: boolean;
  };
  syncError?: string;
  comparisonPersisted?: boolean;
};

export type BentleyOptimizationRunnerResult = {
  result: BentleyOptimizationResult;
  runId: string | null;
  childCampaignId: string | null;
  duplicate: boolean;
  optimizationKey: string;
  execution: BentleyOptimizationExecutionTrace;
};

function parseGeneration(raw: unknown): BentleyGenerationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.campaign || typeof o.campaign !== "object") return null;
  return raw as BentleyGenerationPayload;
}

export async function runBentleyOptimizationAction(
  db: MySql2Database<typeof schema>,
  args: {
    userId: string;
    clientId: string;
    campaignId: string;
  },
  opts: BentleyOptimizationRunnerOptions
): Promise<BentleyOptimizationRunnerResult> {
  const { campaignId, userId, clientId } = args;
  const aggregate = await buildCampaignGovernedSocialAnalyticsAggregate(db, campaignId);

  const postRows = await db
    .select({
      id: schema.campaignPosts.id,
      status: schema.campaignPosts.status,
      utmParams: schema.campaignPosts.utmParams,
    })
    .from(schema.campaignPosts)
    .where(eq(schema.campaignPosts.campaignId, campaignId));

  let failed = 0;
  let posted = 0;
  let scheduledOrDraft = 0;
  for (const p of postRows) {
    const st = String(p.status ?? "").toUpperCase();
    if (st === "FAILED") failed += 1;
    else if (st === "POSTED") posted += 1;
    else if (st === "DRAFT" || st === "SCHEDULED" || st === "RETRY_SCHEDULED" || st === "PUBLISHING")
      scheduledOrDraft += 1;
  }

  const campRows = await db
    .select({
      publishApprovalChainJson: schema.campaigns.publishApprovalChainJson,
      bentleyGenerationJson: schema.campaigns.bentleyGenerationJson,
    })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  const chain = parseCampaignPublishApprovalChainJson(campRows[0]?.publishApprovalChainJson ?? null);
  const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();
  const approvalPosts = postRows.map((p) => ({ id: p.id, utmParams: p.utmParams }));
  const approvalAgg = computePublishApprovalAnalytics({
    posts: approvalPosts,
    publishApprovalChain: chain,
    workerRequiresApproval,
  });

  const priorHints = await loadBentleyOptimizationPriorHints(db, campaignId);

  const diagnosisInput = {
    aggregate,
    postCounts: { failed, scheduledOrDraft, posted },
    approval: {
      pendingApprovalCount: approvalAgg.summary.pendingApprovalCount,
      overdueApprovalCount: approvalAgg.summary.overdueApprovalCount,
    },
    monthly: null,
    priorHints,
  };

  const result = runBentleyOptimizationDiagnosis(diagnosisInput);
  const fp = metricsFingerprintFromSummary(result);
  const optimizationKey = computeBentleyOptimizationKey({
    mode: opts.mode,
    bentleyRunId: opts.bentleyRunId ?? null,
    metricsFingerprint: fp,
  });

  const autonomousAllowed = process.env.BENTLEY_OPTIMIZATION_AUTONOMOUS === "1";
  const allowVariant =
    (result.status === "ready" && (result.confidence === "medium" || result.confidence === "high")) ||
    Boolean(opts.forceVariant);

  const lineageDepth = await countCampaignOptimizationLineageDepth(db, campaignId);
  const maxLineageDepth = readMaxOptimizationLineageDepthEnv();
  const lineageAllowsChild = lineageDepth < maxLineageDepth;

  const allowChildCreation =
    allowVariant &&
    lineageAllowsChild &&
    opts.mode !== "recommend_only" &&
    (opts.mode === "assisted" || (opts.mode === "autonomous" && autonomousAllowed));

  const gen = campRows[0] ? parseGeneration(campRows[0].bentleyGenerationJson) : null;

  const runId = randomUUID();
  let variantDraft = null;
  if (gen && result.status === "ready" && allowVariant) {
    variantDraft = buildBentleyOptimizationVariantDraft({
      parentCampaignId: campaignId,
      optimizationRunId: runId,
      campaign: gen.campaign,
      result,
    });
  }

  const sourceMetricsSummary = {
    coverage: aggregate.coverage,
    campaignSummary: aggregate.campaignSummary,
    freshness: aggregate.freshness,
    postCounts: diagnosisInput.postCounts,
    approval: diagnosisInput.approval,
    optimizationLineage: {
      depth: lineageDepth,
      maxDepth: maxLineageDepth,
      allowsChildCampaign: lineageAllowsChild,
    },
  };

  const persistRes = await persistBentleyOptimizationRun({
    db,
    runId,
    userId,
    clientId,
    campaignId,
    parentCampaignId: null,
    bentleyRunId: opts.bentleyRunId ?? null,
    postIds: postRows.map((p) => p.id),
    sourceMetricsSummary,
    result,
    mode: opts.mode,
    optimizationKey,
    variantDraft: allowChildCreation ? variantDraft : null,
    allowChildCreation,
  });

  const gateInput = {
    result,
    parentCampaignPostCount: postRows.length,
    postCounts: { failed },
    approval: {
      pendingApprovalCount: approvalAgg.summary.pendingApprovalCount,
      overdueApprovalCount: approvalAgg.summary.overdueApprovalCount,
    },
  };
  const gateResult = evaluateBentleyOptimizationAutoExecuteGates(gateInput);

  const execution: BentleyOptimizationExecutionTrace = {
    autoExecuteEnv: isBentleyOptimizationAutoExecuteEnvEnabled(),
    autoExecuteEvaluated: false,
    gates: gateResult,
    syncAttempted: false,
  };

  if (!persistRes.duplicate && persistRes.runId) {
    const autoEnv = execution.autoExecuteEnv;
    if (autoEnv && persistRes.childCampaignId) {
      execution.autoExecuteEvaluated = true;
      if (gateResult.allowed) {
        const useScheduled = opts.mode === "autonomous" && autonomousAllowed;
        const postCreationMode = useScheduled ? "scheduled" : "draft_unscheduled";
        execution.postCreationMode = postCreationMode;
        execution.syncAttempted = true;
        try {
          const sync = await syncBentleyCampaignPostsAndSchedule(db, {
            userId: String(userId),
            campaignId: persistRes.childCampaignId,
            scheduleStrategy: "staggered",
            staggerMinutes: 30,
            postCreationMode,
            optimizationRunId: persistRes.runId,
          });
          execution.sync = sync;
          try {
            const comparison = await buildBentleyOptimizationComparison(
              db,
              campaignId,
              persistRes.childCampaignId
            );
            await persistBentleyOptimizationComparison(db, persistRes.runId, comparison);
            execution.comparisonPersisted = true;
          } catch (cmpErr) {
            const msg = cmpErr instanceof Error ? cmpErr.message : String(cmpErr);
            execution.syncError = `comparison_failed:${msg}`;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          execution.syncError = msg;
        }
      }
    }
    await updateBentleyOptimizationRunExecutionTrace({
      db,
      runId: persistRes.runId,
      executionTraceJson: execution as unknown as Record<string, unknown>,
    });
  }

  return {
    result,
    runId: persistRes.runId,
    childCampaignId: persistRes.childCampaignId,
    duplicate: persistRes.duplicate,
    optimizationKey,
    execution,
  };
}
