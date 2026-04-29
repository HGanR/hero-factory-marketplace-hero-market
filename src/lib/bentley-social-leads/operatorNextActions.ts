/**
 * Phase 4F — Next-best-action, bottlenecks, and opportunities (explainable, no automation).
 */

import type { ConversionSummary } from "@/lib/bentley-social-leads/computeConversionSummary";
import type { OutcomeInsight } from "@/lib/bentley-social-leads/conversionOutcomeHints";

export type NextBestAction = {
  title: string;
  detail: string;
  rationale: string;
};

export type OperatorNextActionsBundle = {
  nextBestAction: NextBestAction | null;
  bottlenecks: string[];
  opportunities: string[];
};

export function buildOperatorNextActions(
  summary: ConversionSummary,
  hints: OutcomeInsight[],
  opts?: { contactedCount?: number; newLeadCount?: number }
): OperatorNextActionsBundle {
  const bottlenecks: string[] = [];
  const opportunities: string[] = [];

  if (summary.total === 0) {
    return {
      nextBestAction: {
        title: "Add tracked leads",
        detail: "Ingest engagement CSV or add manual leads so conversion intelligence can rank themes and CTAs.",
        rationale: "No pipeline rows yet — outcomes and recommendations need a baseline.",
      },
      bottlenecks: ["No conversion data to prioritize against."],
      opportunities: ["First attributed wins will set your baseline for lifts and warnings."],
    };
  }

  const contactedRate = summary.contactedRate;
  const bookedRate = summary.bookedRate;

  if (summary.newCount / summary.total > 0.45 && summary.total >= 5) {
    bottlenecks.push(
      `${summary.newCount} of ${summary.total} leads still in “new” — operator touch may be the constraint.`
    );
  }

  if (contactedRate > 0.35 && bookedRate < 0.12 && summary.total >= 8) {
    bottlenecks.push("Healthy contact rate but low booking — review offer clarity and calendar friction.");
  }

  for (const h of hints) {
    if (h.kind === "warning") bottlenecks.push(h.message);
    if (h.kind === "rate_lift" || h.kind === "volume") opportunities.push(h.message);
  }

  if (opportunities.length < 2 && summary.byPlatform[0]) {
    const p = summary.byPlatform[0];
    opportunities.push(`Strongest platform so far: ${p.key} (${(p.bookedRate * 100).toFixed(0)}% booked on ${p.total} leads).`);
  }

  let nextBestAction: NextBestAction | null = null;

  const topHint = hints.find((h) => h.kind === "rate_lift");
  if (topHint) {
    nextBestAction = {
      title: `Double down: ${topHint.dimension}`,
      detail: `Prioritize creative and follow-up aligned with “${topHint.key.slice(0, 72)}”.`,
      rationale: topHint.message,
    };
  } else if (summary.newCount > 0 && (opts?.newLeadCount ?? summary.newCount) >= 3) {
    nextBestAction = {
      title: "Clear the new-lead queue",
      detail: "Work oldest untouched leads first to unlock booking signals.",
      rationale: "Stale “new” rows inflate funnel noise and hide what actually converts.",
    };
  } else if (bottlenecks.length > 0) {
    nextBestAction = {
      title: "Fix the bottleneck",
      detail: bottlenecks[0],
      rationale: "Resolving the top constraint raises the quality of future attribution data.",
    };
  } else {
    nextBestAction = {
      title: "Run the next content experiment",
      detail: "Use “Generate next campaign” to bake winning angles into the Content Engine brief.",
      rationale: "Sustained testing expands the attribution snapshot library for CTA/offer themes.",
    };
  }

  return {
    nextBestAction,
    bottlenecks: bottlenecks.slice(0, 5),
    opportunities: opportunities.slice(0, 6),
  };
}
