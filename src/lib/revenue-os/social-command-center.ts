/**
 * Bentley Social Command Center — aggregates planner, intelligence, inbox, approvals,
 * reports, and execution readiness without duplicating core operator/publish logic.
 */

import type { ConnectorRoutingStatus, RoutedTargetPlan } from "@/lib/revenue-os/distribution-routing";
import { routeDistributionTargets } from "@/lib/revenue-os/distribution-routing";
import {
  fetchDistributionQueueState,
  fetchDistributionQueueTargetsForQueues,
  type DistributionQueueRow,
} from "@/lib/revenue-os/distribution-queue-actions";
import {
  getConnectedPublishingProfiles,
  getPublishingCapabilityMatrix,
} from "@/lib/revenue-os/platform-connectors";
import {
  buildBentleyOperatorOverview,
  buildEmptyOperatorOverview,
  type BentleyOperatorOverview,
} from "@/lib/revenue-os/operator-intelligence";
import { discoverOperatorWorkspaces, type OperatorWorkspaceKey } from "@/lib/revenue-os/operator-workspaces";
import { fetchPublishingWorkflowOperationalSnapshot } from "@/lib/revenue-os/workflow-operational-fetch";
import { getLeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import { fetchLatestMarketSweepForWorkspace } from "@/lib/revenue-os/persist-market-intelligence";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import { buildAutonomousApprovalUiPayload } from "@/lib/revenue-os/autonomous-approval-ui";
import { buildBentleyOperatorDigest } from "@/lib/revenue-os/operator-digest";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { buildProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";
import { buildBentleyExecutiveReport } from "@/lib/revenue-os/executive-report";
import { listLeadSignalInboxRows, groupLeadSignalInboxByLane, type LeadSignalInboxRow } from "@/lib/revenue-os/lead-signal-inbox";
import { fetchLeadHandoffSummary } from "@/lib/revenue-os/lead-handoff";
import {
  buildNotificationDashboardUiPayload,
  buildNotificationEscalationGuidance,
} from "@/lib/revenue-os/notification-dashboard-ui";
import { plannerColumnKeyForItem, type PlannerColumnKey } from "@/lib/revenue-os/planner-column-keys";
import {
  explainBentleyQueueAction,
  explainLeadInboxRow,
  explainBentleyGrowthGuidance,
  explainBentleyDecision,
} from "@/lib/revenue-os/explainability-engine";
import {
  buildPolicyWorkbenchGuidanceLines,
  mergePolicyWorkbenchGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/policy-workbench-guidance";
import { buildBentleyRolloutCoaching } from "@/lib/revenue-os/rollout-coaching";
import {
  buildRolloutGuidanceLines,
  mergeRolloutGuidanceIntoGrowthGuidance,
  mergeRolloutMonitoringGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/rollout-guidance";
import { getBentleyRolloutMonitoringSnapshot } from "@/lib/revenue-os/rollout-monitoring";
import { getLatestSavedRollbackPackageForUser } from "@/lib/revenue-os/policy-rollback-db";
import { mergeRollbackPackageGuidanceIntoGrowthGuidance } from "@/lib/revenue-os/rollback-guidance";
import {
  buildDeploymentGuidanceLines,
  mergeDeploymentGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/deployment-guidance";

export type { PlannerColumnKey };
export { plannerColumnKeyForItem };

export type CommandCenterSection =
  | "all"
  | "planner"
  | "intelligence"
  | "inbox"
  | "approvals"
  | "reports"
  | "accounts";

export type BentleyPlannerCard = {
  queueId: string;
  title: string;
  platform: string;
  contentType: string;
  column: PlannerColumnKey;
  queueStatus: string;
  approvalStatus: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishObjectiveLine: string;
  routingWarning: string | null;
  bentleyWhyLine: string;
  experimentBadge: string | null;
  priorityBadge: string | null;
  connectorReady: boolean;
  workspaceLabel: string;
  /** Explainability — UI-ready copy for “Why?” surfaces. */
  whyBentleySaysThis?: string;
  confidenceNote?: string;
  keySignals?: string[];
  blockerSummary?: string | null;
};

export type BentleyKpiCard = {
  id: string;
  label: string;
  value: number;
  hint: string;
  focusSection: CommandCenterSection;
  whyBentleySaysThis?: string;
  confidenceNote?: string;
  keySignals?: string[];
  blockerSummary?: string | null;
};

export type BentleySocialCommandCenterPayload = {
  kpis: BentleyKpiCard[];
  filters: { clientId: string | null; trustId: string | null };
  planner: {
    columns: Record<PlannerColumnKey, BentleyPlannerCard[]>;
    calendarItems: Array<{
      queueId: string;
      title: string;
      at: string | null;
      column: PlannerColumnKey;
      platform: string;
    }>;
    workflowSummaryLine: string;
    cadenceSummaryLine: string | null;
  };
  intelligence: {
    marketIntelligence: { title: string; lines: string[] };
    contentPatterns: { title: string; lines: string[] };
    gapsOpportunities: { title: string; lines: string[] };
    bentleyRecommendation: { title: string; lines: string[] };
    sweepGeneratedAt: string | null;
    growthGuidance: GrowthGuidance | null;
  };
  inbox: {
    lanes: ReturnType<typeof groupLeadSignalInboxByLane>;
    rows: LeadSignalInboxRow[];
    leadSummaryLine: string | null;
    handoffSummary: { totalOpen: number; byStatus: Record<string, number> } | null;
  };
  approvals: {
    autonomous: Awaited<ReturnType<typeof buildAutonomousApprovalUiPayload>>;
    contentApprovalPendingCount: number;
    summaryLine: string;
    whyBentleySaysThis?: string;
    confidenceNote?: string;
    keySignals?: string[];
    blockerSummary?: string | null;
  };
  reports: {
    dailyOperator: Awaited<ReturnType<typeof buildBentleyExecutiveReport>> | null;
    weeklyExecutive: Awaited<ReturnType<typeof buildBentleyExecutiveReport>> | null;
    digest: ReturnType<typeof buildBentleyOperatorDigest>;
    exceptions: ReturnType<typeof detectBentleyExceptions>;
    proactiveLine: string | null;
    notificationWidgets: Awaited<ReturnType<typeof buildNotificationDashboardUiPayload>>;
    notificationEscalation: Awaited<ReturnType<typeof buildNotificationEscalationGuidance>>;
  };
  accounts: {
    connectorCoverageLine: string | null;
    connectedPlatforms: string[];
    autoPublishReadyCount: number;
    manualFallbackCount: number;
    blockedTargetsCount: number;
    recommendedConnectorAction: string | null;
    matrixSummaryLine: string | null;
    whyBentleySaysThis?: string;
    confidenceNote?: string;
    keySignals?: string[];
    blockerSummary?: string | null;
  };
  generatedAt: string;
};

const EMPTY_COLUMNS = (): Record<PlannerColumnKey, BentleyPlannerCard[]> => ({
  draft: [],
  approval_needed: [],
  scheduled: [],
  published: [],
  failed: [],
  retry: [],
  suppressed: [],
  manual_export: [],
});

function sectionLoads(full: CommandCenterSection | undefined, part: CommandCenterSection): boolean {
  if (!full || full === "all") return true;
  return full === part;
}

function worstRoutingForQueue(targets: RoutedTargetPlan[]): ConnectorRoutingStatus | null {
  if (!targets.length) return null;
  const st = targets.map((t) => t.routingStatus);
  if (st.includes("requires_manual_export")) return "requires_manual_export";
  if (st.includes("blocked_capability_mismatch")) return "blocked_capability_mismatch";
  if (st.includes("blocked_no_connector")) return "blocked_no_connector";
  if (st.includes("ready")) return "ready";
  return targets[0]?.routingStatus ?? null;
}

function bentleyWhyLine(q: DistributionQueueRow): string {
  const parts: string[] = [];
  if (q.promotionReason?.trim()) parts.push(`Cadence optimization: ${q.promotionReason.trim().slice(0, 160)}`);
  if (q.winningSignalSource?.trim()) parts.push(`Winner / signal: ${q.winningSignalSource.trim().slice(0, 120)}`);
  if (q.experimentId) parts.push("Experiment variant — retest or scale based on performance.");
  if (q.lastOptimizationAction?.trim()) parts.push(`Last optimization: ${q.lastOptimizationAction.trim().slice(0, 120)}`);
  if (!parts.length) return "Bentley queued this asset for cadence alignment and distribution coverage.";
  return parts.join(" ");
}

function publishObjectiveLine(q: DistributionQueueRow): string {
  const w = q.workflowNote?.trim();
  if (w) return w.slice(0, 220);
  return `Publish objective: ${q.contentType || "content"} on ${q.platform || "platform"}.`;
}

function routingWarningFromTargets(targets: RoutedTargetPlan[]): string | null {
  const w = targets.flatMap((t) => t.routingWarnings ?? []);
  if (!w.length) return null;
  return [...new Set(w)].slice(0, 3).join(" · ").slice(0, 400);
}

async function fetchQueuesForScope(
  userId: string,
  clientId: string | undefined,
  trustId: string | undefined
): Promise<DistributionQueueRow[]> {
  if (clientId != null && trustId != null) {
    return fetchDistributionQueueState({ userId, clientId, trustId, limit: 220 });
  }
  const workspaces = await discoverOperatorWorkspaces({ userId });
  const out: DistributionQueueRow[] = [];
  for (const w of workspaces) {
    const rows = await fetchDistributionQueueState({
      userId,
      clientId: w.clientId,
      trustId: w.trustId,
      limit: 90,
    });
    out.push(...rows);
  }
  return out.slice(0, 280);
}

async function routeAllQueueItems(
  userId: string,
  items: DistributionQueueRow[]
): Promise<Map<string, RoutedTargetPlan[]>> {
  const byScope = new Map<string, DistributionQueueRow[]>();
  for (const q of items) {
    const k = `${q.clientId}\0${q.trustId}`;
    const list = byScope.get(k) ?? [];
    list.push(q);
    byScope.set(k, list);
  }
  const byQueue = new Map<string, RoutedTargetPlan[]>();
  for (const [, qList] of byScope) {
    const queueIds = qList.map((q) => q.id);
    if (!queueIds.length) continue;
    const targets = await fetchDistributionQueueTargetsForQueues({ queueIds });
    const clientId = qList[0]?.clientId ?? "";
    const profiles = await getConnectedPublishingProfiles({ userId, clientId });
    const matrix = getPublishingCapabilityMatrix(profiles);
    const routing = routeDistributionTargets({
      distributionPlan: null,
      connectedProfiles: profiles,
      capabilityMatrix: matrix,
      queueItems: qList,
      targets,
      publishingObjective: null,
    });
    for (const rt of routing.routedTargets) {
      const cur = byQueue.get(rt.queueId) ?? [];
      cur.push(rt);
      byQueue.set(rt.queueId, cur);
    }
  }
  return byQueue;
}

function workspaceLabel(clientId: string, trustId: string): string {
  const c = clientId?.trim() || "—";
  const t = trustId?.trim() || "—";
  if (!clientId?.trim() && !trustId?.trim()) return "Global";
  return `${c}/${t}`;
}

async function aggregateLeadSummary(
  userId: string,
  workspaces: OperatorWorkspaceKey[],
  maxWs: number
): Promise<{ highIntent: number; handoffReady: number; total: number }> {
  let highIntent = 0;
  let handoffReady = 0;
  let total = 0;
  for (const w of workspaces.slice(0, maxWs)) {
    const s = await getLeadSignalSummary({ userId, clientId: w.clientId, trustId: w.trustId });
    highIntent += s.highIntentSignals;
    handoffReady += s.handoffReadyLeads;
    total += s.totalSignals;
  }
  return { highIntent, handoffReady, total };
}

export async function buildBentleySocialCommandCenter(input: {
  userId: string;
  clientId?: string;
  trustId?: string;
  section?: CommandCenterSection;
  includeHeavyReports?: boolean;
}): Promise<{ commandCenter: BentleySocialCommandCenterPayload; generatedAt: string }> {
  const uid = String(input.userId ?? "").trim();
  const nowIso = new Date().toISOString();
  const clientId = input.clientId?.trim() || null;
  const trustId = input.trustId?.trim() || null;
  const sec = input.section ?? "all";
  const heavy = input.includeHeavyReports !== false;

  const emptyOv = buildEmptyOperatorOverview("");
  const emptyPayload: BentleySocialCommandCenterPayload = {
    kpis: [],
    filters: { clientId, trustId },
    planner: {
      columns: EMPTY_COLUMNS(),
      calendarItems: [],
      workflowSummaryLine: "Sign in to load planner.",
      cadenceSummaryLine: null,
    },
    intelligence: {
      marketIntelligence: { title: "Market Intelligence", lines: [] },
      contentPatterns: { title: "Content Patterns", lines: [] },
      gapsOpportunities: { title: "Gaps & Opportunities", lines: [] },
      bentleyRecommendation: { title: "Bentley Recommendation", lines: [] },
      sweepGeneratedAt: null,
      growthGuidance: null,
    },
    inbox: { lanes: groupLeadSignalInboxByLane([]), rows: [], leadSummaryLine: null, handoffSummary: null },
    approvals: {
      autonomous: await buildAutonomousApprovalUiPayload({ userId: "", generatedAt: nowIso }),
      contentApprovalPendingCount: 0,
      summaryLine: "",
    },
    reports: {
      dailyOperator: null,
      weeklyExecutive: null,
      digest: buildBentleyOperatorDigest({ overview: emptyOv }),
      exceptions: detectBentleyExceptions({ overview: emptyOv }),
      proactiveLine: null,
      notificationWidgets: await buildNotificationDashboardUiPayload({ userId: "", generatedAt: nowIso }),
      notificationEscalation: await buildNotificationEscalationGuidance({ userId: "", lastEngineRun: null }),
    },
    accounts: {
      connectorCoverageLine: null,
      connectedPlatforms: [],
      autoPublishReadyCount: 0,
      manualFallbackCount: 0,
      blockedTargetsCount: 0,
      recommendedConnectorAction: null,
      matrixSummaryLine: null,
    },
    generatedAt: nowIso,
  };

  if (!uid) {
    return { commandCenter: { ...emptyPayload, generatedAt: nowIso }, generatedAt: nowIso };
  }

  const workspaces = await discoverOperatorWorkspaces({
    userId: uid,
    clientIds: clientId ? [clientId] : undefined,
    trustIds: trustId ? [trustId] : undefined,
  });

  const primaryWorkspace: OperatorWorkspaceKey | null =
    clientId != null && trustId != null
      ? { clientId, trustId }
      : workspaces[0] ?? null;

  let overview: BentleyOperatorOverview = await buildBentleyOperatorOverview({
    userId: uid,
    clientIds: clientId ? [clientId] : undefined,
    trustIds: trustId ? [trustId] : undefined,
  });

  const needQueueData =
    sec === "all" ||
    sectionLoads(sec, "planner") ||
    sectionLoads(sec, "accounts") ||
    sectionLoads(sec, "approvals");
  const queueItems = needQueueData ? await fetchQueuesForScope(uid, clientId ?? undefined, trustId ?? undefined) : [];

  const routingByQueue = needQueueData ? await routeAllQueueItems(uid, queueItems) : new Map<string, RoutedTargetPlan[]>();

  const columns = EMPTY_COLUMNS();
  const calendarItems: BentleySocialCommandCenterPayload["planner"]["calendarItems"] = [];

  for (const q of queueItems) {
    if (q.queueStatus === "archived") continue;
    const rts = routingByQueue.get(q.id) ?? [];
    const wr = worstRoutingForQueue(rts);
    const col = plannerColumnKeyForItem({ queue: q, worstRouting: wr });
    const exQ = explainBentleyQueueAction({ queue: q, routedTargets: rts, plannerColumn: col });
    const card: BentleyPlannerCard = {
      queueId: q.id,
      title: q.title || "(untitled)",
      platform: q.platform || "—",
      contentType: q.contentType || "—",
      column: col,
      queueStatus: q.queueStatus,
      approvalStatus: q.approvalStatus,
      scheduledFor: q.scheduledFor?.toISOString?.() ?? null,
      publishedAt: q.publishedAt?.toISOString?.() ?? null,
      publishObjectiveLine: publishObjectiveLine(q),
      routingWarning: routingWarningFromTargets(rts),
      bentleyWhyLine: bentleyWhyLine(q),
      experimentBadge: q.experimentId ? "Experiment" : null,
      priorityBadge:
        q.publishPriority != null
          ? `P${q.publishPriority}`
          : q.cadencePriority != null
            ? `Cadence ${q.cadencePriority}`
            : null,
      connectorReady: wr === "ready",
      workspaceLabel: workspaceLabel(q.clientId, q.trustId),
      whyBentleySaysThis: exQ.decisionSummary,
      confidenceNote: exQ.confidenceNote,
      keySignals: exQ.weightsAndSignals.map((w) => w.signal),
      blockerSummary: exQ.blockers.length ? exQ.blockers.join(" · ") : null,
    };
    columns[col].push(card);
    const at = q.scheduledFor ?? q.publishedAt;
    calendarItems.push({
      queueId: q.id,
      title: card.title,
      at: at?.toISOString?.() ?? null,
      column: col,
      platform: card.platform,
    });
  }

  let sweepSnap: Awaited<ReturnType<typeof fetchLatestMarketSweepForWorkspace>> = null;
  if (primaryWorkspace) {
    sweepSnap = await fetchLatestMarketSweepForWorkspace({
      userId: uid,
      clientId: primaryWorkspace.clientId,
      trustId: primaryWorkspace.trustId,
    });
  }

  let workflowOperational = null as Awaited<ReturnType<typeof fetchPublishingWorkflowOperationalSnapshot>> | null;
  if (primaryWorkspace && (sectionLoads(sec, "planner") || sec === "all")) {
    const leadSum = await getLeadSignalSummary({
      userId: uid,
      clientId: primaryWorkspace.clientId,
      trustId: primaryWorkspace.trustId,
    });
    const gg = sweepSnap?.result.growthGuidance;
    workflowOperational = await fetchPublishingWorkflowOperationalSnapshot({
      userId: uid,
      clientId: primaryWorkspace.clientId,
      trustId: primaryWorkspace.trustId,
      leadSignalSummary: leadSum,
      growthGuidance: gg ?? undefined,
      intelligenceDiff: sweepSnap?.result.intelligenceDiff ?? undefined,
      persistRouting: false,
    });
  }

  const wfSummary = workflowOperational?.workflow.workflowSummary ?? "No publishing workflow snapshot for this scope.";
  const cadenceLine = workflowOperational?.cadencePlan?.cadenceSummary ?? overview.workspaceSummaries[0]?.cadenceSummary ?? null;

  const sweep = sweepSnap?.result;
  const scored = sweep?.scoredInsights;
  const gg = sweep?.growthGuidance ?? null;
  const ggExplain = explainBentleyGrowthGuidance({ guidance: gg });
  const pwLines = await buildPolicyWorkbenchGuidanceLines({
    userId: uid,
    clientId: primaryWorkspace?.clientId ?? clientId ?? undefined,
    trustId: primaryWorkspace?.trustId ?? trustId ?? undefined,
  });

  const intelLines = {
    marketIntelligence: {
      title: "Market Intelligence",
      lines: [
        ...(sweep?.trendingTopics?.slice(0, 6).map((t) => `Rising topic: ${t}`) ?? []),
        ...(sweep?.competitorAngles?.slice(0, 4).map((t) => `Market angle: ${t}`) ?? []),
        ...(sweep?.realSignalsSummary ? [sweep.realSignalsSummary.slice(0, 400)] : []),
      ].filter(Boolean),
    },
    contentPatterns: {
      title: "Content Patterns",
      lines: [
        ...(scored?.viralHooks?.slice(0, 5).map((x) => x.text) ?? []),
        ...(scored?.commentInsights?.slice(0, 4).map((x) => x.text) ?? []),
        ...(sweep?.viralHooks?.slice(0, 4).map((h) => `Hook direction: ${h}`) ?? []),
      ].filter(Boolean),
    },
    gapsOpportunities: {
      title: "Gaps & Opportunities",
      lines: [
        ...(sweep?.contentGaps?.slice(0, 6).map((g) => `Gap: ${g}`) ?? []),
        ...(scored?.contentGaps?.slice(0, 4).map((x) => x.text) ?? []),
        ...(sweep?.painPoints?.slice(0, 4).map((p) => `Pain point: ${p}`) ?? []),
      ].filter(Boolean),
    },
    bentleyRecommendation: {
      title: "Bentley Recommendation",
      lines: [
        gg?.recommendedNextMove,
        gg?.why,
        gg?.bestHookDirection ? `Best hook direction: ${gg.bestHookDirection}` : undefined,
        sweep?.nextAction ? `${sweep.nextAction.action}: ${sweep.nextAction.reason}` : undefined,
        overview.recommendedFocus,
      ].filter((x): x is string => Boolean(x)),
    },
  };

  let inboxRows: LeadSignalInboxRow[] = [];
  if (sectionLoads(sec, "inbox") || sec === "all") {
    if (primaryWorkspace) {
      if (clientId && trustId) {
        inboxRows = await listLeadSignalInboxRows({
          userId: uid,
          clientId,
          trustId,
          limit: 200,
        });
      } else {
        for (const w of workspaces.slice(0, 10)) {
          inboxRows.push(
            ...(await listLeadSignalInboxRows({
              userId: uid,
              clientId: w.clientId,
              trustId: w.trustId,
              limit: 40,
            }))
          );
        }
        inboxRows = inboxRows
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
          .slice(0, 200);
      }
    }
  }

  inboxRows = inboxRows.map((r) => {
    const ex = explainLeadInboxRow({
      commercialIntentScore: r.commercialIntentScore,
      handoffReadiness: r.handoffReadiness,
      signalClass: r.signalClass,
      handoffStatus: r.handoffStatus,
    });
    return {
      ...r,
      whyBentleySaysThis: ex.decisionSummary,
      confidenceNote: ex.confidenceNote,
      keySignals: ex.keyInputs.map((k) => `${k.label}:${k.value}`),
      blockerSummary: ex.blockers.length ? ex.blockers.join(" · ") : null,
    };
  });

  const leadAgg =
    workspaces.length > 0
      ? await aggregateLeadSummary(uid, workspaces, 10)
      : { highIntent: 0, handoffReady: 0, total: 0 };

  let handoffSm = null as Awaited<ReturnType<typeof fetchLeadHandoffSummary>> | null;
  if (primaryWorkspace && (sectionLoads(sec, "inbox") || sec === "all")) {
    handoffSm = await fetchLeadHandoffSummary({
      userId: uid,
      clientId: primaryWorkspace.clientId,
      trustId: primaryWorkspace.trustId,
    });
  }

  const contentApprovalPending = queueItems.filter(
    (q) => q.queueStatus === "draft" && q.approvalStatus === "pending"
  ).length;

  const autonomousApprovalUi =
    sectionLoads(sec, "approvals") || sec === "all"
      ? await buildAutonomousApprovalUiPayload({
          userId: uid,
          generatedAt: overview.generatedAt,
          clientId: clientId ?? undefined,
          trustId: trustId ?? undefined,
        })
      : await buildAutonomousApprovalUiPayload({ userId: uid, generatedAt: overview.generatedAt });

  const baseGrowthGuidance: GrowthGuidance | null = gg
    ? {
        ...gg,
        bentleyExplainabilitySummaryLine: ggExplain.decisionSummary.slice(0, 400),
        bentleyTopDecisionRationaleLine: (ggExplain.whyChosen[0] ?? gg.recommendedNextMove).slice(0, 400),
      }
    : null;
  const rolloutCoaching = buildBentleyRolloutCoaching({
    overview,
    autonomousApprovalPendingCount: autonomousApprovalUi.pendingApprovals.length,
  });
  const rolloutMonitoring = await getBentleyRolloutMonitoringSnapshot({ userId: uid, overview });
  const rollbackPkg = await getLatestSavedRollbackPackageForUser({ userId: uid });
  const deploymentLines = await buildDeploymentGuidanceLines({ userId: uid });
  const growthGuidancePayload = mergeDeploymentGuidanceIntoGrowthGuidance(
    mergeRollbackPackageGuidanceIntoGrowthGuidance(
      mergeRolloutMonitoringGuidanceIntoGrowthGuidance(
        mergeRolloutGuidanceIntoGrowthGuidance(
          mergePolicyWorkbenchGuidanceIntoGrowthGuidance(baseGrowthGuidance, pwLines),
          buildRolloutGuidanceLines(rolloutCoaching)
        ),
        rolloutMonitoring
      ),
      rollbackPkg
    ),
    deploymentLines
  );

  const digest = buildBentleyOperatorDigest({ overview });
  const exceptions = detectBentleyExceptions({ overview });
  const proactive =
    sectionLoads(sec, "reports") || sec === "all"
      ? await buildProactiveAutomationGuidance({
          userId: uid,
          clientId: clientId ?? undefined,
          trustId: trustId ?? undefined,
          overview,
        })
      : null;

  let dailyRep = null as Awaited<ReturnType<typeof buildBentleyExecutiveReport>> | null;
  let weeklyRep = null as Awaited<ReturnType<typeof buildBentleyExecutiveReport>> | null;
  if (heavy && (sectionLoads(sec, "reports") || sec === "all")) {
    [dailyRep, weeklyRep] = await Promise.all([
      buildBentleyExecutiveReport({ userId: uid, mode: "daily_operator_report", clientId: clientId ?? undefined, trustId: trustId ?? undefined, overview }),
      buildBentleyExecutiveReport({ userId: uid, mode: "weekly_executive_report", clientId: clientId ?? undefined, trustId: trustId ?? undefined, overview }),
    ]);
  }

  const notificationWidgets = await buildNotificationDashboardUiPayload({
    userId: uid,
    generatedAt: overview.generatedAt,
  });
  const notificationEscalation = await buildNotificationEscalationGuidance({
    userId: uid,
    lastEngineRun: null,
  });

  const primaryWsSummary = overview.workspaceSummaries[0];
  let profilePlatforms: string[] = [];
  if (primaryWorkspace) {
    try {
      const profiles = await getConnectedPublishingProfiles({
        userId: uid,
        clientId: primaryWorkspace.clientId,
      });
      const matrix = getPublishingCapabilityMatrix(profiles);
      profilePlatforms = matrix.connectedPlatforms.map((p) => String(p));
    } catch {
      profilePlatforms = [];
    }
  }
  const accountsBlock = {
    connectorCoverageLine: gg?.connectorCoverageSummary ?? null,
    connectedPlatforms: profilePlatforms,
    autoPublishReadyCount: primaryWsSummary?.connectorAutoPublishReady ?? 0,
    manualFallbackCount: gg?.manualFallbackCount ?? 0,
    blockedTargetsCount: overview.globalSummary.totalBlockedTargets,
    recommendedConnectorAction: gg?.recommendedConnectorAction ?? null,
    matrixSummaryLine: gg?.connectorGapSummary ?? null,
  };

  // Refine accounts from routing on primary workspace when available
  if (primaryWorkspace && routingByQueue.size) {
    let manual = 0;
    let blocked = 0;
    for (const [, rts] of routingByQueue) {
      for (const rt of rts) {
        if (rt.routingStatus === "requires_manual_export") manual += 1;
        if (rt.routingStatus === "blocked_no_connector" || rt.routingStatus === "blocked_capability_mismatch") blocked += 1;
      }
    }
    if (manual || blocked) {
      accountsBlock.manualFallbackCount = manual;
      accountsBlock.blockedTargetsCount = Math.max(accountsBlock.blockedTargetsCount, blocked);
    }
  }

  const accExplain = explainBentleyDecision({
    subject: "Connector execution readiness",
    summary: `Connected platforms: ${profilePlatforms.length}; blocked targets (aggregate): ${overview.globalSummary.totalBlockedTargets}.`,
    whyChosen: [
      accountsBlock.recommendedConnectorAction ?? "Review OAuth scopes and platform coverage.",
      accountsBlock.matrixSummaryLine ?? "",
    ].filter(Boolean),
    confidenceNote: "Routing uses capability matrix + live queue targets — explainability is heuristic.",
    recommendedHumanReview: (accountsBlock.blockedTargetsCount ?? 0) > 0,
  });
  Object.assign(accountsBlock, {
    whyBentleySaysThis: accExplain.decisionSummary,
    confidenceNote: accExplain.confidenceNote,
    keySignals: profilePlatforms.slice(0, 12),
    blockerSummary:
      (accountsBlock.blockedTargetsCount ?? 0) > 0
        ? `${accountsBlock.blockedTargetsCount} connector-blocked target(s)`
        : null,
  });

  const kpis: BentleyKpiCard[] = [
    {
      id: "publish_ready",
      label: "Publish-ready assets",
      value: workflowOperational?.workflow.readyToPublish.length ?? 0,
      hint: "Cadence optimization & scheduled publish queue.",
      focusSection: "planner",
      whyBentleySaysThis: "Derived from publishing workflow bucket (ready to publish).",
      confidenceNote: "Requires connector-ready routing for unattended execution.",
      keySignals: ["workflow.readyToPublish"],
      blockerSummary: null,
    },
    {
      id: "approval_queue",
      label: "Approval queue",
      value: autonomousApprovalUi.pendingApprovals.length + contentApprovalPending,
      hint: "Autonomous actions + content approvals.",
      focusSection: "approvals",
      whyBentleySaysThis: "Sum of autonomous pending approvals and content drafts awaiting approval.",
      confidenceNote: "Governed autonomy — severity and policy thresholds apply.",
      keySignals: ["autonomous_approval", "content_approval"],
      blockerSummary: null,
    },
    {
      id: "high_intent",
      label: "Lead intent (high)",
      value: leadAgg.highIntent,
      hint: "Lead intent signals across workspaces.",
      focusSection: "inbox",
      whyBentleySaysThis: "Count of high commercial-intent lead signals in lookback window.",
      confidenceNote: "Lead intent extraction from stored signals.",
      keySignals: ["commercial_intent"],
      blockerSummary: null,
    },
    {
      id: "handoff_ready",
      label: "Handoff ready",
      value: leadAgg.handoffReady,
      hint: "Handoff-ready lead signals.",
      focusSection: "inbox",
      whyBentleySaysThis: "Signals at or above handoff readiness threshold.",
      confidenceNote: "Sales-aware routing — not generic inbox volume.",
      keySignals: ["handoff_readiness"],
      blockerSummary: null,
    },
    {
      id: "failed_publishes",
      label: "Failed publishes",
      value: overview.globalSummary.totalFailedPublishes,
      hint: "Retry or revise failed distribution.",
      focusSection: "planner",
      whyBentleySaysThis: "Aggregate failed publish rows across scoped workspaces.",
      confidenceNote: "Check connector health and creative before auto-retry policies.",
      keySignals: ["queue.failed"],
      blockerSummary: null,
    },
    {
      id: "connector_blocks",
      label: "Connector blocks",
      value: overview.globalSummary.totalBlockedTargets,
      hint: "Connector execution readiness & OAuth coverage.",
      focusSection: "accounts",
      whyBentleySaysThis: "Targets blocked by missing connector or capability mismatch.",
      confidenceNote: "Improve OAuth or use manual export fallbacks.",
      keySignals: ["routing.blocked"],
      blockerSummary: null,
    },
    {
      id: "winners_promote",
      label: "Winners awaiting promotion",
      value: overview.workspaceSummaries.reduce((a, s) => a + s.promotionReadyCount, 0),
      hint: "Cadence optimization — promote validated assets.",
      focusSection: "planner",
      whyBentleySaysThis: "Cadence engine surfaced promotion-ready slots from experiments + performance.",
      confidenceNote: "Promote when sample size and connector readiness allow.",
      keySignals: ["cadence.promotion"],
      blockerSummary: null,
    },
    {
      id: "critical_exceptions",
      label: "Critical exceptions",
      value: exceptions.criticalExceptions.length,
      hint: "Operator intelligence — exceptions & escalations.",
      focusSection: "reports",
      whyBentleySaysThis: "Exception detector on operator overview and workspace health.",
      confidenceNote: "Review digest and notifications for remediation.",
      keySignals: ["exceptions.critical"],
      blockerSummary: null,
    },
  ];

  const approvalSummaryLine = [
    autonomousApprovalUi.pendingApprovals.length
      ? `${autonomousApprovalUi.pendingApprovals.length} autonomous action(s) await approval.`
      : "",
    contentApprovalPending ? `${contentApprovalPending} content item(s) need publish approval.` : "",
  ]
    .filter(Boolean)
    .join(" ") || "No pending approvals in this scope.";

  const apprExplain = explainBentleyDecision({
    subject: "Approval queue",
    summary: approvalSummaryLine,
    whyChosen: [
      autonomousApprovalUi.pendingApprovals.length
        ? "Autonomous actions met severity or policy gates requiring human approval."
        : "",
      contentApprovalPending ? "Publishing workflow still requires explicit content approval for drafts." : "",
    ].filter(Boolean),
    recommendedHumanReview: autonomousApprovalUi.pendingApprovals.length > 0 || contentApprovalPending > 0,
  });

  const payload: BentleySocialCommandCenterPayload = {
    kpis,
    filters: { clientId, trustId },
    planner: {
      columns,
      calendarItems: calendarItems.slice(0, 120),
      workflowSummaryLine: wfSummary,
      cadenceSummaryLine: cadenceLine,
    },
    intelligence: {
      ...intelLines,
      sweepGeneratedAt: sweepSnap?.createdAt ?? null,
      growthGuidance: growthGuidancePayload,
    },
    inbox: {
      lanes: groupLeadSignalInboxByLane(inboxRows),
      rows: inboxRows,
      leadSummaryLine:
        leadAgg.total > 0
          ? `${leadAgg.total} lead signal(s); ${leadAgg.highIntent} high-intent; ${leadAgg.handoffReady} handoff-ready.`
          : null,
      handoffSummary: handoffSm,
    },
    approvals: {
      autonomous: autonomousApprovalUi,
      contentApprovalPendingCount: contentApprovalPending,
      summaryLine: approvalSummaryLine,
      whyBentleySaysThis: apprExplain.decisionSummary,
      confidenceNote: apprExplain.confidenceNote,
      keySignals: ["policy.require_approval", "workflow.content_approval"],
      blockerSummary: contentApprovalPending ? `${contentApprovalPending} content approval(s) pending` : null,
    },
    reports: {
      dailyOperator: dailyRep,
      weeklyExecutive: weeklyRep,
      digest,
      exceptions,
      proactiveLine:
        proactive == null
          ? null
          : [proactive.reportStatusLine, proactive.topEscalationLine, proactive.overdueAutomationSummary]
              .filter(Boolean)
              .join(" | ")
              .slice(0, 800) || null,
      notificationWidgets,
      notificationEscalation,
    },
    accounts: accountsBlock,
    generatedAt: overview.generatedAt,
  };

  return { commandCenter: payload, generatedAt: overview.generatedAt };
}
