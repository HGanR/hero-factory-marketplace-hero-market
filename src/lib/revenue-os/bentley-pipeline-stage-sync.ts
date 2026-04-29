/**
 * Bentley snapshot pipeline flags + `launchPrefill` are **derived views** for UI and session persistence.
 *
 * **Authoritative:** `BentleyWorkflowState` in sessionStorage (`bentley-workflow.ts`) — phase completion,
 * `completed`, `artifacts`, `lastFailedPhase`, `lastError`.
 *
 * **Derived:** `BentleySnapshot.pipeline` and `launchPrefill` — recomputed from workflow + artifacts via
 * `reconcileBentleySnapshotFromWorkflow` / `derivePipelineStagesFromWorkflowState`. Call after every
 * workflow mutation and on hydration/cross-tab so dashboard, chat strip, and ambient status agree.
 *
 * **Advisory:** deployment handoff UX (`bentley-pipeline-deployment-handoff.ts`) — does not replace workflow truth.
 */

import type { BentleyLaunchPrefill, BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { mergePipelineStages, type BentleyPipelineStageState } from "@/lib/revenue-os/bentley-orchestrator";
import { loadWorkflowState, type BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";

export function buildLaunchPrefillFromArtifacts(
  snap: BentleySnapshot,
  campaign: CampaignResponse | null | undefined,
  content?: ContentEngineOutput | null
): BentleyLaunchPrefill {
  const caption =
    content?.fullPost?.caption?.trim() ||
    campaign?.offerStatement?.trim() ||
    "";
  const hooks = (campaign?.shortFormHooks ?? []).slice(0, 8).join("\n");
  const cta = campaign?.longFormOutlines?.[0]?.cta?.trim() || campaign?.offerStatement?.trim() || "";
  return {
    campaignName: snap.businessName.trim()
      ? `${snap.businessName.trim()} — launch`
      : "Campaign launch",
    caption,
    hooks,
    cta,
    platformsLabel: [...(snap.platforms ?? [])].join(", "),
  };
}

/**
 * Derive pipeline stage booleans from an explicit workflow state (testable; avoids mocking sessionStorage).
 */
export function derivePipelineStagesFromWorkflowState(
  snap: BentleySnapshot,
  wf: BentleyWorkflowState
): BentleyPipelineStageState {
  const ce = wf.artifacts.contentEngine;
  const hasContent = Boolean(ce && (ce.fullPost?.caption?.trim() || (ce.hooks?.length ?? 0) > 0));
  return mergePipelineStages(snap.pipeline, {
    intakeComplete: Boolean(wf.completed.intake),
    analysisComplete: Boolean(wf.completed.analysis && wf.artifacts.analysisComplete),
    contentGenerated: Boolean(wf.completed.content && hasContent),
    campaignGenerated: Boolean(wf.completed.campaign_generation && wf.artifacts.campaign),
    launchReady: Boolean(
      wf.completed.campaign_generation &&
        wf.artifacts.campaign &&
        wf.completed.media_brief &&
        wf.completed.analysis &&
        wf.artifacts.analysisComplete
    ),
  });
}

export function derivePipelineStagesFromWorkflow(snap: BentleySnapshot): BentleyPipelineStageState {
  return derivePipelineStagesFromWorkflowState(snap, loadWorkflowState());
}

/** Strings for debug/observability when snapshot.pipeline lags workflow or disagrees with it. */
export function detectBentleyPipelineWorkflowMismatches(snap: BentleySnapshot): string[] {
  const wf = loadWorkflowState();
  const derived = derivePipelineStagesFromWorkflowState(snap, wf);
  const issues: string[] = [];
  const check = (key: keyof BentleyPipelineStageState, label: string) => {
    const fromSnap = Boolean(snap.pipeline?.[key]);
    const fromDerived = Boolean(derived[key]);
    if (fromDerived && !fromSnap) {
      issues.push(`lagging:${label}:workflow_true_snapshot_false`);
    }
    if (fromSnap && !fromDerived) {
      issues.push(`phantom_or_stale:${label}:snapshot_true_workflow_false`);
    }
  };
  check("intakeComplete", "intake");
  check("analysisComplete", "analysis");
  check("contentGenerated", "content");
  check("campaignGenerated", "campaign");
  check("launchReady", "launchReady");
  return issues;
}

/**
 * Idempotent: merges workflow-derived stages monotonically into the snapshot and refreshes `launchPrefill`
 * when campaign/content artifacts exist.
 */
export function reconcileBentleySnapshotFromWorkflow(
  applyPatch: (p: Partial<BentleySnapshot>) => void,
  getSnapshot: () => BentleySnapshot
): void {
  const snap = getSnapshot();
  const stages = derivePipelineStagesFromWorkflow(snap);
  bentleyContinuityLog("pipeline_stage_transition", { stages });
  applyPatch({ pipeline: stages });
  const wf = loadWorkflowState();
  const prefill = buildLaunchPrefillFromArtifacts(
    getSnapshot(),
    wf.artifacts.campaign ?? undefined,
    wf.artifacts.contentEngine ?? undefined
  );
  if (
    prefill.caption ||
    prefill.hooks ||
    prefill.cta ||
    stages.campaignGenerated ||
    stages.contentGenerated
  ) {
    applyPatch({ launchPrefill: prefill });
  }
}

/** @deprecated Prefer `reconcileBentleySnapshotFromWorkflow` — identical behavior. */
export function syncPipelineStagesFromWorkflow(
  applyPatch: (p: Partial<BentleySnapshot>) => void,
  getSnapshot: () => BentleySnapshot
): void {
  reconcileBentleySnapshotFromWorkflow(applyPatch, getSnapshot);
}
