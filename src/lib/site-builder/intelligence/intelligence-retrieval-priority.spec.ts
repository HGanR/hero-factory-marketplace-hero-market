import {
  compareIntelligenceRetrievalPriority,
  type IntelligenceRetrievalSortKey,
} from "@/lib/site-builder/intelligence/intelligence-retrieval-priority";

function k(p: Partial<IntelligenceRetrievalSortKey>): IntelligenceRetrievalSortKey {
  return {
    isPublished: false,
    leadsOrRollup: 0,
    engagementSum: 0,
    positiveFeedbackCount: 0,
    evaluationScore: 0,
    createdAtMs: 0,
    ...p,
  };
}

describe("compareIntelligenceRetrievalPriority", () => {
  it("prefers published over unpublished when other signals tie", () => {
    const published = k({ isPublished: true, evaluationScore: 70 });
    const draft = k({ isPublished: false, evaluationScore: 70 });
    expect(compareIntelligenceRetrievalPriority(published, draft)).toBeLessThan(0);
    expect(compareIntelligenceRetrievalPriority(draft, published)).toBeGreaterThan(0);
  });

  it("prefers higher leads among published", () => {
    const hi = k({ isPublished: true, leadsOrRollup: 10, evaluationScore: 80 });
    const lo = k({ isPublished: true, leadsOrRollup: 2, evaluationScore: 95 });
    expect(compareIntelligenceRetrievalPriority(hi, lo)).toBeLessThan(0);
  });

  it("prefers higher engagement when leads tie", () => {
    const hi = k({ leadsOrRollup: 5, engagementSum: 40, evaluationScore: 70 });
    const lo = k({ leadsOrRollup: 5, engagementSum: 5, evaluationScore: 90 });
    expect(compareIntelligenceRetrievalPriority(hi, lo)).toBeLessThan(0);
  });

  it("prefers more positive feedback when prior keys tie", () => {
    const hi = k({ leadsOrRollup: 1, engagementSum: 1, positiveFeedbackCount: 3, evaluationScore: 70 });
    const lo = k({ leadsOrRollup: 1, engagementSum: 1, positiveFeedbackCount: 0, evaluationScore: 90 });
    expect(compareIntelligenceRetrievalPriority(hi, lo)).toBeLessThan(0);
  });
});
