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
      return `Jarva had desk activity — ${who}${opts.summary}${memory}.`;
    case "reality_activity":
      return `Reality picked up a conversation — ${who}${opts.summary}${memory}.`;
    case "bentley_campaign":
      return `Bentley campaign needs a look — ${opts.summary}${memory}.`;
    case "smart_trust":
      return `Trust desk item — ${opts.summary}${memory}.`;
    case "executive_inbox":
      return `Something new in your inbox — ${opts.summary}${memory}.`;
    case "registration":
    case "onboarding":
      return `Onboarding movement — ${opts.summary}${memory}. I can pull details when you're ready.`;
    case "approval":
      return `Approvals need your eye — ${opts.summary}${memory}. Your call on next steps.`;
    case "workflow":
      return `Workflow friction — ${opts.summary}${memory}.`;
    case "escalation":
      return `Escalation on the desk — ${opts.summary}${memory}.`;
    case "operator":
      return `Operator load is shifting — ${opts.summary}${memory}.`;
    case "kpi":
      return `KPI drift — ${opts.summary}${memory}.`;
    case "governance":
      return `Governance watch — ${opts.summary}${memory}.`;
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
      ? "Heads up, Boss —"
      : mode === "elevated" || mode === "incident"
        ? "Quick note —"
        : "When you have a moment —";
  return `${prefix} ${top.narration}`;
}

export function buildStrategicAdvisory(signal: AmbientExecutiveSignal): string {
  if (signal.severity === "critical" || signal.severity === "high") {
    return `Priority advisory: ${signal.narration} I recommend reviewing this before other desk work.`;
  }
  return `Operational note: ${signal.narration}`;
}
