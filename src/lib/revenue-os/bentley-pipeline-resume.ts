/**
 * `resumePipeline` — run full Revenue OS pipeline from snapshot context (chat / automation).
 * Returns the same shape as `createBentleyActionRunner().runFullPipeline()` (includes `status` for blocked UI).
 */

import {
  createBentleyActionRunner,
  type BentleyActionRunnerContext,
  type BentleyFullPipelineResult,
} from "@/lib/revenue-os/bentley-action-runner";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { reconcileBentleySnapshotFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";

export async function resumePipeline(ctx: BentleyActionRunnerContext): Promise<BentleyFullPipelineResult> {
  bentleyContinuityLog("pipeline_resume", { businessName: ctx.getSnapshot().businessName });
  try {
    reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
  } catch {
    /* ignore */
  }
  const runner = createBentleyActionRunner(ctx);
  return runner.runFullPipeline();
}

export type { BentleyActionRunnerContext };
