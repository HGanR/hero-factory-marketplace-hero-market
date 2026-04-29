/**
 * One-liners for growth guidance / command center from saved policy scenarios (read-only).
 */

import {
  listPolicyScenariosForUser,
  getLatestRunForScenario,
  type PolicyScenarioRow,
} from "@/lib/revenue-os/policy-scenarios-db";
import { compareBentleyScenarios } from "@/lib/revenue-os/scenario-compare";
import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";

/** Payload from `buildPolicyWorkbenchGuidanceLines` — merge into `GrowthGuidance` without rebuilding. */
export type PolicyWorkbenchGuidancePayload = {
  bentleyPolicyWorkbenchSummaryLine?: string;
  bentleyTopScenarioRecommendationLine?: string;
  bentleyScenarioRiskSummaryLine?: string;
  bentleyScenarioCompareSummaryLine?: string;
  bentleyScenarioPresetRecommendationLine?: string;
  bentleyApplyReviewSummaryLine?: string;
};

/**
 * Merges workbench DB-backed lines into sweep (or stub) growth guidance — single client-visible object.
 * Prefer `pw` values when set; preserves `base` otherwise.
 */
export function mergePolicyWorkbenchGuidanceIntoGrowthGuidance(
  base: GrowthGuidance | null,
  pw: PolicyWorkbenchGuidancePayload
): GrowthGuidance | null {
  const hasPw =
    pw.bentleyPolicyWorkbenchSummaryLine ||
    pw.bentleyTopScenarioRecommendationLine ||
    pw.bentleyScenarioRiskSummaryLine ||
    pw.bentleyScenarioCompareSummaryLine ||
    pw.bentleyScenarioPresetRecommendationLine ||
    pw.bentleyApplyReviewSummaryLine;

  if (!base && !hasPw) return null;

  const next: GrowthGuidance = base
    ? { ...base }
    : {
        recommendedNextMove: "Review saved policy scenarios in the workbench.",
        why: "",
        risingTopics: [],
        weakAngles: [],
        bestHookDirection: "",
      };

  next.bentleyPolicyWorkbenchSummaryLine =
    pw.bentleyPolicyWorkbenchSummaryLine ?? next.bentleyPolicyWorkbenchSummaryLine;
  next.bentleyTopScenarioRecommendationLine =
    pw.bentleyTopScenarioRecommendationLine ?? next.bentleyTopScenarioRecommendationLine;
  next.bentleyScenarioRiskSummaryLine = pw.bentleyScenarioRiskSummaryLine ?? next.bentleyScenarioRiskSummaryLine;
  next.bentleyScenarioCompareSummaryLine =
    pw.bentleyScenarioCompareSummaryLine ?? next.bentleyScenarioCompareSummaryLine;
  next.bentleyScenarioPresetRecommendationLine =
    pw.bentleyScenarioPresetRecommendationLine ?? next.bentleyScenarioPresetRecommendationLine;
  next.bentleyApplyReviewSummaryLine = pw.bentleyApplyReviewSummaryLine ?? next.bentleyApplyReviewSummaryLine;

  return next;
}

function lineFromRun(row: PolicyScenarioRow, rec: Record<string, unknown> | null): string | null {
  if (!rec || typeof rec !== "object") return null;
  const title = typeof rec.title === "string" ? rec.title : null;
  const body = typeof rec.body === "string" ? rec.body : null;
  if (title && body) return `${row.name}: ${title} — ${body.slice(0, 220)}`.trim();
  if (title) return `${row.name}: ${title}`.trim();
  return null;
}

export async function buildPolicyWorkbenchGuidanceLines(input: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
}): Promise<PolicyWorkbenchGuidancePayload> {
  const uid = String(input.userId).trim();
  if (!uid) return {};

  const scenarios = await listPolicyScenariosForUser({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
    limit: 5,
    savedOnly: true,
  });
  if (!scenarios.length) return {};

  const withRuns = await Promise.all(
    scenarios.slice(0, 5).map(async (row) => {
      const latest = await getLatestRunForScenario(row.id);
      return { row, latest };
    })
  );

  const first = withRuns[0]!;
  const recJson = first.latest?.recommendationJson;
  const rec =
    recJson && typeof recJson === "object" && recJson !== null && "recommendation" in recJson
      ? (recJson as { recommendation?: Record<string, unknown> }).recommendation ?? null
      : (recJson as Record<string, unknown> | null);
  const topLine = lineFromRun(first.row, rec && typeof rec === "object" ? rec : null);

  const riskParts: string[] = [];
  for (const { row, latest } of withRuns.slice(0, 3)) {
    const rj = latest?.riskSummaryJson;
    if (rj && typeof rj === "object" && "riskFlags" in rj && Array.isArray((rj as { riskFlags: unknown }).riskFlags)) {
      const rf = (rj as { riskFlags: string[] }).riskFlags;
      if (rf.length) riskParts.push(`${row.name}: ${rf.slice(0, 2).join("; ")}`);
    }
  }

  const compareScenarios = withRuns
    .filter((x) => x.latest?.comparisonJson && typeof x.latest.comparisonJson === "object")
    .map((x) => ({
      id: x.row.id,
      name: x.row.name,
      scenarioType: x.row.scenarioType,
      comparisonJson: x.latest!.comparisonJson as Record<string, unknown>,
      riskSummaryJson: (x.latest?.riskSummaryJson ?? null) as Record<string, unknown> | null,
    }));

  let bentleyScenarioCompareSummaryLine: string | undefined;
  if (compareScenarios.length >= 2) {
    const res = compareBentleyScenarios({ scenarios: compareScenarios });
    const safe = res.safestScenario;
    const hi = res.highestUpsideScenario;
    if (safe && hi && safe.id !== hi.id) {
      bentleyScenarioCompareSummaryLine =
        `${safe.name} is safest; ${hi.name} shows higher upside — ${res.balancedRecommendation.rationale}`.slice(0, 420);
    } else if (safe) {
      bentleyScenarioCompareSummaryLine = `${safe.name} ranks safest in this scope — open the compare matrix for approval and auto-action deltas.`.slice(
        0,
        420
      );
    }
  }

  const bentleyScenarioPresetRecommendationLine =
    "Balanced preset pairs moderate automation with measured approvals — compare against baseline to see tradeoffs.";
  const bentleyApplyReviewSummaryLine =
    "Cadence and notification policy changes use reviewed apply only — confirm the payload preview before POST.";

  return {
    bentleyPolicyWorkbenchSummaryLine: `Policy workbench: ${scenarios.length} saved scenario(s) in scope — compare before applying live policy changes.`,
    bentleyTopScenarioRecommendationLine: topLine ?? undefined,
    bentleyScenarioRiskSummaryLine: riskParts.length ? riskParts.join(" · ").slice(0, 450) : undefined,
    bentleyScenarioCompareSummaryLine,
    bentleyScenarioPresetRecommendationLine,
    bentleyApplyReviewSummaryLine,
  };
}
