import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type { ExecutiveAmbientSignalSnapshot } from "@/lib/executive-agent/executive-ambient-signal-types";
import { buildAmbientInterruptions } from "@/lib/executive-agent/ambient-interruption-engine";
import { deriveAmbientOrbState } from "@/lib/executive-agent/ambient-orb-state-engine";
import { buildExecutiveCommandForSkipper } from "@/lib/executive-agent/executive-command-service";
import { buildExecutiveOperationalFeed } from "@/lib/executive-agent/executive-operational-feed";
import {
  auditExecutiveSignalsSurfaced,
} from "@/lib/executive-agent/executive-signal-governance";
import { EXECUTIVE_SIGNAL_GOVERNANCE } from "@/lib/executive-agent/executive-ambient-signal-types";
import { buildAmbientVoiceBriefing } from "@/lib/executive-agent/executive-signal-narration";
import { rankAmbientSignals } from "@/lib/executive-agent/executive-signal-ranking";
import {
  deriveOperationalPresenceMode,
} from "@/lib/executive-agent/operational-presence-state";
import { collectOperationalSignalStream } from "@/lib/executive-agent/operational-signal-stream";
import { deriveOperationalOrbState, deriveExecutiveUrgency } from "@/lib/executive-agent/executive-presence-engine";
import { buildExecutiveWorkflowFabricOverviewForAdmin } from "@/lib/executive-agent/executive-workflow-service";
import { listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";

type Db = MySql2Database<typeof schema>;

export async function buildExecutiveAmbientSignalSnapshot(
  db: Db,
  adminUserId: number,
  opts?: { audit?: boolean },
): Promise<ExecutiveAmbientSignalSnapshot> {
  const [rawSignals, command, workflow, approvals] = await Promise.all([
    collectOperationalSignalStream(db, adminUserId),
    buildExecutiveCommandForSkipper(db, { adminUserId, limit: 12 }).catch(() => null),
    buildExecutiveWorkflowFabricOverviewForAdmin(db, { adminUserId }).catch(() => null),
    listExecutiveApprovals(db, { adminUserId, status: "pending", limit: 50 }).catch(() => []),
  ]);

  const ranked = rankAmbientSignals(rawSignals);
  const interruptions = buildAmbientInterruptions(ranked);
  const feed = buildExecutiveOperationalFeed(ranked);

  const pendingApprovals = approvals.length ?? command?.deskSnapshot?.pendingApprovals ?? 0;
  const criticalCount = ranked.filter((s) => s.severity === "critical").length;
  const highCount = ranked.filter((s) => s.severity === "high").length;
  const crisisLevel = command?.crisisLevel ?? "normal";
  const kpiDriftScore = command?.kpiDriftScore ?? 0;
  const escalationSurge = command?.escalationSurge ?? false;
  const escalationDensity = Math.min(
    1,
    ranked.filter((s) => s.category === "escalation" || s.category === "operator").length /
      Math.max(1, ranked.length),
  );

  const degraded = workflow?.continuitySignals?.filter((s) => s.risk === "degraded" || s.risk === "broken") ?? [];
  const workflowPausedCount = workflow?.workflows?.filter((w) => w.paused).length ?? 0;
  const governanceAnomaly = ranked.some((s) => s.category === "governance" && s.severity !== "watch");

  const presenceInput = {
    criticalCount,
    highCount,
    escalationDensity: escalationSurge ? Math.max(escalationDensity, 0.35) : escalationDensity,
    workflowPausedCount,
    workflowAtRiskCount: degraded.length,
    pendingApprovals,
    governanceAnomaly,
    crisisLevel,
    kpiDriftScore,
  };

  const presenceMode = deriveOperationalPresenceMode(presenceInput);
  const urgency = deriveExecutiveUrgency({
    crisisLevel,
    pendingApprovals,
    criticalAlerts: command?.deskSnapshot?.criticalAlerts ?? criticalCount,
    escalationSurge,
    eventCount: ranked.length,
    kpiDriftScore,
    stalledOrders: command?.deskSnapshot?.stalledOrders ?? 0,
    workflowPausedCount,
    workflowAtRiskCount: degraded.length,
    topIncidentTitle: command?.topIncident?.title ?? null,
    topIncidentSeverity: command?.topIncident?.severity ?? null,
  });

  const presenceOrb = deriveOperationalOrbState(urgency, {
    crisisLevel,
    pendingApprovals,
    criticalAlerts: criticalCount,
    escalationSurge,
    eventCount: ranked.length,
    kpiDriftScore,
    stalledOrders: 0,
    workflowPausedCount,
    workflowAtRiskCount: degraded.length,
    topIncidentTitle: null,
    topIncidentSeverity: null,
  });

  const orbBlend = deriveAmbientOrbState({
    presenceOrb,
    signals: ranked,
    presenceInput,
    presenceMode,
  });

  const overview = {
    generatedAt: new Date().toISOString(),
    presenceMode,
    signalCount: ranked.length,
    criticalCount,
    interruptionCount: interruptions.length,
    topNarration: ranked[0]?.narration ?? null,
    ambientVoiceBriefing: buildAmbientVoiceBriefing(ranked, presenceMode),
    orb: orbBlend.ambientTelemetry,
    governance: EXECUTIVE_SIGNAL_GOVERNANCE,
  };

  if (opts?.audit !== false) {
    await auditExecutiveSignalsSurfaced(db, adminUserId, overview, ranked);
  }

  return {
    overview,
    feed,
    interruptions,
    orbState: orbBlend,
  };
}
