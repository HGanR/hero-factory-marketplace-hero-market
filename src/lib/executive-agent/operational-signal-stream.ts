import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type {
  AmbientExecutiveSignal,
  AmbientSignalCategory,
  AmbientSignalSeverity,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import type { OperationalEvent } from "@/lib/executive-agent/executive-command-types";
import { aggregateOperationalEventStream } from "@/lib/executive-agent/operational-event-stream";
import { buildExecutiveCommandEngineInputForAdmin } from "@/lib/executive-agent/executive-command-service";
import { buildVoiceOperationalSnapshot } from "@/lib/executive-agent/executive-voice-operational-data";
import { buildExecutiveWorkflowFabricOverviewForAdmin } from "@/lib/executive-agent/executive-workflow-service";
import { listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";
import {
  entityIconForCategory,
  narrateAmbientSignal,
} from "@/lib/executive-agent/executive-signal-narration";
import {
  meetsInterruptionThreshold,
  scoreExecutiveRelevance,
} from "@/lib/executive-agent/executive-signal-ranking";
import { correlateSignalMemory } from "@/lib/executive-agent/signal-memory-correlation";

type Db = MySql2Database<typeof schema>;

const EVENT_CATEGORY: Record<string, AmbientSignalCategory> = {
  approval_pending: "approval",
  order_stalled: "kpi",
  task_blocked: "workflow",
  task_overdue: "workflow",
  operator_overload: "operator",
  escalation_proposed: "escalation",
  governance_delay: "governance",
  campaign_at_risk: "bentley_campaign",
  kpi_drift: "kpi",
  audit_signal: "smart_trust",
};

function baseSignal(
  partial: Omit<
    AmbientExecutiveSignal,
    "advisoryOnly" | "interruptEligible" | "isInterruption" | "relevanceScore"
  > & {
    interruptEligible?: boolean;
  },
): AmbientExecutiveSignal {
  const relevanceScore = scoreExecutiveRelevance(partial.severity, partial.category, {
    recencyMs: Date.now() - new Date(partial.occurredAt).getTime(),
    memoryBoost: partial.memoryCorrelation ? 0.15 : 0,
  });
  const signal: AmbientExecutiveSignal = {
    ...partial,
    relevanceScore,
    interruptEligible: partial.interruptEligible ?? false,
    isInterruption: false,
    advisoryOnly: true,
  };
  if (partial.interruptEligible != null) {
    signal.interruptEligible = partial.interruptEligible;
  } else {
    signal.interruptEligible = meetsInterruptionThreshold(signal);
  }
  signal.isInterruption = meetsInterruptionThreshold(signal);
  return signal;
}

function fromOperationalEvent(event: OperationalEvent, memory: string | null): AmbientExecutiveSignal {
  const category = EVENT_CATEGORY[event.kind] ?? "kpi";
  const summary = event.summary;
  return baseSignal({
    id: `ops:${event.id}`,
    category,
    severity: event.severity as AmbientSignalSeverity,
    summary,
    narration: narrateAmbientSignal({
      category,
      severity: event.severity as AmbientSignalSeverity,
      summary,
      memoryCorrelation: memory,
    }),
    entityLabel: event.department,
    entityIcon: entityIconForCategory(category),
    occurredAt: event.occurredAt,
    source: `operational_event:${event.kind}`,
    memoryCorrelation: memory,
  });
}

export async function collectOperationalSignalStream(
  db: Db,
  adminUserId: number,
): Promise<AmbientExecutiveSignal[]> {
  const now = Date.now();
  const [engineInput, voice, workflow, approvals] = await Promise.all([
    buildExecutiveCommandEngineInputForAdmin(db, { adminUserId, limit: 60 }),
    buildVoiceOperationalSnapshot(db),
    buildExecutiveWorkflowFabricOverviewForAdmin(db, { adminUserId }).catch(() => null),
    listExecutiveApprovals(db, { adminUserId, status: "pending", limit: 50 }).catch(() => []),
  ]);

  const eventStream = aggregateOperationalEventStream(engineInput);
  const memoryCtx = await correlateSignalMemory(db, adminUserId, {
    auditActionTypes: engineInput.auditActionTypes,
    workflowContinuity: workflow?.continuitySignals ?? [],
  });

  const signals: AmbientExecutiveSignal[] = eventStream.events.map((e) => {
    const memory = memoryCtx.correlateCategory(EVENT_CATEGORY[e.kind] ?? "kpi");
    return fromOperationalEvent(e, memory);
  });

  for (const row of voice.jarva.slice(0, 8)) {
    const summary = row.conversationSummary || "Jarva session activity today";
    signals.push(
      baseSignal({
        id: `jarva:${row.sessionId}`,
        category: "jarva_activity",
        severity: row.identityStatus === "pending" ? "medium" : "low",
        summary,
        narration: narrateAmbientSignal({
          category: "jarva_activity",
          severity: "low",
          summary,
          entityLabel: row.accountDisplayName,
        }),
        entityLabel: row.accountDisplayName,
        entityIcon: entityIconForCategory("jarva_activity"),
        occurredAt: row.timestamp,
        source: "jarva_conversations",
      }),
    );
  }

  for (const row of voice.reality.slice(0, 8)) {
    const summary = row.conversationSummary || "Reality widget conversation";
    signals.push(
      baseSignal({
        id: `reality:${row.conversationId}`,
        category: "reality_activity",
        severity: "low",
        summary,
        narration: narrateAmbientSignal({
          category: "reality_activity",
          severity: "low",
          summary,
          entityLabel: row.userDisplayName,
        }),
        entityLabel: row.userDisplayName,
        entityIcon: entityIconForCategory("reality_activity"),
        occurredAt: row.timestamp,
        source: "reality_conversations",
      }),
    );
  }

  for (const row of voice.inbox.slice(0, 6)) {
    const summary = row.subjectOrPreview.slice(0, 120);
    signals.push(
      baseSignal({
        id: `inbox:${row.messageId}`,
        category: "executive_inbox",
        severity: row.hasAudioAttachment ? "medium" : "low",
        summary,
        narration: narrateAmbientSignal({
          category: "executive_inbox",
          severity: "low",
          summary,
          entityLabel: row.senderName,
        }),
        entityLabel: row.senderName,
        entityIcon: entityIconForCategory("executive_inbox"),
        occurredAt: row.receivedAt,
        source: "executive_inbox",
      }),
    );
  }

  const regCount = voice.registrations.length;
  if (regCount >= 3) {
    const summary = `${regCount} new registrations today — onboarding spike`;
    signals.push(
      baseSignal({
        id: "registration:spike",
        category: "onboarding",
        severity: regCount >= 8 ? "high" : "medium",
        summary,
        narration: narrateAmbientSignal({ category: "onboarding", severity: "medium", summary }),
        entityLabel: null,
        entityIcon: entityIconForCategory("onboarding"),
        occurredAt: voice.generatedAt,
        source: "new_registrations",
        interruptEligible: regCount >= 8,
      }),
    );
  } else {
    for (const row of voice.registrations.slice(0, 5)) {
      const summary = `New registration: ${row.accountDisplayName}`;
      signals.push(
        baseSignal({
          id: `registration:${row.userId}`,
          category: "registration",
          severity: row.isApproved ? "watch" : "low",
          summary,
          narration: narrateAmbientSignal({ category: "registration", severity: "low", summary }),
          entityLabel: row.accountDisplayName,
          entityIcon: entityIconForCategory("registration"),
          occurredAt: row.createdAt,
          source: "new_registrations",
        }),
      );
    }
  }

  if (approvals.length >= 5) {
    const summary = `Approval backlog accelerating — ${approvals.length} pending executive approvals`;
    signals.push(
      baseSignal({
        id: "approval:backlog",
        category: "approval",
        severity: approvals.length >= 12 ? "high" : "medium",
        summary,
        narration: narrateAmbientSignal({
          category: "approval",
          severity: "medium",
          summary,
          memoryCorrelation: memoryCtx.approvalPattern,
        }),
        entityLabel: null,
        entityIcon: entityIconForCategory("approval"),
        occurredAt: new Date().toISOString(),
        source: "approval_queue",
        memoryCorrelation: memoryCtx.approvalPattern,
        interruptEligible: approvals.length >= 8,
      }),
    );
  }

  for (const cs of workflow?.continuitySignals?.filter((s) => s.risk !== "stable" && s.risk !== "watch") ?? []) {
    const severity: AmbientSignalSeverity =
      cs.risk === "broken" ? "critical" : cs.risk === "degraded" ? "high" : "medium";
    const summary = cs.gaps?.[0] ?? `Workflow continuity ${cs.risk}`;
    signals.push(
      baseSignal({
        id: `workflow:${cs.workflowId}`,
        category: "workflow",
        severity,
        summary,
        narration: narrateAmbientSignal({
          category: "workflow",
          severity,
          summary,
          memoryCorrelation: memoryCtx.workflowPattern,
        }),
        entityLabel: cs.workflowId,
        entityIcon: entityIconForCategory("workflow"),
        occurredAt: new Date(now - cs.continuityScore * 1000).toISOString(),
        source: "workflow_continuity",
        memoryCorrelation: memoryCtx.workflowPattern,
        interruptEligible: severity === "critical" || severity === "high",
      }),
    );
  }

  return signals;
}
