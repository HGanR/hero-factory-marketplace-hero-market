import type {
  AmbientExecutiveSignal,
  AmbientSignalCategory,
  AmbientSignalSeverity,
} from "@/lib/executive-agent/executive-ambient-signal-types";

const ENTITY_ICON: Record<AmbientSignalCategory, string> = {
  jarva_activity: "🛡️",
  reality_activity: "💬",
  bentley_campaign: "📣",
  smart_trust: "⚖️",
  executive_inbox: "📥",
  registration: "👤",
  approval: "✅",
  workflow: "🔄",
  escalation: "⬆️",
  operator: "👥",
  kpi: "📊",
  governance: "🏛️",
  onboarding: "🚀",
};

export function entityIconForCategory(category: AmbientSignalCategory): string {
  return ENTITY_ICON[category] ?? "📡";
}

export function narrateAmbientSignal(opts: {
  category: AmbientSignalCategory;
  severity: AmbientSignalSeverity;
  summary: string;
  entityLabel?: string | null;
  memoryCorrelation?: string | null;
}): string {
  const who = opts.entityLabel ? `${opts.entityLabel}: ` : "";
  const memory = opts.memoryCorrelation ? ` (${opts.memoryCorrelation})` : "";

  switch (opts.category) {
    case "jarva_activity":
      return `Boss, Jarva desk activity — ${who}${opts.summary}${memory}.`;
    case "reality_activity":
      return `Reality widget signal — ${who}${opts.summary}${memory}.`;
    case "bentley_campaign":
      return `Bentley campaign watch — ${opts.summary}${memory}.`;
    case "smart_trust":
      return `Smart Trust governance — ${opts.summary}${memory}.`;
    case "executive_inbox":
      return `Executive inbox — ${opts.summary}${memory}.`;
    case "registration":
    case "onboarding":
      return `Onboarding signal — ${opts.summary}${memory}. Would you like details when ready.`;
    case "approval":
      return `Approval queue — ${opts.summary}${memory}. Human authorization required.`;
    case "workflow":
      return `Workflow continuity — ${opts.summary}${memory}.`;
    case "escalation":
      return `Escalation advisory — ${opts.summary}${memory}.`;
    case "operator":
      return `Operator workload — ${opts.summary}${memory}.`;
    case "kpi":
      return `KPI drift watch — ${opts.summary}${memory}.`;
    case "governance":
      return `Governance anomaly — ${opts.summary}${memory}.`;
    default:
      return `${opts.summary}${memory}.`;
  }
}

export function buildAmbientVoiceBriefing(signals: AmbientExecutiveSignal[], mode: string): string | null {
  if (!signals.length) return null;
  const top = signals[0]!;
  if (top.severity === "watch" && mode === "calm") return null;
  const prefix =
    top.severity === "critical" || top.severity === "high"
      ? "Boss, heads up —"
      : mode === "elevated" || mode === "incident"
        ? "Boss, situational note —"
        : "Boss, when you have a moment —";
  return `${prefix} ${top.narration}`;
}

export function buildStrategicAdvisory(signal: AmbientExecutiveSignal): string {
  if (signal.severity === "critical" || signal.severity === "high") {
    return `Priority advisory: ${signal.narration} I recommend reviewing this before other desk work.`;
  }
  return `Operational note: ${signal.narration}`;
}
