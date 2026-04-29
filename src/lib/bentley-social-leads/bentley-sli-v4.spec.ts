/**
 * @jest-environment node
 */

import { buildActionRationale } from "./buildActionRationale";
import { buildRankingDiagnosticsJson } from "./buildRankingDiagnosticsJson";
import { buildFindingConfidenceJson } from "./buildFindingConfidence";
import { computeBatchSummary } from "./computeBatchSummary";
import { exportHandoffCsv } from "./exportHandoffCsv";
import {
  mapJoinedToLeadAnalysisRow,
  parseStoredEvidenceJson,
  parseStoredRankingDiagnosticsJson,
  parseStoredTopLeadDriversJson,
} from "./mapLeadAnalysisRow";
import { computeRunQualityDelta } from "./computeRunQualityDelta";
import { deriveHandoffReadiness, deriveHandoffReadinessWithReasons } from "./deriveHandoffReadiness";
import type { DriftFlagsJson } from "./computeBatchSummary";
import {
  drilldownPatchForDrift,
  rowMatchesSegmentDrilldown,
} from "./summaryDrilldown";
import type { LeadAnalysisRow } from "./queryTypes";
import type { CommercialCommentSignals, ScoreBundle, ScoreExplanations } from "./types";

function baseRow(overrides: Partial<LeadAnalysisRow> = {}): LeadAnalysisRow {
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
    actionRationale: null,
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

const joinedTail = {
  findingConfidenceJson: null,
  topLeadDriversJson: null,
  rankingDiagnosticsJson: null,
  operatorFeedbackLeadType: null,
  operatorFeedbackCommercialReadiness: null,
  operatorFeedbackWeakSpots: null,
  operatorFeedbackBestOfferAngle: null,
  operatorOverrideLeadTypeReason: null,
  operatorOverrideCommercialReadinessReason: null,
  operatorOverrideBestOfferAngleReason: null,
  operatorOverrideWeakSpotsReason: null,
};

describe("buildActionRationale", () => {
  it("mentions access, coverage, email, website, buyer intent, readiness, scores", () => {
    const t = buildActionRationale({
      accessStatus: "public",
      overallCoverageScore: 0.42,
      emailPresent: true,
      websitePresent: false,
      hasBuyerIntentInComments: true,
      commercialReadiness: "high",
      confidenceScore: 0.55,
      opportunityScore: 0.48,
    });
    expect(t.toLowerCase()).toContain("public");
    expect(t).toContain("42");
    expect(t.toLowerCase()).toContain("email");
    expect(t.toLowerCase()).toContain("website");
    expect(t.toLowerCase()).toContain("buyer");
    expect(t.toLowerCase()).toContain("high");
    expect(t).toContain("55");
    expect(t).toContain("48");
  });
});

describe("buildFindingConfidenceJson", () => {
  it("returns bounded scores for each finding", () => {
    const commercial: CommercialCommentSignals = {
      repeatedBuyerQuestions: ["how much"],
      objectionClusters: [{ label: "price", examples: ["too expensive"] }],
      bookingFrictionSignals: [],
      urgencySignals: [],
      locationOrServiceAreaQuestions: [],
      repeatedAcrossPosts: true,
      repeatedAcrossPostsCount: 3,
    };
    const fc = buildFindingConfidenceJson({
      accessStatus: "public",
      overallCoverageScore: 0.55,
      confidenceScore: 0.6,
      inferredLeadType: "agency",
      commercialReadiness: "high",
      commercial,
      weakSpots: ["weak_cta"],
      bestOfferAngle: "x".repeat(200),
      hasBuyerIntentInComments: true,
    });
    expect(fc.inferredLeadType).toBeGreaterThanOrEqual(0.12);
    expect(fc.inferredLeadType).toBeLessThanOrEqual(0.95);
    expect(fc.repeatedBuyerQuestions).toBeGreaterThan(0.2);
    expect(fc.objectionThemes).toBeGreaterThan(0.2);
    expect(fc.bestOfferAngle).toBeGreaterThan(0.2);
  });
});

describe("parseStoredEvidenceJson", () => {
  it("parses grouped evidence", () => {
    const e = parseStoredEvidenceJson({
      weakSpots: ["a"],
      repeatedBuyerQuestions: ["b"],
      objectionThemes: ["c"],
      demandSignals: ["d"],
      actionRationale: ["e"],
    });
    expect(e?.weakSpots).toEqual(["a"]);
    expect(e?.demandSignals).toEqual(["d"]);
  });

  it("migrates legacy flat evidence into weakSpots bucket", () => {
    const e = parseStoredEvidenceJson({
      weakCta: ["cta1"],
      bookingFriction: ["bf"],
      repeatedBuyerQuestions: ["q"],
      objectionThemes: [],
    });
    expect(e?.weakSpots.some((x) => x.includes("Weak CTA"))).toBe(true);
    expect(e?.repeatedBuyerQuestions).toEqual(["q"]);
  });
});

describe("computeBatchSummary", () => {
  it("aggregates by effective lead type and counts", () => {
    const rows: LeadAnalysisRow[] = [
      {
        ...baseRow(),
        leadRecordId: "1",
        effectiveLeadType: "agency",
        inferredLeadType: "local_service_business",
        platform: "instagram",
        inferredVertical: "general_service_business",
        commercialReadiness: "moderate",
        effectiveCommercialReadiness: "moderate",
        buyerIntentPresent: true,
        websiteUrl: null,
        overallCoverageScore: 0.2,
        opportunityScore: 0.6,
        suggestedNextMove: "Research",
        operatorStatus: "new",
        accessStatus: "public",
        evidenceJson: { weakSpots: ["x"], repeatedBuyerQuestions: [], objectionThemes: [], demandSignals: [], actionRationale: [] },
        repeatedAcrossPosts: true,
        repeatedAcrossPostsCount: 3,
        hasOperatorFieldOverrides: true,
      },
      {
        ...baseRow(),
        leadRecordId: "2",
        effectiveLeadType: "agency",
        inferredLeadType: "agency",
        platform: "tiktok",
        inferredVertical: "general_service_business",
        commercialReadiness: "low",
        effectiveCommercialReadiness: "low",
        buyerIntentPresent: false,
        websiteUrl: "https://x.com",
        overallCoverageScore: 0.5,
        opportunityScore: 0.4,
        suggestedNextMove: "Watchlist",
        operatorStatus: "reviewing",
        accessStatus: "access_limited",
        evidenceJson: null,
        repeatedAcrossPosts: false,
        repeatedAcrossPostsCount: 0,
        hasOperatorFieldOverrides: false,
      },
    ];
    const s = computeBatchSummary(rows);
    expect(s.totalLeads).toBe(2);
    expect(s.byLeadType.agency).toBe(2);
    expect(s.percentPublic).toBe(50);
    expect(s.percentAccessLimited).toBe(50);
    expect(s.averageCoverage).toBeCloseTo(0.35, 5);
    expect(s.percentWithEvidence).toBe(50);
    expect(s.percentWithRepeatedAcrossPosts).toBe(50);
    expect(s.percentWithOverrides).toBe(50);
    expect(s.percentFeedbackPresent).toBe(0);
    expect(s.pipelineVersion).toBeNull();
    expect(s.byPipelineVersion.unknown).toBe(2);
  });

  it("aggregates feedback quality and override diagnostics", () => {
    const s = computeBatchSummary([
      baseRow({
        pipelineVersion: "bentley-sli-v6",
        operatorFeedbackLeadType: "incorrect",
        confidenceScore: 0.4,
      }),
      baseRow({
        pipelineVersion: "bentley-sli-v6",
        operatorFeedbackCommercialReadiness: "partially_correct",
        operatorOverrideLeadType: "agency",
        hasOperatorFieldOverrides: true,
      }),
    ]);
    expect(s.percentFeedbackPresent).toBe(100);
    expect(s.percentLeadTypeIncorrect).toBe(50);
    expect(s.percentPartiallyCorrectCommercialReadiness).toBe(50);
    expect(s.mostCommonIncorrectFindingType).toBe("lead_type");
    expect(s.mostOverriddenField).toBe("lead_type");
    expect(s.avgConfidenceForIncorrectFindings).toBeCloseTo(0.4, 5);
    expect(s.pipelineVersion).toBe("bentley-sli-v6");
  });

  it("exposes segment quality breakdowns", () => {
    const s = computeBatchSummary([
      baseRow({
        leadRecordId: "1",
        inferredVertical: "salon",
        effectiveLeadType: "agency",
        platform: "instagram",
        effectiveCommercialReadiness: "high",
        opportunityScore: 0.7,
        confidenceScore: 0.6,
      }),
      baseRow({
        leadRecordId: "2",
        inferredVertical: "gym",
        effectiveLeadType: "local_service_business",
        platform: "tiktok",
        effectiveCommercialReadiness: "low",
        operatorFeedbackLeadType: "incorrect",
        opportunityScore: 0.3,
        confidenceScore: 0.4,
      }),
    ]);
    expect(s.qualityByVertical.salon?.count).toBe(1);
    expect(s.qualityByVertical.salon?.avgOpportunity).toBeCloseTo(0.7, 5);
    expect(s.qualityByLeadType.agency?.count).toBe(1);
    expect(s.qualityByPlatform.tiktok?.count).toBe(1);
    expect(s.qualityByCommercialReadiness.low?.percentIncorrectLeadType).toBe(100);
  });

  it("computes confidence calibration cells from feedback bands", () => {
    const s = computeBatchSummary([
      baseRow({
        leadRecordId: "1",
        confidenceScore: 0.7,
        operatorFeedbackLeadType: "correct",
      }),
      baseRow({
        leadRecordId: "2",
        confidenceScore: 0.3,
        operatorFeedbackLeadType: "incorrect",
      }),
    ]);
    expect(s.confidenceCalibrationJson.leadType.highConfidenceCorrect).toBe(1);
    expect(s.confidenceCalibrationJson.leadType.lowConfidenceIncorrect).toBe(1);
    expect(s.confidenceCalibrationJson.commercialReadiness.highConfidenceCorrect).toBe(0);
  });

  it("sets drift flags when high-confidence lead-type feedback is often incorrect", () => {
    const rows: LeadAnalysisRow[] = [];
    for (let i = 0; i < 3; i++) {
      rows.push(
        baseRow({
          leadRecordId: `c${i}`,
          confidenceScore: 0.6,
          operatorFeedbackLeadType: "correct",
        })
      );
    }
    for (let i = 0; i < 2; i++) {
      rows.push(
        baseRow({
          leadRecordId: `w${i}`,
          confidenceScore: 0.6,
          operatorFeedbackLeadType: "incorrect",
        })
      );
    }
    const s = computeBatchSummary(rows);
    expect(s.driftFlagsJson.highConfidenceHighLeadTypeIncorrectRate).toBe(true);
  });

  it("flags weak-spots override spike by lead type when bucket is large enough", () => {
    const rows: LeadAnalysisRow[] = [];
    for (let i = 0; i < 3; i++) {
      rows.push(
        baseRow({
          leadRecordId: `o${i}`,
          effectiveLeadType: "agency",
          weakSpotsOverrideActive: true,
          hasOperatorFieldOverrides: true,
        })
      );
    }
    for (let i = 0; i < 2; i++) {
      rows.push(
        baseRow({
          leadRecordId: `n${i}`,
          effectiveLeadType: "agency",
          weakSpotsOverrideActive: false,
          hasOperatorFieldOverrides: false,
        })
      );
    }
    const s = computeBatchSummary(rows);
    expect(s.driftFlagsJson.weakSpotsOverrideSpikeLeadType?.leadType).toBe("agency");
    expect(s.driftFlagsJson.weakSpotsOverrideSpikeLeadType?.weakSpotsOverrideRatePct).toBeCloseTo(60, 5);
  });

  it("includes avgCoverage in segment buckets and emits segmentAlertsJson", () => {
    const rows: LeadAnalysisRow[] = [];
    for (let i = 0; i < 5; i++) {
      rows.push(
        baseRow({
          leadRecordId: `s${i}`,
          inferredVertical: "salon",
          overallCoverageScore: 0.2,
          operatorFeedbackLeadType: "incorrect",
        })
      );
    }
    const s = computeBatchSummary(rows);
    expect(s.qualityByVertical.salon?.avgCoverage).toBeCloseTo(0.2, 5);
    expect(s.segmentAlertsJson.alerts.length).toBeGreaterThan(0);
    expect(s.segmentAlertsJson.alerts.some((a) => a.kind === "high_incorrect_rate" && a.segmentKey === "salon")).toBe(true);
    expect(s.segmentAlertsJson.alerts.some((a) => a.kind === "low_avg_coverage" && a.segmentKey === "salon")).toBe(true);
  });
});

describe("summaryDrilldown", () => {
  it("rowMatchesSegmentDrilldown matches vertical", () => {
    const r = baseRow({ inferredVertical: "salon" });
    expect(rowMatchesSegmentDrilldown(r, { dimension: "vertical", value: "salon" })).toBe(true);
    expect(rowMatchesSegmentDrilldown(r, { dimension: "vertical", value: "gym" })).toBe(false);
  });

  it("drilldownPatchForDrift returns patch when flag is on", () => {
    const flags = {
      highConfidenceHighLeadTypeIncorrectRate: true,
      highConfidenceHighReadinessIncorrectRate: false,
      offerAnglePartiallyCorrectVerticalSpike: null,
      weakSpotsOverrideSpikeLeadType: null,
      weakSpotsOverrideSpikePlatform: null,
      repeatedNegativeFeedbackUnderLowCoverage: false,
    } satisfies DriftFlagsJson;
    const p = drilldownPatchForDrift("lead_type_miscalibration", flags);
    expect(p?.filterFeedback).toBe("incorrect_lead_type");
  });
});

describe("deriveHandoffReadiness", () => {
  it("returns not_ready without rationale or next move", () => {
    expect(
      deriveHandoffReadiness(
        baseRow({ actionRationale: null, suggestedNextMove: "", handoffReadiness: "not_ready" })
      )
    ).toBe("not_ready");
  });

  it("returns ready when status, evidence, and scores support handoff", () => {
    const r = baseRow({
      operatorStatus: "shortlisted",
      actionRationale: "Why this lead matters.",
      suggestedNextMove: "Reach out with a tailored pitch.",
      overallCoverageScore: 0.5,
      confidenceScore: 0.5,
      evidenceJson: {
        weakSpots: ["x"],
        repeatedBuyerQuestions: [],
        objectionThemes: [],
        demandSignals: [],
        actionRationale: [],
      },
      handoffReadiness: "not_ready",
    });
    expect(deriveHandoffReadiness(r)).toBe("ready");
  });
});

describe("deriveHandoffReadinessWithReasons", () => {
  it("includes rationale gap in reasons when not_ready", () => {
    const r = deriveHandoffReadinessWithReasons(baseRow({ actionRationale: null, suggestedNextMove: "x" }));
    expect(r.handoffReadiness).toBe("not_ready");
    expect(r.handoffReadinessReasons.join(" ")).toMatch(/rationale/i);
  });

  it("returns a ready message when handoff is ready", () => {
    const r = baseRow({
      operatorStatus: "shortlisted",
      actionRationale: "Why this lead matters.",
      suggestedNextMove: "Reach out with a tailored pitch.",
      overallCoverageScore: 0.5,
      confidenceScore: 0.5,
      evidenceJson: {
        weakSpots: ["x"],
        repeatedBuyerQuestions: [],
        objectionThemes: [],
        demandSignals: [],
        actionRationale: [],
      },
      handoffReadiness: "not_ready",
    });
    const out = deriveHandoffReadinessWithReasons(r);
    expect(out.handoffReadiness).toBe("ready");
    expect(out.handoffReadinessReasons[0]).toMatch(/handoff/i);
  });
});

describe("mapJoinedToLeadAnalysisRow", () => {
  it("layers operator overrides without replacing inferred columns", () => {
    const row = mapJoinedToLeadAnalysisRow({
      leadRecordId: "lr",
      analysisId: "an",
      businessName: "B",
      platform: "tiktok",
      handle: "h",
      email: null,
      websiteUrl: null,
      accessStatus: "public",
      businessType: "t",
      maturityStage: "m",
      inferredVertical: "salon",
      leadType: "local_service_business",
      commercialReadiness: "moderate",
      coverageJson: { overallCoverageScore: 0.4, coverageScore: 0.4 },
      opportunityScore: "0.5",
      confidenceScore: "0.5",
      visibilityScore: "0.5",
      demandScore: "0.5",
      intentScore: "0.5",
      frictionScore: "0.5",
      fitScore: "0.5",
      bestOfferAngle: "inferred angle",
      suggestedNextMove: "move",
      summary: "sum",
      commentSummaryJson: { buyerIntentSignals: false },
      rawAnalysisJson: {},
      weakSpotsJson: ["weak_cta"],
      evidenceJson: null,
      actionRationale: "rationale",
      operatorOverrideLeadType: "agency",
      operatorOverrideCommercialReadiness: "high",
      operatorOverrideBestOfferAngle: "override angle",
      operatorOverrideWeakSpotsJson: ["no_lead_capture"],
      ...joinedTail,
      operatorStatus: "new",
      operatorPriority: "normal",
      operatorNotes: null,
      manuallyReviewedAt: null,
    });
    expect(row.inferredLeadType).toBe("local_service_business");
    expect(row.commercialReadiness).toBe("moderate");
    expect(row.effectiveLeadType).toBe("agency");
    expect(row.effectiveCommercialReadiness).toBe("high");
    expect(row.effectiveBestOfferAngle).toBe("override angle");
    expect(row.effectiveWeakSpots).toEqual(["no_lead_capture"]);
    expect(row.bestOfferAngle).toBe("inferred angle");
    expect(row.hasOperatorFieldOverrides).toBe(true);
  });

  it("falls back to inferred when overrides are null", () => {
    const row = mapJoinedToLeadAnalysisRow({
      leadRecordId: "lr",
      analysisId: "an",
      businessName: "B",
      platform: "tiktok",
      handle: "h",
      email: null,
      websiteUrl: null,
      accessStatus: "public",
      businessType: "t",
      maturityStage: "m",
      inferredVertical: "salon",
      leadType: "local_service_business",
      commercialReadiness: "moderate",
      coverageJson: { overallCoverageScore: 0.4 },
      opportunityScore: "0.5",
      confidenceScore: "0.5",
      visibilityScore: "0.5",
      demandScore: "0.5",
      intentScore: "0.5",
      frictionScore: "0.5",
      fitScore: "0.5",
      bestOfferAngle: "inferred angle",
      suggestedNextMove: "move",
      summary: "sum",
      commentSummaryJson: {},
      rawAnalysisJson: {},
      weakSpotsJson: ["weak_cta"],
      evidenceJson: null,
      actionRationale: null,
      operatorOverrideLeadType: null,
      operatorOverrideCommercialReadiness: null,
      operatorOverrideBestOfferAngle: null,
      operatorOverrideWeakSpotsJson: null,
      ...joinedTail,
      operatorStatus: "new",
      operatorPriority: "normal",
      operatorNotes: null,
      manuallyReviewedAt: null,
    });
    expect(row.effectiveLeadType).toBe("local_service_business");
    expect(row.effectiveWeakSpots).toEqual(["weak_cta"]);
    expect(row.effectiveBestOfferAngle).toBe("inferred angle");
  });

  it("persists override reason fields on the flat row", () => {
    const row = mapJoinedToLeadAnalysisRow({
      leadRecordId: "lr",
      analysisId: "an",
      businessName: "B",
      platform: "tiktok",
      handle: "h",
      email: null,
      websiteUrl: null,
      accessStatus: "public",
      businessType: "t",
      maturityStage: "m",
      inferredVertical: "salon",
      leadType: "local_service_business",
      commercialReadiness: "moderate",
      coverageJson: { overallCoverageScore: 0.4 },
      opportunityScore: "0.5",
      confidenceScore: "0.5",
      visibilityScore: "0.5",
      demandScore: "0.5",
      intentScore: "0.5",
      frictionScore: "0.5",
      fitScore: "0.5",
      bestOfferAngle: "inferred angle",
      suggestedNextMove: "move",
      summary: "sum",
      commentSummaryJson: {},
      rawAnalysisJson: {},
      weakSpotsJson: ["weak_cta"],
      evidenceJson: null,
      findingConfidenceJson: { inferredLeadType: 0.5, inferredCommercialReadiness: 0.5, repeatedBuyerQuestions: 0.5, objectionThemes: 0.5, bestOfferAngle: 0.5 },
      actionRationale: null,
      operatorOverrideLeadType: null,
      operatorOverrideCommercialReadiness: null,
      operatorOverrideBestOfferAngle: null,
      operatorOverrideWeakSpotsJson: null,
      operatorOverrideLeadTypeReason: "because CRM says agency",
      operatorOverrideCommercialReadinessReason: null,
      operatorOverrideBestOfferAngleReason: null,
      operatorOverrideWeakSpotsReason: null,
      operatorStatus: "new",
      operatorPriority: "normal",
      operatorNotes: null,
      manuallyReviewedAt: null,
    });
    expect(row.operatorOverrideLeadTypeReason).toBe("because CRM says agency");
    expect(row.hasOperatorReasonNotes).toBe(true);
    expect(row.findingConfidenceJson?.inferredLeadType).toBe(0.5);
  });

  it("maps analyst feedback and topLeadDriversJson separately from overrides", () => {
    const row = mapJoinedToLeadAnalysisRow({
      leadRecordId: "lr",
      analysisId: "an",
      businessName: "B",
      platform: "tiktok",
      handle: "h",
      email: null,
      websiteUrl: null,
      accessStatus: "public",
      businessType: "t",
      maturityStage: "m",
      inferredVertical: "salon",
      leadType: "local_service_business",
      commercialReadiness: "moderate",
      coverageJson: { overallCoverageScore: 0.4 },
      opportunityScore: "0.5",
      confidenceScore: "0.5",
      visibilityScore: "0.5",
      demandScore: "0.5",
      intentScore: "0.5",
      frictionScore: "0.5",
      fitScore: "0.5",
      bestOfferAngle: "inferred angle",
      suggestedNextMove: "move",
      summary: "sum",
      commentSummaryJson: {},
      rawAnalysisJson: {},
      weakSpotsJson: ["weak_cta"],
      evidenceJson: null,
      findingConfidenceJson: null,
      actionRationale: null,
      operatorOverrideLeadType: null,
      operatorOverrideCommercialReadiness: null,
      operatorOverrideBestOfferAngle: null,
      operatorOverrideWeakSpotsJson: null,
      ...joinedTail,
      topLeadDriversJson: { topPositive: ["driver a"], limitingFactors: ["limit b"] },
      operatorFeedbackLeadType: "partially_correct",
      operatorFeedbackCommercialReadiness: "correct",
      operatorFeedbackWeakSpots: null,
      operatorFeedbackBestOfferAngle: "incorrect",
      operatorStatus: "new",
      operatorPriority: "normal",
      operatorNotes: null,
      manuallyReviewedAt: null,
    });
    expect(row.topLeadDriversJson).toEqual({ topPositive: ["driver a"], limitingFactors: ["limit b"] });
    expect(row.operatorFeedbackLeadType).toBe("partially_correct");
    expect(row.operatorFeedbackCommercialReadiness).toBe("correct");
    expect(row.operatorFeedbackWeakSpots).toBeNull();
    expect(row.operatorFeedbackBestOfferAngle).toBe("incorrect");
  });

  it("maps pipelineVersion from join and rankingDiagnosticsJson", () => {
    const row = mapJoinedToLeadAnalysisRow({
      leadRecordId: "lr",
      analysisId: "an",
      businessName: "B",
      platform: "tiktok",
      handle: "h",
      email: null,
      websiteUrl: null,
      accessStatus: "public",
      businessType: "t",
      maturityStage: "m",
      inferredVertical: "salon",
      leadType: "local_service_business",
      commercialReadiness: "moderate",
      coverageJson: { overallCoverageScore: 0.4 },
      opportunityScore: "0.5",
      confidenceScore: "0.5",
      visibilityScore: "0.5",
      demandScore: "0.5",
      intentScore: "0.5",
      frictionScore: "0.5",
      fitScore: "0.5",
      bestOfferAngle: "inferred angle",
      suggestedNextMove: "move",
      summary: "sum",
      commentSummaryJson: {},
      rawAnalysisJson: {},
      weakSpotsJson: ["weak_cta"],
      evidenceJson: null,
      findingConfidenceJson: null,
      actionRationale: null,
      operatorOverrideLeadType: null,
      operatorOverrideCommercialReadiness: null,
      operatorOverrideBestOfferAngle: null,
      operatorOverrideWeakSpotsJson: null,
      ...joinedTail,
      pipelineVersion: "bentley-sli-v6",
      rankingDiagnosticsJson: {
        topPositiveDrivers: ["d1"],
        topLimitingFactors: ["l1"],
        coveragePenalties: ["c1"],
        confidencePenalties: ["cf1"],
        actionBiasFactors: ["ab1"],
      },
      operatorStatus: "new",
      operatorPriority: "normal",
      operatorNotes: null,
      manuallyReviewedAt: null,
    });
    expect(row.pipelineVersion).toBe("bentley-sli-v6");
    expect(row.rankingDiagnosticsJson?.topPositiveDrivers).toEqual(["d1"]);
    expect(row.rankingDiagnosticsJson?.actionBiasFactors).toEqual(["ab1"]);
  });
});

describe("parseStoredRankingDiagnosticsJson", () => {
  it("parses structured ranking diagnostics", () => {
    const r = parseStoredRankingDiagnosticsJson({
      topPositiveDrivers: ["a"],
      topLimitingFactors: ["b"],
      coveragePenalties: ["c"],
      confidencePenalties: ["d"],
      actionBiasFactors: ["e"],
    });
    expect(r?.topPositiveDrivers).toEqual(["a"]);
    expect(r?.coveragePenalties).toEqual(["c"]);
  });
});

describe("buildRankingDiagnosticsJson", () => {
  it("includes coverage and confidence penalties and action bias", () => {
    const se: ScoreExplanations = {
      visibility_score: "v",
      demand_score: "d",
      intent_score: "i",
      friction_score: "f",
      fit_score: "fit",
      opportunity_score: "o",
      top_positive_drivers: ["pos"],
      top_negative_drivers: ["neg"],
      confidence_rationale: "Moderate confidence case.",
    };
    const scores: ScoreBundle = {
      visibilityScore: 0.5,
      demandScore: 0.5,
      intentScore: 0.5,
      frictionScore: 0.5,
      fitScore: 0.5,
      opportunityScore: 0.5,
      confidenceScore: 0.5,
    };
    const r = buildRankingDiagnosticsJson(se, scores, 0.25, ["watch_only", "manual_email"]);
    expect(r.topPositiveDrivers).toContain("pos");
    expect(r.coveragePenalties.length).toBeGreaterThan(0);
    expect(r.actionBiasFactors.some((x) => x.includes("Watchlist") || x.includes("email"))).toBe(true);
  });
});

describe("parseStoredTopLeadDriversJson", () => {
  it("parses positive and limiting slices", () => {
    const t = parseStoredTopLeadDriversJson({
      topPositive: ["a", "b", "c", "d"],
      limitingFactors: ["x", "y", "z"],
    });
    expect(t?.topPositive).toEqual(["a", "b", "c"]);
    expect(t?.limitingFactors).toEqual(["x", "y"]);
  });
});

describe("computeRunQualityDelta", () => {
  it("returns signed deltas for coverage, confidence, and percent shares", () => {
    const a = computeBatchSummary([baseRow({ overallCoverageScore: 0.5, confidenceScore: 0.5 })]);
    const b = computeBatchSummary([baseRow({ overallCoverageScore: 0.4, confidenceScore: 0.6 })]);
    const d = computeRunQualityDelta(a, b);
    expect(d.deltaAverageCoverage).toBeCloseTo(0.1, 5);
    expect(d.deltaAverageConfidence).toBeCloseTo(-0.1, 5);
    expect(d.deltaPercentPublic).toBe(0);
    expect(typeof d.deltaPercentFeedbackPresent).toBe("number");
  });
});

describe("exportHandoffCsv", () => {
  it("includes feedback columns and driver fields", () => {
    const csv = exportHandoffCsv([
      baseRow({
        topLeadDriversJson: { topPositive: ["p1"], limitingFactors: ["n1"] },
        operatorFeedbackLeadType: "correct",
        operatorFeedbackCommercialReadiness: null,
        operatorFeedbackWeakSpots: "partially_correct",
        operatorFeedbackBestOfferAngle: "incorrect",
        inferredWeakSpots: ["weak_cta"],
        effectiveWeakSpots: ["weak_cta"],
        evidenceJson: {
          weakSpots: ["w"],
          repeatedBuyerQuestions: [],
          objectionThemes: [],
          demandSignals: [],
          actionRationale: [],
        },
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("operatorFeedbackLeadType");
    expect(lines[0]).toContain("topPositiveDrivers");
    expect(lines[1]).toContain('"correct"');
    expect(lines[1]).toContain("p1");
  });
});
