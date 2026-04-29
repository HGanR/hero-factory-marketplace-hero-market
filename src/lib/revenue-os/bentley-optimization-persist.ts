/**
 * Persist Bentley optimization runs + optional child campaign (assisted execution).
 */

import { createHash, randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  type BentleyOptimizationResult,
  metricsFingerprintFromSummary,
} from "@/lib/revenue-os/bentley-optimization";
import {
  mergeVariantIntoBentleyGenerationJson,
  type BentleyOptimizationVariantDraft,
} from "@/lib/revenue-os/bentley-optimization-variants";
import type { BentleyGenerationPayload } from "@/lib/revenue-os/ensure-campaign-from-bentley";

export type BentleyOptimizationExecutionMode = "recommend_only" | "assisted" | "autonomous";

export function computeBentleyOptimizationKey(args: {
  mode: BentleyOptimizationExecutionMode;
  bentleyRunId?: string | null;
  metricsFingerprint: string;
}): string {
  const raw = `${args.mode}|${args.bentleyRunId ?? ""}|${args.metricsFingerprint}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 48);
}

function parseGeneration(raw: unknown): BentleyGenerationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.campaign || typeof o.campaign !== "object") return null;
  return raw as BentleyGenerationPayload;
}

export async function persistBentleyOptimizationRun(args: {
  db: MySql2Database<typeof schema>;
  runId: string;
  userId: string;
  clientId: string;
  campaignId: string;
  parentCampaignId: string | null;
  bentleyRunId: string | null;
  postIds: string[];
  sourceMetricsSummary: Record<string, unknown>;
  result: BentleyOptimizationResult;
  mode: BentleyOptimizationExecutionMode;
  optimizationKey: string;
  variantDraft: BentleyOptimizationVariantDraft | null;
  allowChildCreation: boolean;
}): Promise<{ runId: string; childCampaignId: string | null; duplicate: boolean }> {
  const {
    db,
    runId,
    userId,
    clientId,
    campaignId,
    parentCampaignId,
    bentleyRunId,
    postIds,
    sourceMetricsSummary,
    result,
    mode,
    optimizationKey,
    variantDraft,
    allowChildCreation,
  } = args;

  const existing = await db
    .select({ id: schema.bentleyOptimizationRuns.id, childCampaignId: schema.bentleyOptimizationRuns.childCampaignId })
    .from(schema.bentleyOptimizationRuns)
    .where(
      and(
        eq(schema.bentleyOptimizationRuns.campaignId, campaignId),
        eq(schema.bentleyOptimizationRuns.optimizationKey, optimizationKey)
      )
    )
    .limit(1);

  if (existing[0]) {
    return { runId: existing[0].id, childCampaignId: existing[0].childCampaignId ?? null, duplicate: true };
  }

  let childCampaignId: string | null = null;

  await db.insert(schema.bentleyOptimizationRuns).values({
    id: runId,
    userId: String(userId),
    clientId,
    campaignId,
    parentCampaignId,
    bentleyRunId,
    optimizationKey,
    postIdsJson: postIds,
    sourceMetricsSummaryJson: sourceMetricsSummary,
    resultJson: result as unknown as Record<string, unknown>,
    executionMode: mode,
    childCampaignId: null,
  });

  if (allowChildCreation && mode !== "recommend_only" && variantDraft) {
    const parentRows = await db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .limit(1);
    const parent = parentRows[0];
    const gen = parent ? parseGeneration(parent.bentleyGenerationJson) : null;
    if (parent && gen) {
      const merged = mergeVariantIntoBentleyGenerationJson({ generation: gen, variant: variantDraft });
      childCampaignId = randomUUID();
      const name = `${parent.name.slice(0, 160)} — Optimization`;
      await db.insert(schema.campaigns).values({
        id: childCampaignId,
        userId: parent.userId,
        clientId: parent.clientId,
        name,
        objective: parent.objective,
        status: "DRAFT",
        /** Child rows must not reuse `bentley_run_id` (globally unique index). */
        bentleyRunId: null,
        bentleyGenerationJson: merged,
        derivedFromCampaignId: campaignId,
        bentleyOptimizationRunId: runId,
      });
      await db
        .update(schema.bentleyOptimizationRuns)
        .set({ childCampaignId })
        .where(eq(schema.bentleyOptimizationRuns.id, runId));
    }
  }

  return { runId, childCampaignId, duplicate: false };
}

export async function updateBentleyOptimizationRunExecutionTrace(args: {
  db: MySql2Database<typeof schema>;
  runId: string;
  executionTraceJson: Record<string, unknown>;
}): Promise<void> {
  await args.db
    .update(schema.bentleyOptimizationRuns)
    .set({ executionTraceJson: args.executionTraceJson })
    .where(eq(schema.bentleyOptimizationRuns.id, args.runId));
}
