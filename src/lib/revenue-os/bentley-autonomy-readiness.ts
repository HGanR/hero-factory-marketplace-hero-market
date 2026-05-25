/**
 * Operator-facing autonomy readiness — derived from real workflow + optional server checks (no hardcoded “healthy”).
 */

import {
  BENTLEY_LIFECYCLE_STAGE_ORDER,
  lifecycleBlockingDetail,
  type BentleyLifecycleStageId,
} from "@/lib/revenue-os/bentley-lifecycle";
import {
  BENTLEY_OPERATIONAL_ISSUE_COPY,
  type BentleyOperationalIssueCode,
} from "@/lib/revenue-os/bentley-operational-blockers";
import type { BentleyWorkflowPhaseId, BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export type AutonomyAreaStatus = "ok" | "blocked" | "unknown" | "waiting";

export type AutonomyArea = {
  id: string;
  status: AutonomyAreaStatus;
  detail: string;
};

export type BentleyAutonomyLifecycleBandStatus = AutonomyAreaStatus;

export type BentleyAutonomyLifecycleBand = {
  id: "core_pipeline" | "launch" | "optimization" | "full_lifecycle";
  status: BentleyAutonomyLifecycleBandStatus;
  detail: string;
};

export type BentleyOperationalBlockerRow = {
  code: string;
  detail: string;
  severity: "blocked" | "waiting";
};

export type BentleyAutonomyReadinessReport = {
  generatedAt: string;
  areas: AutonomyArea[];
  summaryLine: string;
  blockedCount: number;
  /** Distinct autonomy slices (pipeline vs launch vs optimization vs whole lifecycle). */
  lifecycleBands: BentleyAutonomyLifecycleBand[];
  /** Publish / worker / analytics operational truth (when server supplied campaign-scoped facts). */
  operationalBlockers: BentleyOperationalBlockerRow[];
};

function area(id: string, status: AutonomyAreaStatus, detail: string): AutonomyArea {
  return { id, status, detail };
}

export type BentleyAutonomyReadinessInput = {
  signedIn: boolean;
  workflow: BentleyWorkflowState;
  /** Optional server/API facts — omit when unknown (marks areas `unknown` instead of lying). */
  server?: {
    campaignCount?: number;
    postsForLatestCampaign?: number;
    deploymentFeedbackRows?: number;
    optimizationRunsCount?: number;
    governanceAuditRows?: number;
    /** Campaign-scoped operational evaluation (POST route merges DB + `evaluateBentleyOperationalIssues`). */
    operational?: {
      issueCodes: BentleyOperationalIssueCode[];
      analyticsStatus: "ok" | "blocked" | "waiting" | "unknown";
      analyticsReasonCode: string;
      analyticsDetail: string;
      connectedPlatforms?: string[];
    };
  };
};

function done(wf: BentleyWorkflowState, phase: BentleyWorkflowPhaseId): boolean {
  return Boolean(wf.completed[phase]);
}

function computeLifecycleBands(wf: BentleyWorkflowState): BentleyAutonomyLifecycleBand[] {
  const lc = wf.lifecycle ?? {};
  const pipe = lc.pipeline_complete;
  let core: BentleyAutonomyLifecycleBand = {
    id: "core_pipeline",
    status: "unknown",
    detail: "No full-lifecycle run recorded — inferring from workflow phases only.",
  };
  if (pipe?.status === "ok") {
    core = { id: "core_pipeline", status: "ok", detail: pipe.detail ?? "Pipeline lifecycle stage complete." };
  } else if (pipe?.status === "blocked") {
    core = {
      id: "core_pipeline",
      status: "blocked",
      detail: pipe.detail ?? "Pipeline stage blocked in lifecycle run.",
    };
  } else if (wf.lastFailedPhase) {
    core = {
      id: "core_pipeline",
      status: "blocked",
      detail: `Pipeline failure at **${wf.lastFailedPhase}** (session).`,
    };
  } else if (done(wf, "analysis")) {
    core = {
      id: "core_pipeline",
      status: "ok",
      detail: "Analysis complete — core automated pipeline finished (no lifecycle marker).",
    };
  }

  const launchBlocked =
    lc.campaign_persisted?.status === "blocked" ||
    lc.launch_synced?.status === "blocked" ||
    lc.launch_finalized?.status === "blocked";
  const launchDetail =
    lifecycleBlockingDetail(wf) ??
    lc.launch_finalized?.detail ??
    lc.launch_synced?.detail ??
    lc.campaign_persisted?.detail ??
    "";

  let launch: BentleyAutonomyLifecycleBand = {
    id: "launch",
    status: "unknown",
    detail: "Launch lifecycle not started or not recorded.",
  };
  if (launchBlocked) {
    launch = { id: "launch", status: "blocked", detail: launchDetail || "A launch lifecycle stage is blocked." };
  } else if (lc.launch_finalized?.status === "ok") {
    launch = { id: "launch", status: "ok", detail: lc.launch_finalized.detail ?? "Launch finalized in lifecycle run." };
  } else if (done(wf, "launch_ready")) {
    launch = {
      id: "launch",
      status: "ok",
      detail: "Workflow shows **launch_ready** complete (phase flags).",
    };
  } else if (lc.campaign_persisted?.status === "ok" && lc.launch_synced?.status === "ok" && !lc.launch_finalized) {
    launch = {
      id: "launch",
      status: "waiting",
      detail: "Campaign persisted and posts synced — finalize launch when ready.",
    };
  }

  const optBlocked = lc.optimization_ready?.status === "blocked" || lc.optimization_executed?.status === "blocked";
  let optimization: BentleyAutonomyLifecycleBand = {
    id: "optimization",
    status: "unknown",
    detail: "Optimization lifecycle not evaluated in-session.",
  };
  if (optBlocked) {
    optimization = {
      id: "optimization",
      status: "blocked",
      detail:
        lc.optimization_ready?.detail ??
        lc.optimization_executed?.detail ??
        "Optimization stage blocked (gates or API).",
    };
  } else if (lc.optimization_executed?.status === "ok") {
    optimization = {
      id: "optimization",
      status: "ok",
      detail: lc.optimization_executed.detail ?? "Optimization runner completed last recorded step.",
    };
  } else if (lc.optimization_ready?.status === "waiting" || lc.optimization_executed?.status === "waiting") {
    optimization = {
      id: "optimization",
      status: "waiting",
      detail:
        lc.optimization_ready?.detail ??
        lc.optimization_executed?.detail ??
        "Waiting for metrics, gates, or operator action.",
    };
  }

  const fullOk = core.status === "ok" && launch.status === "ok" && optimization.status === "ok";
  const fullBlocked =
    core.status === "blocked" || launch.status === "blocked" || optimization.status === "blocked";
  const full: BentleyAutonomyLifecycleBand = fullOk
    ? {
        id: "full_lifecycle",
        status: "ok",
        detail: "Core pipeline, launch, and optimization bands are all green for recorded lifecycle.",
      }
    : fullBlocked
      ? {
          id: "full_lifecycle",
          status: "blocked",
          detail: "At least one lifecycle band is blocked — see bands above.",
        }
      : {
          id: "full_lifecycle",
          status: "waiting",
          detail: "Lifecycle incomplete or still warming up (unknown/waiting bands).",
        };

  return [core, launch, optimization, full];
}

function lifecycleStageAreas(wf: BentleyWorkflowState): AutonomyArea[] {
  const lc = wf.lifecycle ?? {};
  const out: AutonomyArea[] = [];
  for (const id of BENTLEY_LIFECYCLE_STAGE_ORDER) {
    const r = lc[id as BentleyLifecycleStageId];
    if (!r) continue;
    const st =
      r.status === "pending"
        ? "unknown"
        : r.status === "waiting"
          ? "waiting"
          : r.status === "unknown"
            ? "unknown"
            : r.status === "blocked"
              ? "blocked"
              : "ok";
    out.push(area(`lifecycle_${id}`, st, r.detail?.trim() || id));
  }
  return out;
}

/**
 * Deterministic readiness from session workflow + optional server snapshot.
 */
function operationalIssueSeverity(code: string): "blocked" | "waiting" {
  if (
    code === "analytics_waiting_initial_window" ||
    code === "analytics_not_applicable_no_published_posts"
  ) {
    return "waiting";
  }
  if (code.startsWith("analytics_")) return "blocked";
  return "blocked";
}

export function computeBentleyAutonomyReadiness(input: BentleyAutonomyReadinessInput): BentleyAutonomyReadinessReport {
  const wf = input.workflow;
  const srv = input.server;
  const lifecycleBands = computeLifecycleBands(wf);
  const areas: AutonomyArea[] = [...lifecycleStageAreas(wf)];
  const op = srv?.operational;
  const operationalBlockers: BentleyOperationalBlockerRow[] = [];
  if (op?.issueCodes?.length) {
    for (const code of op.issueCodes) {
      const c = code as BentleyOperationalIssueCode;
      const detail = BENTLEY_OPERATIONAL_ISSUE_COPY[c] ?? code;
      operationalBlockers.push({ code, detail, severity: operationalIssueSeverity(code) });
    }
    for (const code of op.issueCodes) {
      if (String(code).startsWith("analytics_")) continue;
      const c = code as BentleyOperationalIssueCode;
      areas.push(
        area(
          `operational_${code}`,
          operationalIssueSeverity(code) === "waiting" ? "waiting" : "blocked",
          BENTLEY_OPERATIONAL_ISSUE_COPY[c] ?? String(code)
        )
      );
    }
  }

  // 1 Intake
  if (!input.signedIn) {
    areas.push(area("intake", "blocked", "Sign in required to persist guided intake and run the pipeline."));
  } else if (done(wf, "intake") || wf.currentPhase !== "intake") {
    areas.push(area("intake", "ok", "Guided intake phase completed or advanced."));
  } else {
    areas.push(area("intake", "blocked", "Finish guided intake (business, industry, audience) before autonomous pipeline steps."));
  }

  // 2 Pipeline
  if (wf.lastFailedPhase) {
    areas.push(
      area(
        "pipeline",
        "blocked",
        `Last failure at **${wf.lastFailedPhase}** — use Resume or re-run that step; check session workflow storage.`
      )
    );
  } else if (coerceTrimmedString(wf.lastError)) {
    areas.push(area("pipeline", "blocked", `Workflow error recorded: ${coerceTrimmedString(wf.lastError).slice(0, 200)}`));
  } else {
    areas.push(area("pipeline", "ok", "No failed phase flag on workflow state."));
  }

  // 3 Campaign DB
  const dbId = coerceTrimmedString(wf.artifacts.bentleyDbCampaignId);
  const persistErr = coerceTrimmedString(wf.artifacts.campaignPersistenceError);
  if (dbId) {
    areas.push(area("campaign_persistence", "ok", `Campaign persisted (**${dbId.slice(0, 8)}…**).`));
  } else if (srv?.campaignCount != null && srv.campaignCount > 0) {
    areas.push(area("campaign_persistence", "ok", `Server reports **${srv.campaignCount}** campaign(s); workflow id not linked in this session.`));
  } else if (done(wf, "campaign_generation")) {
    const errHint = persistErr ? ` Last error: ${persistErr.slice(0, 280)}${persistErr.length > 280 ? "…" : ""}` : "";
    areas.push(
      area(
        "campaign_persistence",
        "blocked",
        `Campaign generation finished in-session but **no DB campaign id** — ensure-campaign did not succeed.${errHint}`
      )
    );
  } else {
    areas.push(area("campaign_persistence", "unknown", "Campaign not persisted yet (or server counts not supplied)."));
  }

  // 4 Posts / sync-launch
  const synced = coerceTrimmedString(wf.artifacts.bentleyLaunchSyncedAt);
  if (synced) {
    areas.push(area("post_sync", "ok", `Launch sync recorded at **${synced.slice(0, 19)}Z**.`));
  } else if (srv?.postsForLatestCampaign != null && srv.postsForLatestCampaign > 0) {
    areas.push(
      area(
        "post_sync",
        "unknown",
        `Server reports **${srv.postsForLatestCampaign}** post(s) but session has no sync timestamp — refresh or re-run sync-launch.`
      )
    );
  } else if (dbId && !synced) {
    areas.push(
      area(
        "post_sync",
        "blocked",
        "DB campaign exists but **sync-launch did not complete** in this session — posts may be missing or unscheduled."
      )
    );
  } else {
    areas.push(area("post_sync", "unknown", "No post sync evidence in session (run Generate Campaign + sync-launch)."));
  }

  // 5 Launch finalize
  if (done(wf, "launch_ready")) {
    areas.push(area("launch_finalize", "ok", "Launch-ready phase marked complete in workflow."));
  } else {
    areas.push(
      area(
        "launch_finalize",
        "unknown",
        "Launch-ready not marked — may still be preparing deployment (check Launch sections / mismatch panel)."
      )
    );
  }

  // 6 Analytics visibility (prefer operational evaluation when campaign-scoped facts exist)
  if (op) {
    areas.push(
      area(
        "analytics_visibility",
        op.analyticsStatus === "ok"
          ? "ok"
          : op.analyticsStatus === "blocked"
            ? "blocked"
            : op.analyticsStatus === "waiting"
              ? "waiting"
              : "unknown",
        op.analyticsDetail
      )
    );
  } else if (srv?.deploymentFeedbackRows != null) {
    const rows = srv.deploymentFeedbackRows;
    areas.push(
      area(
        "analytics_visibility",
        rows > 0 ? "ok" : "waiting",
        rows > 0
          ? `Deployment feedback store has **${rows}** row(s).`
          : "No deployment feedback rows yet — metrics may still be syncing."
      )
    );
  } else {
    areas.push(area("analytics_visibility", "unknown", "Server feedback row count not supplied — cannot verify analytics path."));
  }

  // 6b Optimization lifecycle (session truth — API transport vs gates)
  const lcOpt = wf.lifecycle?.optimization_ready;
  const lcEx = wf.lifecycle?.optimization_executed;
  if (lcOpt?.status === "blocked" || lcEx?.status === "blocked") {
    areas.push(
      area(
        "optimization_lifecycle",
        "blocked",
        lcOpt?.detail ??
          lcEx?.detail ??
          "Optimization blocked (insufficient data, access, or policy gates) — see Revenue OS optimization panel."
      )
    );
  } else if (lcOpt?.status === "waiting" || lcEx?.status === "waiting") {
    areas.push(
      area(
        "optimization_lifecycle",
        "waiting",
        lcOpt?.detail ??
          lcEx?.detail ??
          "Optimization waiting for metrics or operator action."
      )
    );
  } else if (lcOpt?.status === "ok" && lcEx?.status === "waiting") {
    areas.push(
      area(
        "optimization_lifecycle",
        "waiting",
        lcEx?.detail ??
          "Optimization API may have succeeded but gated execution did not run — not treated as fully executed."
      )
    );
  }

  // 7 Optimization (server counts — distinct from lifecycle band)
  if (srv?.optimizationRunsCount != null) {
    areas.push(
      area(
        "optimization_server",
        srv.optimizationRunsCount > 0 ? "ok" : "waiting",
        srv.optimizationRunsCount > 0
          ? `**${srv.optimizationRunsCount}** optimization run(s) on record.`
          : "No optimization runs yet — need launched posts + metrics for diagnosis."
      )
    );
  } else {
    areas.push(area("optimization_server", "unknown", "Optimization run count not supplied."));
  }

  // 8 Adaptive / autonomous loop
  if (srv?.governanceAuditRows != null) {
    areas.push(
      area(
        "adaptive_execution",
        srv.governanceAuditRows > 0 ? "ok" : "unknown",
        srv.governanceAuditRows > 0
          ? `Autonomous audit has **${srv.governanceAuditRows}** recent row(s).`
          : "No autonomous audit entries in window — assisted execution may not have run."
      )
    );
  } else {
    areas.push(area("adaptive_execution", "unknown", "Autonomous audit count not supplied."));
  }

  const blockedCount =
    areas.filter((a) => a.status === "blocked").length +
    lifecycleBands.filter((b) => b.status === "blocked").length;
  const summaryLine =
    blockedCount === 0
      ? "No hard blockers from supplied state — verify unknowns / waiting bands when aiming for full autonomy."
      : `**${blockedCount}** blocked signal(s) — resolve before treating the run as fully autonomous.`;

  return {
    generatedAt: new Date().toISOString(),
    areas,
    summaryLine,
    blockedCount,
    lifecycleBands,
    operationalBlockers,
  };
}
