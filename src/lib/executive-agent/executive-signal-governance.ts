import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import type {
  AmbientExecutiveSignal,
  ExecutiveAmbientSignalOverview,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import { EXECUTIVE_SIGNAL_GOVERNANCE } from "@/lib/executive-agent/executive-ambient-signal-types";

export { EXECUTIVE_SIGNAL_GOVERNANCE };

type Db = MySql2Database<typeof schema>;

export async function auditExecutiveSignalsSurfaced(
  db: Db,
  adminUserId: number,
  overview: ExecutiveAmbientSignalOverview,
  topSignals: AmbientExecutiveSignal[],
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId,
    prompt: null,
    toolName: "executive.ambient.signals",
    actionType: "ambient_signals_surfaced",
    targetType: "platform",
    inputJson: JSON.stringify({
      presenceMode: overview.presenceMode,
      signalCount: overview.signalCount,
      criticalCount: overview.criticalCount,
      interruptionCount: overview.interruptionCount,
    }).slice(0, 50_000),
    outputJson: JSON.stringify({
      governance: EXECUTIVE_SIGNAL_GOVERNANCE,
      topSignalIds: topSignals.slice(0, 12).map((s) => s.id),
      topCategories: topSignals.slice(0, 6).map((s) => s.category),
    }).slice(0, 50_000),
    approvalStatus: "not_required",
  });
}

export function assertAdvisoryGovernance(signal: AmbientExecutiveSignal): AmbientExecutiveSignal {
  return { ...signal, advisoryOnly: true };
}
