/**
 * Runs Bentley automation policies (due sweep + single policy execution).
 */

import type { AutomationPolicyRow } from "@/lib/revenue-os/automation-policies-db";
import {
  completeAutomationRun,
  getAutomationPolicyForUser,
  insertAutomationRun,
  listAutomationPoliciesForUser,
  updatePolicyRunSchedule,
} from "@/lib/revenue-os/automation-policies-db";
import {
  computeNextAutomationRunAt,
  shouldRunAutomationPolicy,
  summarizeAutomationRunResult,
  type AutomationPolicyType,
} from "@/lib/revenue-os/automation-policy-helpers";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import {
  persistOperatorSnapshot,
  overviewToSummaryJson,
  executiveReportToSummaryJson,
} from "@/lib/revenue-os/operator-snapshot-persist";
import { executeBentleyCadenceRun } from "@/lib/revenue-os/execute-cadence-run";
import { fetchDistributionQueueState } from "@/lib/revenue-os/distribution-queue-actions";
import { syncPublishedQueuePerformance } from "@/lib/revenue-os/post-publication-sync";
import { buildBentleyExecutiveReport } from "@/lib/revenue-os/executive-report";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";

export type AutomationEngineRunResult = {
  policyId: string;
  policyType: string;
  runId: string;
  ok: boolean;
  dryRun: boolean;
  runStatus: "completed" | "partial" | "failed" | "skipped";
  summary: Record<string, unknown>;
  error?: string;
};

export type AutomationSweepResult = {
  dryRun: boolean;
  nowMs: number;
  results: AutomationEngineRunResult[];
  skippedCount: number;
};

function asPolicyType(raw: string): AutomationPolicyType {
  const allowed: AutomationPolicyType[] = [
    "daily_operator_summary",
    "daily_cadence_run",
    "retry_failed_publish",
    "stale_backlog_cleanup",
    "lead_handoff_watch",
    "unsynced_post_watch",
    "connector_gap_watch",
    "weekly_executive_report",
  ];
  return (allowed.includes(raw as AutomationPolicyType) ? raw : "daily_operator_summary") as AutomationPolicyType;
}

async function executePolicyBody(input: {
  userId: string;
  policy: AutomationPolicyRow;
  dryRun: boolean;
  nowMs: number;
}): Promise<{ ok: boolean; summary: Record<string, unknown> }> {
  const uid = input.userId;
  const p = input.policy;
  const clientId = p.clientId ?? "";
  const trustId = p.trustId ?? "";
  const dry = input.dryRun;
  const cfg = (p.policyConfigJson as Record<string, unknown> | null) ?? {};
  const policyType = asPolicyType(p.policyType);

  const scopeFilters = {
    clientIds: clientId ? [clientId] : undefined,
    trustIds: trustId ? [trustId] : undefined,
  };

  switch (policyType) {
    case "daily_operator_summary": {
      const overview = await buildBentleyOperatorOverview({ userId: uid, ...scopeFilters });
      if (!dry) {
        await persistOperatorSnapshot({
          userId: uid,
          snapshotType: "daily_digest",
          scopeJson: { clientId, trustId, policyId: p.id },
          summaryJson: overviewToSummaryJson(overview),
        });
      }
      return { ok: true, summary: { kind: "daily_operator_summary", systemHealthScore: overview.systemHealthScore, dryRun: dry } };
    }
    case "weekly_executive_report": {
      const overviewForReport = await buildBentleyOperatorOverview({ userId: uid, ...scopeFilters });
      const report = await buildBentleyExecutiveReport({
        userId: uid,
        mode: "weekly_executive_report",
        clientId: clientId || undefined,
        trustId: trustId || undefined,
        overview: overviewForReport,
      });
      if (!dry) {
        await persistOperatorSnapshot({
          userId: uid,
          snapshotType: "global_summary",
          scopeJson: { clientId, trustId, policyId: p.id, mode: "weekly_executive_report" },
          summaryJson: executiveReportToSummaryJson(report as unknown as Record<string, unknown>),
        });
      }
      return { ok: true, summary: { kind: "weekly_executive_report", headline: report.headline, dryRun: dry } };
    }
    case "daily_cadence_run": {
      const r = await executeBentleyCadenceRun({
        userId: uid,
        clientId,
        trustId,
        runType: "daily_refresh",
        dryRun: dry,
      });
      return {
        ok: true,
        summary: {
          kind: "daily_cadence_run",
          cadenceRunId: r.cadenceRunId,
          runPersisted: r.runPersisted,
          queueUpdates: r.queueUpdates,
          dryRun: dry,
        },
      };
    }
    case "retry_failed_publish": {
      const r = await executeBentleyCadenceRun({
        userId: uid,
        clientId,
        trustId,
        runType: "retry_failed",
        dryRun: dry,
      });
      return {
        ok: true,
        summary: { kind: "retry_failed_publish", cadenceRunId: r.cadenceRunId, dryRun: dry },
      };
    }
    case "stale_backlog_cleanup": {
      const r = await executeBentleyCadenceRun({
        userId: uid,
        clientId,
        trustId,
        runType: "stale_cleanup",
        dryRun: dry,
      });
      return {
        ok: true,
        summary: { kind: "stale_backlog_cleanup", cadenceRunId: r.cadenceRunId, dryRun: dry },
      };
    }
    case "lead_handoff_watch": {
      const overview = await buildBentleyOperatorOverview({ userId: uid, ...scopeFilters });
      const ex = detectBentleyExceptions({ overview });
      return {
        ok: true,
        summary: {
          kind: "lead_handoff_watch",
          exceptionSummary: ex.exceptionSummary,
          critical: ex.criticalExceptions.length,
          dryRun: dry,
        },
      };
    }
    case "unsynced_post_watch": {
      const items = await fetchDistributionQueueState({
        userId: uid,
        clientId,
        trustId,
        limit: 80,
      });
      const unsynced = items.filter(
        (q) =>
          q.queueStatus === "published" &&
          q.performanceSyncStatus !== "synced" &&
          q.lastSyncedAt == null
      );
      const maxSync = typeof cfg.maxSyncPerRun === "number" ? cfg.maxSyncPerRun : 5;
      let synced = 0;
      for (const q of unsynced.slice(0, maxSync)) {
        if (dry) {
          synced++;
          continue;
        }
        const s = await syncPublishedQueuePerformance({
          userId: uid,
          clientId,
          trustId,
          queueId: q.id,
          metrics: {},
        });
        if (s.ok) synced++;
      }
      return {
        ok: true,
        summary: {
          kind: "unsynced_post_watch",
          candidates: unsynced.length,
          synced,
          dryRun: dry,
        },
      };
    }
    case "connector_gap_watch": {
      const overview = await buildBentleyOperatorOverview({ userId: uid, ...scopeFilters });
      if (!dry) {
        await persistOperatorSnapshot({
          userId: uid,
          snapshotType: "workspace_summary",
          scopeJson: { clientId, trustId, policyId: p.id, watch: "connector_gap" },
          summaryJson: {
            ...overviewToSummaryJson(overview),
            blockedTargets: overview.globalSummary.totalBlockedTargets,
          },
        });
      }
      return {
        ok: true,
        summary: {
          kind: "connector_gap_watch",
          blockedTargets: overview.globalSummary.totalBlockedTargets,
          dryRun: dry,
        },
      };
    }
    default:
      return { ok: false, summary: { kind: "unknown", policyType } };
  }
}

async function runOnePolicy(input: {
  userId: string;
  policy: AutomationPolicyRow;
  dryRun: boolean;
  force?: boolean;
  nowMs: number;
}): Promise<AutomationEngineRunResult> {
  const p = input.policy;
  const policyType = asPolicyType(p.policyType);
  const dry = input.dryRun;

  if (!p.isEnabled && !input.force) {
    const runIns = await insertAutomationRun({
      policyId: p.id,
      runStatus: "skipped",
      runSummaryJson: { reason: "policy_disabled", dryRun: dry },
      completedAt: new Date(),
    });
    return {
      policyId: p.id,
      policyType: p.policyType,
      runId: runIns.ok ? runIns.id : "",
      ok: true,
      dryRun: dry,
      runStatus: "skipped",
      summary: { reason: "policy_disabled" },
    };
  }

  const due = shouldRunAutomationPolicy({
    isEnabled: p.isEnabled,
    nextRunAt: p.nextRunAt,
    lastRunAt: p.lastRunAt,
    nowMs: input.nowMs,
    force: input.force,
  });
  if (!due) {
    const runIns = await insertAutomationRun({
      policyId: p.id,
      runStatus: "skipped",
      runSummaryJson: { reason: "not_due", dryRun: dry },
      completedAt: new Date(),
    });
    return {
      policyId: p.id,
      policyType: p.policyType,
      runId: runIns.ok ? runIns.id : "",
      ok: true,
      dryRun: dry,
      runStatus: "skipped",
      summary: { reason: "not_due" },
    };
  }

  const started = await insertAutomationRun({
    policyId: p.id,
    runStatus: "started",
    runSummaryJson: { dryRun: dry },
    startedAt: new Date(),
  });

  try {
    if (!started.ok) {
      return {
        policyId: p.id,
        policyType: p.policyType,
        runId: "",
        ok: false,
        dryRun: dry,
        runStatus: "failed",
        summary: { reason: "run_insert_failed" },
      };
    }
    const body = await executePolicyBody({
      userId: input.userId,
      policy: p,
      dryRun: dry,
      nowMs: input.nowMs,
    });
    const ok = body.ok;
    const runStatus: AutomationEngineRunResult["runStatus"] = ok ? "completed" : "failed";
    const summaryJson = {
      ...body.summary,
      dryRun: dry,
      message: summarizeAutomationRunResult({ policyType, ok, dryRun: dry, detail: body.summary }),
    };
    await completeAutomationRun({
      runId: started.id,
      runStatus,
      runSummaryJson: summaryJson,
    });
    if (!dry && ok) {
      const next = computeNextAutomationRunAt({
        policyType,
        lastRunAt: new Date(input.nowMs),
        scheduleJson: (p.scheduleJson as Record<string, unknown> | null) ?? undefined,
        nowMs: input.nowMs,
      });
      await updatePolicyRunSchedule({
        userId: input.userId,
        policyId: p.id,
        lastRunAt: new Date(input.nowMs),
        nextRunAt: next,
      });
    }
    return {
      policyId: p.id,
      policyType: p.policyType,
      runId: started.id,
      ok,
      dryRun: dry,
      runStatus,
      summary: summaryJson,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const safe = { error: err.slice(0, 2000), dryRun: dry };
    if (started.ok) {
      await completeAutomationRun({
        runId: started.id,
        runStatus: "failed",
        runSummaryJson: safe,
      });
    }
    return {
      policyId: p.id,
      policyType: p.policyType,
      runId: started.ok ? started.id : "",
      ok: false,
      dryRun: dry,
      runStatus: "failed",
      summary: safe,
      error: err,
    };
  }
}

export async function runBentleyAutomationPolicy(input: {
  userId: string;
  policyId: string;
  dryRun?: boolean;
  force?: boolean;
}): Promise<AutomationEngineRunResult> {
  const uid = String(input.userId).trim();
  const policy = await getAutomationPolicyForUser({ userId: uid, policyId: input.policyId });
  if (!policy) {
    return {
      policyId: input.policyId,
      policyType: "unknown",
      runId: "",
      ok: false,
      dryRun: Boolean(input.dryRun),
      runStatus: "failed",
      summary: { reason: "policy_not_found" },
    };
  }
  const nowMs = Date.now();
  return runOnePolicy({
    userId: uid,
    policy,
    dryRun: Boolean(input.dryRun),
    force: input.force ?? true,
    nowMs,
  });
}

export async function runBentleyAutomationSweep(input: {
  userId: string;
  clientId?: string;
  trustId?: string;
  dryRun?: boolean;
  policyIds?: string[];
  force?: boolean;
}): Promise<AutomationSweepResult> {
  const uid = String(input.userId).trim();
  const dry = Boolean(input.dryRun);
  const nowMs = Date.now();
  const policies = await listAutomationPoliciesForUser({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
  });
  const allow = input.policyIds?.length ? new Set(input.policyIds) : null;
  const enabled = policies.filter((p) => p.isEnabled && (!allow || allow.has(p.id)));

  const results: AutomationEngineRunResult[] = [];
  let skippedCount = 0;

  for (const p of enabled) {
    const r = await runOnePolicy({
      userId: uid,
      policy: p,
      dryRun: dry,
      force: input.force ?? false,
      nowMs,
    });
    if (r.runStatus === "skipped") skippedCount++;
    results.push(r);
  }

  return { dryRun: dry, nowMs, results, skippedCount };
}
