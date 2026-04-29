/**
 * Derive operator-facing hints from a frozen batch summary (feedback loop → next content batch).
 */

export type EngagementFeedbackHints = {
  /** Top recurring pain labels from batch summary when available */
  topPainSignals: string[];
  /** Suggested follow-up themes for the next Content Engine / Trends pass */
  suggestedContentAngles: string[];
  /** Raw snapshot reference for audit */
  runId?: string;
  uploadId?: string;
};

function topKeysByCount(map: unknown, limit: number): string[] {
  if (!map || typeof map !== "object") return [];
  const o = map as Record<string, number>;
  return Object.entries(o)
    .filter(([, n]) => typeof n === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/** Minimal extraction from `computeBatchSummary` / `summarySnapshotJson` shape (defensive). */
export function hintsFromSummarySnapshot(
  summary: Record<string, unknown> | null | undefined,
  ctx?: { runId?: string; uploadId?: string }
): EngagementFeedbackHints {
  if (!summary || typeof summary !== "object") {
    return {
      topPainSignals: [],
      suggestedContentAngles: ["Review latest engagement import — run analysis to populate batch hints."],
      ...ctx,
    };
  }

  const byLeadType = topKeysByCount(summary.byLeadType, 6);
  const byPlatform = topKeysByCount(summary.byPlatform, 4);
  const topPainSignals = [...new Set([...byLeadType, ...byPlatform])].slice(0, 8);

  const suggestedContentAngles: string[] = [];
  for (const p of byLeadType.slice(0, 3)) {
    suggestedContentAngles.push(`Create proof-first angles for lead type “${p}”`);
  }
  for (const p of byPlatform.slice(0, 2)) {
    suggestedContentAngles.push(`Tune hooks for ${p} comment style`);
  }
  if (suggestedContentAngles.length === 0) {
    suggestedContentAngles.push("Double down on highest-intent comments from the engagement batch");
  }

  return {
    topPainSignals,
    suggestedContentAngles,
    runId: ctx?.runId,
    uploadId: ctx?.uploadId,
  };
}
