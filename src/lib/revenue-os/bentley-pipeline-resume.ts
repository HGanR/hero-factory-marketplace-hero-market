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

/**
 * Dashboard handoff “Open Dashboard + Run Full Analysis”: core pipeline, then DB campaign + sync-launch + launch finalize.
 */
export async function resumeDashboardPipelineWithLifecycle(
  ctx: BentleyActionRunnerContext
): Promise<{ ok: boolean; reason?: string }> {
  bentleyContinuityLog("pipeline_resume_lifecycle", { businessName: ctx.getSnapshot().businessName });
  try {
    reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
  } catch {
    /* ignore */
  }
  const runner = createBentleyActionRunner(ctx);
  const lifecycle = await runner.runFullLifecycle({});
  if (lifecycle.ok) return { ok: true };
  return {
    ok: false,
    reason: lifecycle.reason ?? lifecycle.pipeline?.reason ?? "Lifecycle stopped early.",
  };
}

export type { BentleyActionRunnerContext };
