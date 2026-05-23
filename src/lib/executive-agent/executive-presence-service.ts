import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { loadAgentIntelligenceFromDatabase } from "@/lib/executive-agent/agent-intelligence-db";
import { buildExecutiveDailyBriefing } from "@/lib/executive-agent/executive-briefing-builder";
import { buildExecutiveCommandForSkipper } from "@/lib/executive-agent/executive-command-service";
import { listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";
import { buildExecutiveWorkflowFabricOverviewForAdmin } from "@/lib/executive-agent/executive-workflow-service";
import {
  deriveExecutiveUrgency,
  deriveOperationalEmotion,
  deriveOperationalOrbState,
  deriveToneMode,
  rankInterruptions,
} from "@/lib/executive-agent/executive-presence-engine";
import { buildExecutivePresenceInterruptions } from "@/lib/executive-agent/executive-presence-interruptions";
import type { ExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-types";
import {
  buildVoiceGuidance,
  composeExecutivePresenceGreeting,
} from "@/lib/executive-agent/executive-presence-voice";
import {
  buildExecutiveSessionTimeline,
  countSessionsSince,
} from "@/lib/executive-agent/executive-session-timeline";
import {
  formatSessionContinuityForPrompt,
  getLastExecutiveSessionCheckpoint,
  loadExecutiveSessionPreferences,
  recordExecutiveSessionCheckpoint,
} from "@/lib/executive-agent/executive-session-memory";

type Db = MySql2Database<typeof schema>;

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

export async function buildExecutivePresenceSnapshot(
  db: Db,
  adminUserId: number,
  opts?: { recordCheckIn?: boolean },
): Promise<ExecutivePresenceSnapshot> {
  const now = new Date();
  const generatedAt = now.toISOString();

  const [command, briefing, approvals, workflow, agents, lastCheckpoint, prefs] = await Promise.all([
    safe(() => buildExecutiveCommandForSkipper(db, { adminUserId, limit: 12 })),
    safe(() => buildExecutiveDailyBriefing(db, adminUserId, { now })),
    safe(() => listExecutiveApprovals(db, { adminUserId, status: "pending", limit: 50 })),
    safe(() => buildExecutiveWorkflowFabricOverviewForAdmin(db, { adminUserId })),
    safe(() => loadAgentIntelligenceFromDatabase(db)),
    getLastExecutiveSessionCheckpoint(db, adminUserId),
    loadExecutiveSessionPreferences(db, adminUserId),
  ]);

  const pendingApprovals = approvals?.length ?? command?.deskSnapshot?.pendingApprovals ?? 0;
  const criticalAlerts = command?.deskSnapshot?.criticalAlerts ?? 0;
  const crisisLevel = command?.crisisLevel ?? "normal";
  const escalationSurge = command?.escalationSurge ?? false;
  const eventCount = command?.eventCount ?? 0;
  const kpiDriftScore = command?.kpiDriftScore ?? 0;
  const stalledOrders = command?.deskSnapshot?.stalledOrders ?? 0;

  const workflowPaused =
    workflow?.workflows?.filter((w) => w.paused).map((w) => ({
      id: w.workflowId,
      title: w.title,
      detail: w.pausedRationale ?? "Workflow paused — resume requires authorization.",
    })) ?? [];
  const degradedIds = new Set(
    (workflow?.continuitySignals ?? []).filter((s) => s.risk === "degraded" || s.risk === "broken").map((s) => s.workflowId),
  );
  const workflowAtRisk =
    workflow?.workflows
      ?.filter((w) => degradedIds.has(w.workflowId) || w.continuityScore < 55)
      .map((w) => ({
        id: w.workflowId,
        title: w.title,
        detail:
          workflow?.continuitySignals?.find((s) => s.workflowId === w.workflowId)?.gaps?.[0] ??
          "Continuity degradation detected.",
      })) ?? [];

  const signals = {
    crisisLevel,
    pendingApprovals,
    criticalAlerts,
    escalationSurge,
    eventCount,
    kpiDriftScore,
    stalledOrders,
    workflowPausedCount: workflowPaused.length,
    workflowAtRiskCount: workflowAtRisk.length,
    topIncidentTitle: command?.topIncident?.title ?? null,
    topIncidentSeverity: command?.topIncident?.severity ?? null,
  };

  const urgency = deriveExecutiveUrgency(signals);
  const emotion = deriveOperationalEmotion(urgency, signals);
  const toneMode = deriveToneMode(urgency, crisisLevel);
  const orbState = deriveOperationalOrbState(urgency, signals);

  const operatorOverload =
    command?.topAlerts
      ?.filter((a) => a.title.toLowerCase().includes("overload"))
      .map((a) => ({ label: a.title, detail: a.rationale })) ?? [];

  const interruptions = rankInterruptions(
    buildExecutivePresenceInterruptions({
      topIncident: command?.topIncident
        ? {
            title: command.topIncident.title,
            severity: command.topIncident.severity,
            summary: command.topIncident.summary,
          }
        : null,
      topAlerts: command?.topAlerts ?? [],
      pendingApprovals,
      escalationSurge,
      campaignDegradation: (command?.topAlerts ?? []).some((a) =>
        a.title.toLowerCase().includes("campaign"),
      ),
      campaignDegradationDetail:
        command?.topAlerts?.find((a) => a.title.toLowerCase().includes("campaign"))?.rationale ?? "",
      workflowAtRisk,
      workflowPaused,
      operatorOverload,
    }),
  );

  const criticalRisks = (briefing?.risks ?? []).slice(0, 4).map((r) => r.title);
  const activeIncidents = command?.topIncident
    ? [command.topIncident.title]
    : (briefing?.priorities ?? []).slice(0, 2).map((p) => p.title);
  const workflowBottlenecks =
    workflow?.topBottlenecks?.slice(0, 3).map((b) => b.label) ??
    interruptions.filter((i) => i.kind === "workflow_risk").map((i) => i.title);

  const topRecommendedAction =
    briefing?.suggestedFirstActions?.[0]?.title ??
    interruptions[0]?.routeHint ??
    command?.topAlerts?.[0]?.title ??
    null;

  const postureHeadline =
    urgency === "critical"
      ? "Critical executive posture — multiple high-severity signals on the desk."
      : urgency === "urgent"
        ? "Urgent coordination required — incidents or escalations need your attention."
        : urgency === "elevated"
          ? "Elevated watch — approvals, drift, or workflow friction detected."
          : "Desk is steady — monitoring operators, workflows, and agent desks.";

  const postureDetail = command?.skipperSummary ?? postureHeadline;

  const activeEntities = (agents ?? [])
    .filter((a) => a.agentKey !== "executive_admin")
    .slice(0, 6)
    .map((a) => ({
      id: a.agentKey,
      label: a.displayName,
      role: a.agentKey,
      status:
        a.status === "online" ? ("online" as const) : a.status === "degraded" ? ("watch" as const) : ("unknown" as const),
      lastSignal: a.lastActivityAt ?? null,
    }));

  activeEntities.push({
    id: "jarva",
    label: "Jarva",
    role: "trust_desk",
    status: "watch",
    lastSignal: null,
  });

  const priorPending = lastCheckpoint?.pendingApprovals ?? pendingApprovals;
  const approvalDelta = pendingApprovals - priorPending;

  const timeline = buildExecutiveSessionTimeline({
    now: generatedAt,
    lastCheckpoint,
    incidents: activeIncidents,
    newEscalations: escalationSurge ? ["Escalation surge detected since last check-in."] : [],
    approvalDelta,
    resolvedSinceLast: [],
    operatorShifts: operatorOverload.map((o) => o.detail),
    workflowChanges: [
      ...workflowPaused.map((w) => `Paused workflow: ${w.title}`),
      ...workflowAtRisk.map((w) => `At-risk workflow: ${w.title}`),
    ],
    sessionNote: opts?.recordCheckIn ? "Executive check-in recorded." : null,
  });

  const partial = {
    toneMode,
    urgency,
    postureHeadline,
    criticalRisks,
    activeIncidents,
    workflowBottlenecks,
    topRecommendedAction,
    activeEntities,
    sessionContinuity: {
      lastCheckInAt: lastCheckpoint?.checkedInAt ?? null,
      sessionsSinceLastCheckIn: countSessionsSince(lastCheckpoint),
      preferenceNotes: prefs.preferenceNotes,
      priorityPatterns: prefs.priorityPatterns,
    },
  };

  const greetingBriefing = composeExecutivePresenceGreeting(partial);
  const voiceBase = buildVoiceGuidance({ urgency });

  const snapshot: ExecutivePresenceSnapshot = {
    generatedAt,
    toneMode,
    urgency,
    emotion,
    orbState,
    postureHeadline,
    postureDetail,
    criticalRisks,
    activeIncidents,
    workflowBottlenecks,
    topRecommendedAction,
    interruptions,
    activeEntities,
    timeline,
    sessionContinuity: partial.sessionContinuity,
    voiceGuidance: {
      greetingBriefing,
      ...voiceBase,
    },
    governance: {
      monitoringOnly: true,
      approvalsRequired: true,
      noAutonomousExecution: true,
    },
  };

  if (opts?.recordCheckIn) {
    await recordExecutiveSessionCheckpoint(db, adminUserId, {
      postureSummary: postureHeadline,
      orbState,
      urgency,
      pendingApprovals,
      openIncidents: activeIncidents.length,
      topAction: topRecommendedAction,
    });
  }

  return snapshot;
}

export async function formatExecutivePresenceContext(
  db: Db,
  adminUserId: number,
  prompt: string,
): Promise<string> {
  const [snapshot, lastCheckpoint, prefs] = await Promise.all([
    buildExecutivePresenceSnapshot(db, adminUserId),
    getLastExecutiveSessionCheckpoint(db, adminUserId),
    loadExecutiveSessionPreferences(db, adminUserId),
  ]);

  const continuity = formatSessionContinuityForPrompt({
    lastCheckpoint,
    preferenceNotes: prefs.preferenceNotes,
    priorityPatterns: prefs.priorityPatterns,
  });

  const parts = [
    `Executive presence (${snapshot.toneMode}, urgency=${snapshot.urgency}, orb=${snapshot.orbState}): ${snapshot.postureHeadline}`,
    snapshot.topRecommendedAction ? `Top recommended action: ${snapshot.topRecommendedAction}` : "",
    snapshot.interruptions.length
      ? `Active interruptions: ${snapshot.interruptions
          .slice(0, 4)
          .map((i) => `${i.title} (${i.severity})`)
          .join("; ")}.`
      : "",
    snapshot.activeEntities.length
      ? `Active desks: ${snapshot.activeEntities.map((e) => `${e.label}(${e.status})`).join(", ")}.`
      : "",
    continuity,
    prompt.trim() ? `User focus: ${prompt.trim().slice(0, 400)}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}
