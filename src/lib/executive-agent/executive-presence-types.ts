/** Skipper executive presence — advisory, governed, auditable. No autonomous execution. */

export type ExecutiveToneMode =
  | "chief_of_staff"
  | "operations_director"
  | "executive_coordinator"
  | "strategic_advisor"
  | "crisis_briefing";

export type ExecutiveUrgencyLevel = "routine" | "elevated" | "urgent" | "critical";

export type ExecutiveOperationalEmotion =
  | "steady"
  | "focused"
  | "concerned"
  | "decisive"
  | "recovering"
  | "watchful";

export type OperationalIntelligenceState =
  | "idle"
  | "monitoring"
  | "incident"
  | "approval_waiting"
  | "escalation"
  | "crisis_coordination"
  | "strategic_analysis"
  | "workflow_recovery";

export type ExecutiveInterruptionKind =
  | "incident"
  | "approval_backlog"
  | "escalation_warning"
  | "workflow_risk"
  | "launch_degradation"
  | "operator_overload";

export type ExecutiveInterruption = {
  id: string;
  kind: ExecutiveInterruptionKind;
  severity: "watch" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  routeHint: string;
  advisoryOnly: true;
  entityRefs: string[];
};

export type ActiveOperationalEntity = {
  id: string;
  label: string;
  role: string;
  status: "online" | "watch" | "blocked" | "unknown";
  lastSignal: string | null;
};

export type ExecutiveSessionTimelineEntry = {
  id: string;
  category:
    | "incident"
    | "escalation"
    | "approval"
    | "operator"
    | "workflow"
    | "resolved"
    | "session";
  summary: string;
  occurredAt: string;
  deltaSinceLastSession: boolean;
};

export type ExecutiveSessionCheckpoint = {
  checkedInAt: string;
  postureSummary: string;
  orbState: OperationalIntelligenceState;
  urgency: ExecutiveUrgencyLevel;
  pendingApprovals: number;
  openIncidents: number;
  topAction: string | null;
};

export type ExecutivePresenceSnapshot = {
  generatedAt: string;
  toneMode: ExecutiveToneMode;
  urgency: ExecutiveUrgencyLevel;
  emotion: ExecutiveOperationalEmotion;
  orbState: OperationalIntelligenceState;
  postureHeadline: string;
  postureDetail: string;
  criticalRisks: string[];
  activeIncidents: string[];
  workflowBottlenecks: string[];
  topRecommendedAction: string | null;
  interruptions: ExecutiveInterruption[];
  activeEntities: ActiveOperationalEntity[];
  timeline: ExecutiveSessionTimelineEntry[];
  sessionContinuity: {
    lastCheckInAt: string | null;
    sessionsSinceLastCheckIn: number;
    preferenceNotes: string[];
    priorityPatterns: string[];
  };
  voiceGuidance: {
    greetingBriefing: string;
    acknowledgementPhrases: string[];
    pacingHint: "measured" | "urgent" | "reassuring";
    interruptHandling: string;
  };
  governance: {
    monitoringOnly: true;
    approvalsRequired: true;
    noAutonomousExecution: true;
  };
};
