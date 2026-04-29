/**
 * Collects safe operational candidates for the autonomous action engine.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyLeadSignals } from "@/lib/db/schema";
import { fetchDistributionQueueState } from "@/lib/revenue-os/distribution-queue-actions";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { buildPublishingWorkflow } from "@/lib/revenue-os/publishing-workflow";
import type { BentleyAutonomousActionType } from "@/lib/revenue-os/autonomous-types";

export type BentleyAutonomousRiskLevel = "low" | "medium" | "high" | "critical";

export type BentleyAutonomousCandidate = {
  actionType: BentleyAutonomousActionType;
  scope: { clientId: string; trustId: string };
  reason: string;
  riskLevel: BentleyAutonomousRiskLevel;
  confidence: number;
  sourceSystem: string;
  targetIds: string[];
  estimatedImpact: string;
  queueId?: string;
  leadSignalId?: string;
  scheduledForIso?: string;
};

export type CollectBentleyAutonomousCandidatesInput = {
  userId: string;
  clientId?: string;
  trustId?: string;
  /** When set, skip building overview (caller passes precomputed). */
  overview?: import("@/lib/revenue-os/operator-intelligence").BentleyOperatorOverview;
};

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

async function fetchHandoffReadySignalIds(params: {
  userId: string;
  clientId: string;
  trustId: string;
  limit: number;
}): Promise<string[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  try {
    const db = await getDb();
    const since = new Date(Date.now() - LOOKBACK_MS);
    const rows = await db
      .select({ id: bentleyLeadSignals.id, hr: bentleyLeadSignals.handoffReadiness })
      .from(bentleyLeadSignals)
      .where(
        and(
          eq(bentleyLeadSignals.userId, uid),
          eq(bentleyLeadSignals.clientId, params.clientId ?? ""),
          eq(bentleyLeadSignals.trustId, params.trustId ?? ""),
          gte(bentleyLeadSignals.createdAt, since)
        )
      )
      .orderBy(desc(bentleyLeadSignals.createdAt))
      .limit(400);

    const out: string[] = [];
    for (const r of rows) {
      const hr = r.hr != null ? Number(r.hr) : 0;
      if (Number.isFinite(hr) && hr >= 0.62) out.push(r.id);
      if (out.length >= params.limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

function riskFromLevels(base: BentleyAutonomousRiskLevel, bump: number): BentleyAutonomousRiskLevel {
  const order: BentleyAutonomousRiskLevel[] = ["low", "medium", "high", "critical"];
  const i = Math.min(order.length - 1, Math.max(0, order.indexOf(base) + bump));
  return order[i];
}

function defaultScheduleIso(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString();
}

export async function collectBentleyAutonomousCandidates(
  input: CollectBentleyAutonomousCandidatesInput
): Promise<BentleyAutonomousCandidate[]> {
  const uid = String(input.userId).trim();
  if (!uid) return [];

  const overview =
    input.overview ??
    (await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: input.clientId ? [input.clientId] : undefined,
      trustIds: input.trustId ? [input.trustId] : undefined,
    }));

  const ex = detectBentleyExceptions({ overview });
  const hasBlockingCritical = ex.criticalExceptions.some((c) =>
    ["handoff_backlog_critical", "publish_failures", "connector_gap_severe", "priority_workspace_connector_gap"].includes(
      c.code
    )
  );

  const candidates: BentleyAutonomousCandidate[] = [];
  const push = (c: BentleyAutonomousCandidate) => {
    candidates.push(c);
  };

  for (const ws of overview.workspaceSummaries) {
    const clientId = ws.workspace.clientId ?? "";
    const trustId = ws.workspace.trustId ?? "";
    const scope = { clientId, trustId };
    const cadencePlan = ws.cadencePlan;

    let queueItems: Awaited<ReturnType<typeof fetchDistributionQueueState>> = [];
    try {
      queueItems = await fetchDistributionQueueState({
        userId: uid,
        clientId,
        trustId,
        limit: 200,
      });
    } catch {
      continue;
    }

    const workflow = buildPublishingWorkflow({
      distributionPlan: null,
      queueItems,
      cadencePlan: cadencePlan ?? null,
    });

    const rank = overview.prioritization.rankedWorkspaces.findIndex(
      (r) => r.workspace.clientId === clientId && r.workspace.trustId === trustId
    );
    const priorityBoost = rank <= 2 ? 0 : rank <= 6 ? 1 : 2;

    if (cadencePlan) {
      for (const x of cadencePlan.retryNow.slice(0, 8)) {
        push({
          actionType: "auto_retry_failed_publish",
          scope,
          reason: x.reason.slice(0, 400),
          riskLevel: riskFromLevels("medium", priorityBoost),
          confidence: 0.72,
          sourceSystem: "cadence_engine",
          targetIds: [x.queueId],
          queueId: x.queueId,
          estimatedImpact: "Recover failed publish throughput.",
        });
      }
      for (const x of cadencePlan.archiveNow.slice(0, 8)) {
        push({
          actionType: "auto_archive_stale_draft",
          scope,
          reason: x.reason.slice(0, 400),
          riskLevel: riskFromLevels("low", priorityBoost),
          confidence: 0.78,
          sourceSystem: "cadence_engine",
          targetIds: [x.queueId],
          queueId: x.queueId,
          estimatedImpact: "Reduce stale queue clutter.",
        });
      }
      for (const x of cadencePlan.suppressNow.slice(0, 6)) {
        push({
          actionType: "auto_suppress_low_confidence_loser",
          scope,
          reason: x.reason.slice(0, 400),
          riskLevel: riskFromLevels("medium", priorityBoost + 1),
          confidence: 0.65,
          sourceSystem: "cadence_engine",
          targetIds: [x.queueId],
          queueId: x.queueId,
          estimatedImpact: "Pause low-performing variant exposure.",
        });
      }
      for (const x of cadencePlan.blockedOperationally.slice(0, 6)) {
        push({
          actionType: "auto_mark_manual_export_needed",
          scope,
          reason: x.reason.slice(0, 400),
          riskLevel: riskFromLevels("low", priorityBoost),
          confidence: 0.7,
          sourceSystem: "cadence_engine",
          targetIds: [x.queueId],
          queueId: x.queueId,
          estimatedImpact: "Mark blocked routing for manual export path.",
        });
      }
    }

    for (const r of workflow.retryItems.slice(0, 6)) {
      push({
        actionType: "auto_retry_failed_publish",
        scope,
        reason: r.reason.slice(0, 400),
        riskLevel: riskFromLevels("medium", priorityBoost),
        confidence: 0.68,
        sourceSystem: "publishing_workflow",
        targetIds: [r.queueId],
        queueId: r.queueId,
        estimatedImpact: "Retry failed publish from workflow surface.",
      });
    }

    for (const s of workflow.readyToSchedule.slice(0, 6)) {
      if (!cadencePlan?.promoteNow.some((p) => p.queueId === s.queueId)) continue;
      push({
        actionType: "auto_schedule_promoted_winner",
        scope,
        reason: s.reason.slice(0, 400),
        riskLevel: riskFromLevels("medium", priorityBoost),
        confidence: 0.66,
        sourceSystem: "publishing_workflow",
        targetIds: [s.queueId],
        queueId: s.queueId,
        scheduledForIso: defaultScheduleIso(),
        estimatedImpact: "Schedule promoted winner slot.",
      });
    }

    for (const sync of workflow.itemsNeedingPerformanceSync.slice(0, 6)) {
      push({
        actionType: "auto_sync_published_metrics",
        scope,
        reason: sync.reason.slice(0, 400),
        riskLevel: riskFromLevels("low", priorityBoost),
        confidence: 0.74,
        sourceSystem: "publishing_workflow",
        targetIds: [sync.queueId],
        queueId: sync.queueId,
        estimatedImpact: "Backfill performance metrics for experiments.",
      });
    }

    const stale = ws.lastCadenceRunAt
      ? Date.now() - new Date(ws.lastCadenceRunAt).getTime() > 48 * 60 * 60 * 1000
      : ws.queueTotal > 0;
    if (stale && ws.queueTotal > 0) {
      push({
        actionType: "auto_run_cadence",
        scope,
        reason: "Workspace cadence stale or backlog present — refresh plan.",
        riskLevel: riskFromLevels("medium", (hasBlockingCritical ? 1 : 0) + priorityBoost),
        confidence: 0.68,
        sourceSystem: "operator_overview",
        targetIds: [],
        estimatedImpact: "Regenerate cadence recommendations.",
      });
    }

    const signalIds = await fetchHandoffReadySignalIds({
      userId: uid,
      clientId,
      trustId,
      limit: 5,
    });
    for (const sid of signalIds) {
      push({
        actionType: "auto_create_lead_handoff",
        scope,
        reason: "High handoff-readiness lead signal without guaranteed routing.",
        riskLevel: riskFromLevels("high", hasBlockingCritical ? 2 : 0),
        confidence: 0.61,
        sourceSystem: "lead_signals",
        targetIds: [sid],
        leadSignalId: sid,
        estimatedImpact: "Create CRM handoff record for revenue follow-up.",
      });
    }
  }

  if (hasBlockingCritical) {
    for (const c of candidates) {
      if (c.riskLevel === "low") c.riskLevel = "medium";
    }
  }

  const seen = new Set<string>();
  const deduped: BentleyAutonomousCandidate[] = [];
  for (const c of candidates) {
    const k = [
      c.actionType,
      c.scope.clientId,
      c.scope.trustId,
      c.queueId ?? "",
      c.leadSignalId ?? "",
    ].join("|");
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
  }
  return deduped;
}
