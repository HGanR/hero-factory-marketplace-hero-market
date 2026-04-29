/**
 * Mirrors `findSimilarSuccessfulVariants` ORDER BY (descending priority).
 * Used in tests and docs — keep in sync with repository SQL.
 */
export type IntelligenceRetrievalSortKey = {
  isPublished: boolean;
  /** COALESCE(rollupLeadsCaptured, leadCount, 0) */
  leadsOrRollup: number;
  /** Sum of conversation + widget + booking rollup counts */
  engagementSum: number;
  positiveFeedbackCount: number;
  evaluationScore: number;
  createdAtMs: number;
};

/** Comparator for Array.sort: higher priority first. */
export function compareIntelligenceRetrievalPriority(a: IntelligenceRetrievalSortKey, b: IntelligenceRetrievalSortKey): number {
  const vec = (x: IntelligenceRetrievalSortKey) =>
    [
      x.isPublished ? 1 : 0,
      x.leadsOrRollup,
      x.engagementSum,
      x.positiveFeedbackCount,
      x.evaluationScore,
      x.createdAtMs,
    ] as const;
  const va = vec(a);
  const vb = vec(b);
  for (let i = 0; i < va.length; i += 1) {
    if (va[i] !== vb[i]) return vb[i]! - va[i]!;
  }
  return 0;
}
