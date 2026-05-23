import type {
  AmbientExecutiveSignal,
  ExecutiveAmbientSignalFeed,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import { rankAmbientSignals } from "@/lib/executive-agent/executive-signal-ranking";

export function buildExecutiveOperationalFeed(
  signals: AmbientExecutiveSignal[],
  limit = 40,
): ExecutiveAmbientSignalFeed {
  const events = rankAmbientSignals(signals).slice(0, limit);
  return {
    generatedAt: new Date().toISOString(),
    events,
    advisoryOnly: true,
  };
}

export const SEVERITY_FEED_COLOR: Record<string, string> = {
  critical: "text-rose-300 border-rose-500/40",
  high: "text-orange-200 border-orange-400/35",
  medium: "text-amber-200 border-amber-400/30",
  low: "text-[#00A3FF]/90 border-[#00A3FF]/25",
  watch: "text-slate-400 border-slate-600/30",
};

export const CATEGORY_FEED_LABEL: Record<string, string> = {
  jarva_activity: "Jarva",
  reality_activity: "Reality",
  bentley_campaign: "Bentley",
  smart_trust: "Smart Trust",
  executive_inbox: "Inbox",
  registration: "Registration",
  approval: "Approval",
  workflow: "Workflow",
  escalation: "Escalation",
  operator: "Operator",
  kpi: "KPI",
  governance: "Governance",
  onboarding: "Onboarding",
};
