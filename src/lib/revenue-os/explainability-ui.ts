/**
 * UI-ready payloads for explanation cards and side panels.
 */

import type { BentleyExplanation } from "@/lib/revenue-os/explainability-engine";

export type ExplanationCardPayload = {
  title: string;
  summary: string;
  bullets: string[];
  confidence: string;
  reviewRecommended: boolean;
  meta: { label: string; value: string }[];
};

export type ExplainSidePanelPayload = {
  sections: Array<{ heading: string; body: string; items?: string[] }>;
  footerNote: string;
};

export function buildExplanationCardPayload(ex: BentleyExplanation): ExplanationCardPayload {
  return {
    title: ex.subject,
    summary: ex.decisionSummary,
    bullets: [...ex.whyChosen.slice(0, 6), ...ex.policyConstraints.slice(0, 4)].filter(Boolean),
    confidence: ex.confidenceNote,
    reviewRecommended: ex.recommendedHumanReview,
    meta: ex.keyInputs.slice(0, 12),
  };
}

export function buildExplainSidePanelPayload(ex: BentleyExplanation): ExplainSidePanelPayload {
  return {
    sections: [
      { heading: "Why this outcome", body: ex.decisionSummary, items: ex.whyChosen },
      { heading: "What we did not choose", body: ex.whyNotChosen.join(" ") || "—", items: ex.whyNotChosen },
      { heading: "Signals & weights", body: ex.weightsAndSignals.map((w) => `${w.signal}: ${w.weight.toFixed(2)}`).join("\n") },
      { heading: "Blockers", body: ex.blockers.join(" · ") || "None flagged." },
    ],
    footerNote: ex.recommendedHumanReview ? "Human review recommended before production change." : ex.confidenceNote,
  };
}

export function buildRiskSummaryCallout(risks: string[]): { tone: "neutral" | "warn" | "critical"; lines: string[] } {
  if (!risks.length) return { tone: "neutral", lines: ["No elevated risk flags in this simulation."] };
  const critical = risks.some((r) => /critical|block|unsafe/i.test(r));
  return {
    tone: critical ? "critical" : "warn",
    lines: risks.slice(0, 8),
  };
}
