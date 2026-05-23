/** Executive ambient signal intelligence — advisory only; no autonomous execution. */

export type AmbientSignalSeverity = "critical" | "high" | "medium" | "low" | "watch";

export type AmbientSignalCategory =
  | "jarva_activity"
  | "reality_activity"
  | "bentley_campaign"
  | "smart_trust"
  | "executive_inbox"
  | "registration"
  | "approval"
  | "workflow"
  | "escalation"
  | "operator"
  | "kpi"
  | "governance"
  | "onboarding";

export type OperationalPresenceMode =
  | "calm"
  | "active"
  | "elevated"
  | "incident"
  | "crisis"
  | "recovery"
  | "strategic";

export type AmbientExecutiveSignal = {
  id: string;
  category: AmbientSignalCategory;
  severity: AmbientSignalSeverity;
  relevanceScore: number;
  summary: string;
  narration: string;
  entityLabel: string | null;
  entityIcon: string | null;
  occurredAt: string;
  interruptEligible: boolean;
  isInterruption: boolean;
  advisoryOnly: true;
  source: string;
  memoryCorrelation: string | null;
};

export type AmbientOrbTelemetry = {
  intensity: number;
  pulseRate: "slow" | "normal" | "fast";
  escalationDensity: number;
  activeWorkflowCount: number;
  governanceAnomaly: boolean;
  onboardingSpike: boolean;
  dominantSeverity: AmbientSignalSeverity;
};

export type ExecutiveAmbientSignalOverview = {
  generatedAt: string;
  presenceMode: OperationalPresenceMode;
  signalCount: number;
  criticalCount: number;
  interruptionCount: number;
  topNarration: string | null;
  ambientVoiceBriefing: string | null;
  orb: AmbientOrbTelemetry;
  governance: {
    advisoryOnly: true;
    noAutonomousExecution: true;
    noAutoContact: true;
    auditRequired: true;
  };
};

export type ExecutiveAmbientSignalFeed = {
  generatedAt: string;
  events: AmbientExecutiveSignal[];
  advisoryOnly: true;
};

export type AmbientOrbState = {
  presenceOrb: string;
  ambientTelemetry: AmbientOrbTelemetry;
  blendedIntensity: number;
  pulseActive: boolean;
  glowColor: "cyan" | "amber" | "rose" | "violet";
  label: string;
};

export type ExecutiveAmbientSignalSnapshot = {
  overview: ExecutiveAmbientSignalOverview;
  feed: ExecutiveAmbientSignalFeed;
  interruptions: AmbientExecutiveSignal[];
  orbState: AmbientOrbState;
};

export const EXECUTIVE_SIGNAL_GOVERNANCE = {
  advisoryOnly: true as const,
  noAutonomousExecution: true as const,
  noAutoContact: true as const,
  noAutoDecision: true as const,
  noAutoLaunchPublishSpend: true as const,
  auditRequired: true as const,
};
