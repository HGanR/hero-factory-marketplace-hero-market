/**
 * Merge content-batch routing trace into unified generation context for snapshot persistence.
 */

import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";
import { routeGeneratedContentIntoBatches, toContentBatchRoutingTrace } from "@/lib/revenue-os/route-generated-content-into-batches";

export function withContentBatchRoutingSnapshot(
  ctx: UnifiedGenerationContext,
  args: {
    contentEngineResult?: ContentEngineOutput | null;
    campaignResult?: CampaignResponse | null;
  }
): UnifiedGenerationContext {
  const platformRoleRouting =
    ctx.optimizationMemoryGeneration?.platformRoleRoutingSummary ?? null;
  const summary = routeGeneratedContentIntoBatches({
    contentEngineResult: args.contentEngineResult,
    campaignResult: args.campaignResult,
    launchPlan: null,
    mediaBrief: null,
    platformRoleRouting,
    optimizationMemoryGeneration: ctx.optimizationMemoryGeneration,
  });
  const trace = toContentBatchRoutingTrace(summary);
  if (!trace) return ctx;
  return { ...ctx, contentBatchRoutingTrace: trace };
}
