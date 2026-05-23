import type {
  ExecutiveInterruption,
  ExecutiveOperationalEmotion,
  ExecutiveToneMode,
  ExecutiveUrgencyLevel,
  OperationalIntelligenceState,
} from "@/lib/executive-agent/executive-presence-types";

export type PresenceSignalInput = {
  crisisLevel: string;
  pendingApprovals: number;
  criticalAlerts: number;
  escalationSurge: boolean;
  eventCount: number;
  kpiDriftScore: number;
  stalledOrders: number;
  workflowPausedCount: number;
  workflowAtRiskCount: number;
  topIncidentTitle: string | null;
  topIncidentSeverity: string | null;
};

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, watch: 0 };

export function deriveExecutiveUrgency(input: PresenceSignalInput): ExecutiveUrgencyLevel {
  if (input.crisisLevel === "critical" || input.criticalAlerts >= 3) return "critical";
  if (input.crisisLevel === "high" || input.escalationSurge || input.criticalAlerts >= 1) return "urgent";
  if (
    input.pendingApprovals >= 3 ||
    input.kpiDriftScore >= 0.5 ||
    input.stalledOrders >= 2 ||
    input.workflowAtRiskCount >= 2
  ) {
    return "elevated";
  }
  return "routine";
}

export function deriveOperationalEmotion(
  urgency: ExecutiveUrgencyLevel,
  input: PresenceSignalInput,
): ExecutiveOperationalEmotion {
  if (input.workflowPausedCount > 0 && urgency !== "critical") return "recovering";
  if (urgency === "critical") return "decisive";
  if (urgency === "urgent") return "concerned";
  if (input.eventCount >= 5 || input.kpiDriftScore >= 0.35) return "watchful";
  if (input.pendingApprovals >= 1 || input.stalledOrders >= 1) return "focused";
  return "steady";
}

export function deriveToneMode(urgency: ExecutiveUrgencyLevel, crisisLevel: string): ExecutiveToneMode {
  if (urgency === "critical" || crisisLevel === "critical") return "crisis_briefing";
  if (urgency === "urgent") return "operations_director";
  if (urgency === "elevated") return "executive_coordinator";
  if (crisisLevel === "medium" || crisisLevel === "high") return "strategic_advisor";
  return "chief_of_staff";
}

export function deriveOperationalOrbState(
  urgency: ExecutiveUrgencyLevel,
  input: PresenceSignalInput,
): OperationalIntelligenceState {
  if (input.workflowPausedCount > 0) return "workflow_recovery";
  if (input.crisisLevel === "critical" || input.crisisLevel === "high") return "crisis_coordination";
  if (input.topIncidentTitle && (SEV_RANK[input.topIncidentSeverity ?? ""] ?? 0) >= 3) return "incident";
  if (input.escalationSurge) return "escalation";
  if (input.pendingApprovals >= 1) return "approval_waiting";
  if (input.kpiDriftScore >= 0.45 || input.workflowAtRiskCount >= 1) return "strategic_analysis";
  if (input.eventCount >= 1) return "monitoring";
  return "idle";
}

export function rankInterruptions(items: ExecutiveInterruption[]): ExecutiveInterruption[] {
  const rank = { critical: 4, high: 3, medium: 2, watch: 1 };
  return [...items].sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));
}

export function mapOrbStateToVisualMode(
  operational: OperationalIntelligenceState,
  voiceOverride?: "listening" | "speaking" | "processing" | "alert" | null,
): "idle" | "listening" | "speaking" | "processing" | "alert" {
  if (voiceOverride) return voiceOverride;
  switch (operational) {
    case "incident":
    case "approval_waiting":
    case "escalation":
    case "crisis_coordination":
      return "alert";
    case "strategic_analysis":
    case "workflow_recovery":
      return "processing";
    case "monitoring":
      return "idle";
    default:
      return "idle";
  }
}

/** Chief-of-staff voice constraint — appended to prompts; no execution grants. */
export const EXECUTIVE_CHIEF_OF_STAFF_VOICE = `EXECUTIVE PRESENCE (Chief of Staff voice):
- Speak as Skipper, the executive operations chief-of-staff — not a generic chatbot or receptionist.
- Use operational realism: name active desks (Bentley, Jarva, Reality, Eleanor), workflows, incidents, and approvals when context provides them.
- Be concise, confident, and human-authorized: recommend actions; never claim execution, spend, publish, or governance mutation without approval.
- Match urgency to the desk: routine = measured briefing; elevated = direct coordinator tone; urgent/critical = operations-director clarity without alarmism.
- Acknowledge interruptions and confirm understanding before deep analysis when the user breaks in mid-flow.
- All guidance remains explainable, auditable, and approval-aware.`;
