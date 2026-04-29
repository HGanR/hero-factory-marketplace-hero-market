/**
 * Full-lifecycle orchestration after core pipeline (`runFullPipelineAction` through analysis):
 * campaign DB persistence → sync-launch posts → launch finalize → analytics / optimization honesty.
 */

import { reconcileBentleySnapshotFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { getBentleyCampaignPersistenceRunId } from "@/lib/revenue-os/bentley-campaign-persist-run-id";
import {
  upsertLifecycleStage,
  type BentleyLifecycleStageId,
  type BentleyLifecycleStageRecord,
} from "@/lib/revenue-os/bentley-lifecycle";
import {
  loadWorkflowState,
  markPhaseComplete,
  saveWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import {
  ensureCampaignFromBentleyApi,
  syncBentleyLaunchApi,
  upgradeBentleyCampaignAssetsApi,
} from "@/lib/revenue-os/revenue-os-pipeline-actions";
import {
  runFullPipelineAction,
  runBentleyLaunchFinalizeAction,
  type BentleyActionRunnerContext,
  type BentleyActionOptions,
  type BentleyFullPipelineResult,
} from "@/lib/revenue-os/bentley-action-runner";
import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";

export type BentleyFullLifecycleServerFacts = {
  deploymentFeedbackRows?: number;
  postsForLatestCampaign?: number;
  optimizationRunsCount?: number;
};

export type BentleyFullLifecycleOptions = {
  pipeline?: BentleyActionOptions;
  /** When omitted and `fetchServerFacts` absent, analytics / optimization stages stay `unknown` or `waiting`. */
  serverFacts?: BentleyFullLifecycleServerFacts;
  /** Load counts from `POST /api/revenue-os/bentley/autonomy-readiness` (uses current workflow + client scope). */
  fetchServerFacts?: () => Promise<BentleyFullLifecycleServerFacts | undefined>;
  /**
   * After launch, call `POST /api/revenue-os/bentley/optimization/run` with `recommend_only`.
   * Does not claim autonomous execution — gates are reflected on lifecycle records.
   */
  runOptimizationRecommendation?: boolean;
};

export type BentleyFullLifecycleStoppedAt =
  | "pipeline"
  | "campaign_persisted"
  | "launch_synced"
  | "launch_finalized"
  | "analytics"
  | "optimization"
  | "complete";

export type BentleyFullLifecycleResult = {
  ok: boolean;
  stoppedAt: BentleyFullLifecycleStoppedAt;
  reason?: string;
  workflow: BentleyWorkflowState;
  pipeline?: BentleyFullPipelineResult;
};

function persistCtx(ctx: BentleyActionRunnerContext, next: BentleyWorkflowState): BentleyWorkflowState {
  saveWorkflowState(next);
  try {
    reconcileBentleySnapshotFromWorkflow(ctx.applyPatch, ctx.getSnapshot);
  } catch {
    /* ignore */
  }
  return next;
}

function recordStage(
  ctx: BentleyActionRunnerContext,
  stage: BentleyLifecycleStageId,
  record: BentleyLifecycleStageRecord
): BentleyWorkflowState {
  const st = upsertLifecycleStage(loadWorkflowState(), stage, record);
  return persistCtx(ctx, st);
}

/**
 * Browser helper: reuse autonomy-readiness API for honest server counts (no fake `ok`).
 */
export async function fetchBentleyLifecycleServerFacts(): Promise<BentleyFullLifecycleServerFacts | undefined> {
  try {
    const wf = loadWorkflowState();
    const cid = getBentleyStorageScope()?.clientId ?? "";
    const res = await fetch("/api/revenue-os/bentley/autonomy-readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ clientId: cid, workflow: wf }),
    });
    const j = (await res.json()) as {
      server?: BentleyFullLifecycleServerFacts;
    };
    if (!res.ok || !j.server) return undefined;
    return j.server;
  } catch {
    return undefined;
  }
}

async function resolveServerFacts(opts: BentleyFullLifecycleOptions): Promise<BentleyFullLifecycleServerFacts | undefined> {
  if (opts.serverFacts && Object.keys(opts.serverFacts).length > 0) return opts.serverFacts;
  if (opts.fetchServerFacts) return opts.fetchServerFacts();
  return fetchBentleyLifecycleServerFacts();
}

/**
 * Runs core pipeline through analysis, then best-effort downstream steps with explicit lifecycle tracking.
 */
export async function runBentleyFullLifecycleAction(
  ctx: BentleyActionRunnerContext,
  opts: BentleyFullLifecycleOptions = {}
): Promise<BentleyFullLifecycleResult> {
  const pipeline = await runFullPipelineAction(ctx, opts.pipeline);
  if (!pipeline.ok) {
    const st = recordStage(ctx, "pipeline_complete", {
      status: "blocked",
      detail: pipeline.reason ?? "Pipeline did not complete through analysis.",
    });
    return {
      ok: false,
      stoppedAt: "pipeline",
      reason: pipeline.reason,
      workflow: st,
      pipeline,
    };
  }

  recordStage(ctx, "pipeline_complete", {
    status: "ok",
    detail: "Research → analysis pipeline finished.",
  });

  let st = loadWorkflowState();
  if (st.completed.analysis && !st.completed.dashboard) {
    st = markPhaseComplete(st, "dashboard", {});
    persistCtx(ctx, st);
  }

  st = loadWorkflowState();
  const snap = ctx.getSnapshot();
  let cid = st.artifacts.bentleyDbCampaignId?.trim();
  const campaign = st.artifacts.campaign;

  if (!cid) {
    if (!campaign) {
      const blocked = recordStage(ctx, "campaign_persisted", {
        status: "blocked",
        detail: "No generated campaign in workflow artifacts — cannot call ensure-campaign.",
      });
      return {
        ok: false,
        stoppedAt: "campaign_persisted",
        reason: "Campaign artifact missing after pipeline.",
        workflow: blocked,
        pipeline,
      };
    }
    try {
      const runId = getBentleyCampaignPersistenceRunId();
      const ensured = await ensureCampaignFromBentleyApi({
        bentleyRunId: runId,
        clientId: ctx.clientId?.trim() ?? "",
        businessName: snap.businessName,
        platforms: snap.platforms ?? [],
        postingPlatforms: (snap.postingPlatforms ?? []).map((p) => String(p)),
        tone: snap.tone,
        imageStyle: snap.imageStyle,
        campaign,
      });
      cid = ensured.id;
      st = loadWorkflowState();
      st = {
        ...st,
        artifacts: {
          ...st.artifacts,
          bentleyDbCampaignId: cid,
          campaignPersistenceError: null,
        },
      };
      persistCtx(ctx, st);
      recordStage(ctx, "campaign_persisted", { status: "ok", detail: `Campaign id ${cid.slice(0, 8)}…` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      st = loadWorkflowState();
      st = {
        ...st,
        artifacts: { ...st.artifacts, campaignPersistenceError: msg },
      };
      const blocked = persistCtx(
        ctx,
        upsertLifecycleStage(st, "campaign_persisted", {
          status: "blocked",
          detail: msg,
        })
      );
      return { ok: false, stoppedAt: "campaign_persisted", reason: msg, workflow: blocked, pipeline };
    }
  } else {
    recordStage(ctx, "campaign_persisted", {
      status: "ok",
      detail: "DB campaign id already present in session.",
    });
  }

  st = loadWorkflowState();
  cid = st.artifacts.bentleyDbCampaignId?.trim();
  if (!cid) {
    const blocked = recordStage(ctx, "launch_synced", {
      status: "blocked",
      detail: "No campaign id after persistence step.",
    });
    return { ok: false, stoppedAt: "launch_synced", reason: "Missing bentleyDbCampaignId", workflow: blocked, pipeline };
  }

  if (!st.artifacts.bentleyLaunchSyncedAt?.trim()) {
    try {
      const sync = await syncBentleyLaunchApi({
        campaignId: cid,
        scheduleStrategy: "staggered",
        staggerMinutes: 30,
      });
      if (!sync.postIds.length) {
        const msg = "syncBentleyLaunchApi returned no campaign post ids.";
        const blocked = recordStage(ctx, "launch_synced", { status: "blocked", detail: msg });
        return { ok: false, stoppedAt: "launch_synced", reason: msg, workflow: blocked, pipeline };
      }
      st = loadWorkflowState();
      st = {
        ...st,
        artifacts: { ...st.artifacts, bentleyLaunchSyncedAt: new Date().toISOString() },
      };
      persistCtx(ctx, st);
      recordStage(ctx, "launch_synced", {
        status: "ok",
        detail: `Posts materialized (${sync.postIds.length}).`,
      });
      void upgradeBentleyCampaignAssetsApi({ campaignId: cid }).catch(() => {
        /* non-blocking batch upgrade for any missed ephemeral URLs */
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const blocked = recordStage(ctx, "launch_synced", { status: "blocked", detail: msg });
      return { ok: false, stoppedAt: "launch_synced", reason: msg, workflow: blocked, pipeline };
    }
  } else {
    recordStage(ctx, "launch_synced", {
      status: "ok",
      detail: "Launch sync timestamp already recorded.",
    });
  }

  const fin = await runBentleyLaunchFinalizeAction(ctx);
  if (!fin.ok) {
    const msg = fin.reason ?? "Launch finalize failed.";
    const blocked = recordStage(ctx, "launch_finalized", { status: "blocked", detail: msg });
    return { ok: false, stoppedAt: "launch_finalized", reason: msg, workflow: blocked, pipeline };
  }
  recordStage(ctx, "launch_finalized", {
    status: "ok",
    detail: "Launch-ready phase completed (sync + schedule / approval path).",
  });

  const serverFacts = await resolveServerFacts(opts);

  st = loadWorkflowState();
  if (serverFacts?.deploymentFeedbackRows != null) {
    if (serverFacts.deploymentFeedbackRows > 0) {
      recordStage(ctx, "analytics_ready", {
        status: "ok",
        detail: `Deployment feedback rows: ${serverFacts.deploymentFeedbackRows}.`,
      });
    } else {
      recordStage(ctx, "analytics_ready", {
        status: "waiting",
        detail: "No deployment feedback rows yet — analytics signals not materialized.",
      });
    }
  } else {
    recordStage(ctx, "analytics_ready", {
      status: "unknown",
      detail: "Server feedback count not available — cannot verify analytics path.",
    });
  }

  const analyticsRecord = loadWorkflowState().lifecycle?.analytics_ready;
  const analyticsSatisfied =
    analyticsRecord?.status === "ok" ||
    (serverFacts?.deploymentFeedbackRows != null && serverFacts.deploymentFeedbackRows > 0);

  if (!opts.runOptimizationRecommendation) {
    recordStage(ctx, "optimization_ready", {
      status: analyticsSatisfied ? "waiting" : analyticsRecord?.status === "unknown" ? "unknown" : "waiting",
      detail: analyticsSatisfied
        ? "Optimization recommendation not requested on this run."
        : "Waiting for analytics readiness before optimization.",
    });
    recordStage(ctx, "optimization_executed", {
      status: "pending",
      detail: "No optimization API invocation in this run.",
    });
    return {
      ok: true,
      stoppedAt: "complete",
      workflow: loadWorkflowState(),
      pipeline,
    };
  }

  if (!analyticsSatisfied) {
    recordStage(ctx, "optimization_ready", {
      status: "waiting",
      detail: "Analytics not ready — skipping optimization API to avoid false diagnosis.",
    });
    recordStage(ctx, "optimization_executed", {
      status: "pending",
      detail: "Optimization not invoked.",
    });
    return {
      ok: true,
      stoppedAt: "optimization",
      reason: "Analytics not ready for optimization recommendation.",
      workflow: loadWorkflowState(),
      pipeline,
    };
  }

  try {
    const res = await fetch("/api/revenue-os/bentley/optimization/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        campaignId: cid,
        mode: "recommend_only",
        bentleyRunId: getBentleyCampaignPersistenceRunId(),
      }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      result?: { status?: string; confidence?: string };
      execution?: { gates?: { allowed: boolean; reasons: string[] }; syncAttempted?: boolean };
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      const msg = body.message ?? body.error ?? `HTTP ${res.status}`;
      recordStage(ctx, "optimization_ready", { status: "blocked", detail: msg });
      recordStage(ctx, "optimization_executed", { status: "blocked", detail: msg });
      return {
        ok: false,
        stoppedAt: "optimization",
        reason: msg,
        workflow: loadWorkflowState(),
        pipeline,
      };
    }

    const gates = body.execution?.gates;
    const gateBlocked = Boolean(gates && !gates.allowed);
    recordStage(ctx, "optimization_ready", {
      status: gateBlocked ? "blocked" : "ok",
      detail: gateBlocked
        ? `Auto-execute gates closed: ${(gates?.reasons ?? []).join(", ") || "unspecified"}.`
        : "Diagnosis completed; gates allow downstream actions per policy.",
    });

    const executed =
      Boolean(body.execution?.syncAttempted && body.execution?.gates?.allowed) ||
      (body.result?.status === "ready" && !gateBlocked);
    recordStage(ctx, "optimization_executed", {
      status: executed ? "ok" : "waiting",
      detail: executed
        ? "Optimization runner completed (recommend_only — check execution trace for variant work)."
        : "Recommendation recorded; gated execution did not run or was not applicable.",
    });

    return {
      ok: true,
      stoppedAt: "complete",
      reason: gateBlocked
        ? "Optimization gates blocked autonomous execution — see lifecycle.optimization_* stages."
        : undefined,
      workflow: loadWorkflowState(),
      pipeline,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordStage(ctx, "optimization_ready", { status: "blocked", detail: msg });
    recordStage(ctx, "optimization_executed", { status: "blocked", detail: msg });
    return { ok: false, stoppedAt: "optimization", reason: msg, workflow: loadWorkflowState(), pipeline };
  }
}
