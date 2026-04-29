/**
 * Pure helpers: 5-system scores → Bentley strategic copy (no I/O).
 */

import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

export type BentleySystemId = "opportunity" | "offer" | "traffic" | "execution" | "capital";

const SYSTEM_LABELS: Record<BentleySystemId, string> = {
  opportunity: "opportunity validation",
  offer: "offer clarity",
  traffic: "traffic readiness",
  execution: "execution",
  capital: "capital readiness",
};

/** Higher = healthier execution (inverse of stored executionGapScore). */
function executionHealth(gap: number | undefined): number | undefined {
  if (gap === undefined) return undefined;
  return Math.max(0, Math.min(100, 100 - gap));
}

type CompareRow = { id: BentleySystemId; value: number };

function comparableRows(s: RevenueOsSystemSignals): CompareRow[] {
  const rows: CompareRow[] = [];
  if (s.opportunityScore !== undefined) rows.push({ id: "opportunity", value: s.opportunityScore });
  if (s.offerStrengthScore !== undefined) rows.push({ id: "offer", value: s.offerStrengthScore });
  if (s.trafficReadinessScore !== undefined) rows.push({ id: "traffic", value: s.trafficReadinessScore });
  const ex = executionHealth(s.executionGapScore);
  if (ex !== undefined) rows.push({ id: "execution", value: ex });
  if (s.capitalReadinessScore !== undefined) rows.push({ id: "capital", value: s.capitalReadinessScore });
  return rows;
}

export function hasMaterialSystemSignals(s: RevenueOsSystemSignals): boolean {
  return comparableRows(s).length > 0;
}

export type SystemSignalDiagnosticSummary = {
  strongestSystem: BentleySystemId | null;
  weakestSystem: BentleySystemId | null;
  warnings: string[];
  opportunities: string[];
  summaryText: string;
};

export function buildSystemSignalDiagnosticSummary(s: RevenueOsSystemSignals): SystemSignalDiagnosticSummary {
  const rows = comparableRows(s);
  if (rows.length === 0) {
    return {
      strongestSystem: null,
      weakestSystem: null,
      warnings: [],
      opportunities: [],
      summaryText: "Run research, trends, or guided intake so I can score your five systems.",
    };
  }

  let best = rows[0]!;
  let worst = rows[0]!;
  for (const r of rows) {
    if (r.value > best.value) best = r;
    if (r.value < worst.value) worst = r;
  }

  const warnings: string[] = [];
  const opportunities: string[] = [];

  if (s.opportunityScore !== undefined && s.opportunityScore < 45) {
    warnings.push("Opportunity signal is thin — strengthen industry research and demand mapping.");
  } else if (s.opportunityScore !== undefined && s.opportunityScore >= 60) {
    opportunities.push("Demand and audience mapping look solid.");
  }

  if (s.offerStrengthScore !== undefined && s.offerStrengthScore < 45) {
    warnings.push("Offer layer needs work — tighten core offer, transformation, and notes.");
  } else if (s.offerStrengthScore !== undefined && s.offerStrengthScore >= 60) {
    opportunities.push("Offer and transformation are in good shape.");
  }

  if (s.trafficReadinessScore !== undefined && s.trafficReadinessScore < 45) {
    warnings.push("Traffic system is under-built — add platforms and generated content.");
  } else if (s.trafficReadinessScore !== undefined && s.trafficReadinessScore >= 60) {
    opportunities.push("Traffic and content readiness look strong.");
  }

  if (s.executionGapScore !== undefined && s.executionGapScore > 55) {
    warnings.push("Execution gap: inputs exist but the launch sequence is not complete yet.");
  } else if (s.executionGapScore !== undefined && s.executionGapScore <= 40) {
    opportunities.push("Execution pipeline looks relatively complete.");
  }

  if (s.capitalReadinessScore !== undefined && s.capitalReadinessScore < 35) {
    warnings.push("Capital layer is still light — validate unit economics before scaling spend.");
  } else if (s.capitalReadinessScore !== undefined && s.capitalReadinessScore >= 60) {
    opportunities.push("Capital / leverage signals are showing up in your inputs.");
  }

  const parts: string[] = [];
  if (best.id !== worst.id || rows.length > 1) {
    parts.push(
      `Your strongest area right now is **${SYSTEM_LABELS[best.id]}**; the weakest is **${SYSTEM_LABELS[worst.id]}**.`
    );
  } else {
    parts.push(`Focus on **${SYSTEM_LABELS[best.id]}** — that’s where the signal is concentrated.`);
  }

  if (warnings.length) {
    parts.push(warnings[0]!);
  } else if (opportunities.length) {
    parts.push(opportunities[0]!);
  } else {
    parts.push("Keep running the pipeline steps to sharpen each layer.");
  }

  return {
    strongestSystem: best.id,
    weakestSystem: worst.id,
    warnings,
    opportunities,
    summaryText: parts.join(" "),
  };
}

export type SystemSignalNextActions = {
  primaryAction: string;
  secondaryAction?: string;
  recommendedStep: 1 | 2 | 3 | 4 | 5 | null;
};

export function mapSystemSignalsToNextActions(s: RevenueOsSystemSignals): SystemSignalNextActions {
  const opp = s.opportunityScore;
  const offer = s.offerStrengthScore;
  const traffic = s.trafficReadinessScore;
  const gap = s.executionGapScore;
  const cap = s.capitalReadinessScore;

  if (opp !== undefined && opp < 45) {
    return {
      primaryAction: "Go to **Step 3 · Industry & revenue engine** — run Research and Trends to validate demand.",
      secondaryAction: "Add a clear target audience so trends map to buyers.",
      recommendedStep: 3,
    };
  }

  if (offer !== undefined && offer < 45) {
    return {
      primaryAction: "Go to **Step 4** — tighten business name, core offer, transformation, and campaign notes.",
      secondaryAction: "Use Content Engine once the offer is crisp.",
      recommendedStep: 4,
    };
  }

  if (traffic !== undefined && traffic < 45) {
    return {
      primaryAction: "Go to **Step 4 · Content pipeline** — pick platforms and generate launch assets in Content Engine.",
      secondaryAction: "Align posting platforms with where your buyers actually are.",
      recommendedStep: 4,
    };
  }

  if (gap !== undefined && gap > 55) {
    if (opp === undefined || offer === undefined) {
      return {
        primaryAction:
          "Start with **Step 1 · Workflow & handoff** — connect intelligence, then finish guided intake so the pipeline can run end-to-end.",
        secondaryAction: "A wide execution gap with missing core scores usually means handoff or intake never fully landed.",
        recommendedStep: 1,
      };
    }
    return {
      primaryAction:
        "Finish the **content → campaign** sequence in Step 4 — you’re close; the gap is mostly execution completion.",
      secondaryAction: "Say **Run Revenue OS pipeline** if you want me to walk the saved steps.",
      recommendedStep: 4,
    };
  }

  if (cap !== undefined && cap < 35 && (offer !== undefined && offer >= 50)) {
    return {
      primaryAction: "Offer looks workable — read **About this page (Step 5)** for capital and leverage framing before scaling ads.",
      secondaryAction: "Keep CAC and LTV honest in the revenue engine when you add numbers.",
      recommendedStep: 5,
    };
  }

  const defined = [opp, offer, traffic, gap, cap].filter((x) => x !== undefined).length;
  if (
    defined >= 3 &&
    (opp ?? 0) >= 50 &&
    (offer ?? 0) >= 50 &&
    (traffic ?? 0) >= 50 &&
    (gap ?? 0) <= 50
  ) {
    return {
      primaryAction:
        "You’re in **launch posture** — compile your media brief, then use the **Revenue OS Dashboard** for deployment and sequences.",
      secondaryAction: "Optional: say **Open Dashboard** when you’re ready to operate outside this page.",
      recommendedStep: null,
    };
  }

  return {
    primaryAction: "Continue **Step 3 → Step 4** in order: validate demand, then build content and campaign output.",
    recommendedStep: 3,
  };
}

/** Narrative for chat (no raw scores unless debug). */
export function buildBentleyStrategicGuidanceFromSignals(
  signals: RevenueOsSystemSignals,
  opts?: { includeNumericDebug?: boolean }
): string {
  if (!hasMaterialSystemSignals(signals)) {
    return "";
  }
  const diag = buildSystemSignalDiagnosticSummary(signals);
  const next = mapSystemSignalsToNextActions(signals);
  const lines: string[] = [
    "**Five-system read:**",
    diag.summaryText,
    "",
    `**What to do next:** ${next.primaryAction}`,
  ];
  if (next.secondaryAction) lines.push(next.secondaryAction);
  if (next.recommendedStep != null) {
    lines.push(`Suggested focus: **Step ${next.recommendedStep}** in the page jump list.`);
  }

  if (shouldSuggestSevenDayLaunch(signals)) {
    lines.push(
      "",
      "You look **close to launch-ready**. Want a **7-day launch plan** outline next? (Say yes and I’ll keep it tight.)"
    );
  }

  if (opts?.includeNumericDebug) {
    lines.push(
      "",
      `_Debug — scores: opportunity ${signals.opportunityScore ?? "—"}, offer ${signals.offerStrengthScore ?? "—"}, traffic ${signals.trafficReadinessScore ?? "—"}, execution gap ${signals.executionGapScore ?? "—"}, capital ${signals.capitalReadinessScore ?? "—"}_`
    );
  }

  return lines.join("\n");
}

export function shouldSuggestSevenDayLaunch(s: RevenueOsSystemSignals): boolean {
  const opp = s.opportunityScore;
  const offer = s.offerStrengthScore;
  const traffic = s.trafficReadinessScore;
  const gap = s.executionGapScore;
  if (opp === undefined || offer === undefined || traffic === undefined || gap === undefined) return false;
  return opp >= 65 && offer >= 60 && traffic >= 60 && gap <= 55;
}

/** Stable fingerprint for memo/callback deps — only changes when a score field changes. */
export function systemSignalsMaterialKey(s: RevenueOsSystemSignals): string {
  return [
    s.opportunityScore ?? "",
    s.offerStrengthScore ?? "",
    s.trafficReadinessScore ?? "",
    s.executionGapScore ?? "",
    s.capitalReadinessScore ?? "",
  ].join("|");
}

/** One short paragraph for the post-intro chat line (no raw numbers). */
export function buildBentleyInitialDiagnosticPreamble(s: RevenueOsSystemSignals): string | null {
  if (!hasMaterialSystemSignals(s)) return null;
  const d = buildSystemSignalDiagnosticSummary(s);
  let line: string;
  if (d.strongestSystem && d.weakestSystem && d.strongestSystem !== d.weakestSystem) {
    line = `**Quick diagnostic:** your strongest layer is **${SYSTEM_LABELS[d.strongestSystem]}**; the biggest gap to close is **${SYSTEM_LABELS[d.weakestSystem]}**.`;
  } else if (d.strongestSystem) {
    line = `**Quick diagnostic:** signals are still concentrated around **${SYSTEM_LABELS[d.strongestSystem]}** — keep filling the other layers so I can separate strengths from gaps.`;
  } else {
    line = `**Quick diagnostic:** ${d.summaryText}`;
  }
  if (shouldSuggestSevenDayLaunch(s)) {
    line += ` You look close to launch-ready — want me to sketch a **7-day launch plan**?`;
  }
  return line;
}
