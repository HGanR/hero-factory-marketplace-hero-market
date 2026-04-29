/**
 * @jest-environment node
 */

import { computeIntentScore0To100 } from "./intentScoreModel";
import {
  classifyPainFromText,
  classifyUrgencyFromText,
  inferCommercialStageFromSignals,
  classifyIntentFlags,
} from "./classifySignals";
import { buildEngineSignals } from "./buildEngineSignals";
import { buildContentInsightsBatch } from "./batchContentInsights";
import { computeEngineBatchSummary } from "./engineBatchSummary";
import type { LeadAnalysisRow } from "../queryTypes";
import type { CommercialCommentSignals } from "../types";

const emptyCommercial: CommercialCommentSignals = {
  repeatedBuyerQuestions: [],
  objectionClusters: [],
  bookingFrictionSignals: [],
  urgencySignals: [],
  locationOrServiceAreaQuestions: [],
  repeatedAcrossPosts: false,
  repeatedAcrossPostsCount: 0,
};

describe("intentScoreModel", () => {
  it("returns 0–100 with breakdown lines", () => {
    const r = computeIntentScore0To100({
      corpus: "I need help getting leads this week — anyone recommend a CRM?",
      commercial: {
        ...emptyCommercial,
        repeatedBuyerQuestions: ["how much"],
        urgencySignals: ["asap"],
      },
      opportunityScore: 0.6,
      intentScore: 0.55,
      confidenceScore: 0.5,
      buyerIntentPresent: true,
      overallCoverageScore: 0.5,
    });
    expect(r.score0To100).toBeGreaterThanOrEqual(0);
    expect(r.score0To100).toBeLessThanOrEqual(100);
    expect(r.breakdown.length).toBeGreaterThan(0);
  });
});

describe("classifySignals", () => {
  it("classifies pain buckets", () => {
    expect(classifyPainFromText("we need more leads and pipeline")).toBe("lead_generation");
    expect(classifyUrgencyFromText("need this asap today")).toBe("urgent");
    expect(inferCommercialStageFromSignals("high", "how much is your quote")).toBe("ready_now");
  });

  it("classifies intent flags", () => {
    const f = classifyIntentFlags("I'm struggling — can anyone help recommend a tool?");
    expect(f.hasExplicitHelpRequest || f.hasFirstPersonPain).toBe(true);
  });
});

describe("buildEngineSignals", () => {
  it("builds engine bundle", () => {
    const es = buildEngineSignals({
      postSnippets: ["Book now — slots open"],
      commentTexts: ["I need leads badly", "How much for consult?"],
      commercial: {
        ...emptyCommercial,
        repeatedBuyerQuestions: ["pricing?"],
        objectionClusters: [{ label: "price", examples: ["too expensive"] }],
        urgencySignals: ["this week"],
        repeatedAcrossPosts: true,
        repeatedAcrossPostsCount: 2,
      },
      commercialReadiness: "moderate",
      inferredVertical: "salon",
      opportunityScore: 0.55,
      intentScore: 0.5,
      confidenceScore: 0.55,
      buyerIntentPresent: true,
      overallCoverageScore: 0.45,
      bestOfferAngle: "Clarify booking path",
      suggestedNextMove: "Manual outreach",
      actionRationale: "Because coverage and intent support triage.",
      evidenceJsonSnippetCount: 6,
    });
    expect(es.schemaVersion).toBe(1);
    expect(es.painType).toBeTruthy();
    expect(es.intentScore.score0To100).toBeGreaterThanOrEqual(0);
  });
});

describe("batchContentInsights", () => {
  it("builds structured insights from rows", () => {
    const rows: LeadAnalysisRow[] = [
      {
        ...minimalRow(),
        enginePainType: "lead_generation",
        engineRecommendedHook: "Hook A",
        engineRecommendedCta: "CTA A",
        bestOfferAngle: "Offer A",
        evidenceJson: {
          weakSpots: [],
          repeatedBuyerQuestions: [],
          objectionThemes: ["too slow"],
          demandSignals: [],
          actionRationale: [],
        },
      },
    ];
    const b = buildContentInsightsBatch(rows);
    expect(b.schemaVersion).toBe(1);
    expect(b.hookIdeas.length).toBeGreaterThan(0);
    expect(b.marketSummary.length).toBeGreaterThan(10);
  });
});

describe("computeEngineBatchSummary", () => {
  it("aggregates by platform and pain", () => {
    const s = computeEngineBatchSummary([
      minimalRow({ platform: "instagram", enginePainType: "low_sales" }),
      minimalRow({ platform: "tiktok", enginePainType: "low_sales" }),
    ]);
    expect(s.totalLeads).toBe(2);
    expect(s.byPlatform.instagram).toBe(1);
    expect(s.byPainType.low_sales).toBe(2);
  });
});

function minimalRow(overrides: Partial<LeadAnalysisRow> = {}): LeadAnalysisRow {
  return {
    leadRecordId: "a",
    analysisId: "b",
    businessName: "X",
    platform: "instagram",
    handle: "h",
    email: null,
    websiteUrl: null,
    pipelineVersion: null,
    accessStatus: "public",
    businessType: "general",
    maturityStage: "early_stage",
    inferredVertical: "general_service_business",
    inferredLeadType: "local_service_business",
    commercialReadiness: "moderate",
    overallCoverageScore: 0.5,
    opportunityScore: 0.5,
    confidenceScore: 0.5,
    visibilityScore: 0.5,
    demandScore: 0.5,
    intentScore: 0.5,
    frictionScore: 0.5,
    fitScore: 0.5,
    bestOfferAngle: "angle",
    suggestedNextMove: "next",
    summary: "s",
    buyerIntentPresent: false,
    suggestedActionTags: [],
    operatorStatus: "new",
    operatorPriority: "normal",
    operatorNotes: null,
    manuallyReviewedAt: null,
    actionRationale: "r",
    evidenceJson: null,
    findingConfidenceJson: null,
    topLeadDriversJson: null,
    rankingDiagnosticsJson: null,
    operatorFeedbackLeadType: null,
    operatorFeedbackCommercialReadiness: null,
    operatorFeedbackWeakSpots: null,
    operatorFeedbackBestOfferAngle: null,
    operatorOverrideLeadType: null,
    operatorOverrideCommercialReadiness: null,
    operatorOverrideBestOfferAngle: null,
    operatorOverrideWeakSpotsJson: [],
    weakSpotsOverrideActive: false,
    operatorOverrideLeadTypeReason: null,
    operatorOverrideCommercialReadinessReason: null,
    operatorOverrideBestOfferAngleReason: null,
    operatorOverrideWeakSpotsReason: null,
    effectiveLeadType: "local_service_business",
    effectiveCommercialReadiness: "moderate",
    effectiveBestOfferAngle: "angle",
    inferredWeakSpots: [],
    effectiveWeakSpots: [],
    hasOperatorFieldOverrides: false,
    hasOperatorReasonNotes: false,
    repeatedAcrossPosts: false,
    repeatedAcrossPostsCount: 0,
    handoffReadiness: "not_ready",
    handoffReadinessReasons: [],
    engineIntentScore0To100: null,
    enginePainType: null,
    engineUrgency: null,
    engineCommercialStage: null,
    engineRecommendedHook: null,
    engineRecommendedCta: null,
    ...overrides,
  };
}
