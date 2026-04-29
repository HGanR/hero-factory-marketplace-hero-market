/**
 * Aggregate stats for an upload/run batch (deterministic from flat rows).
 */

import type { EvidenceByFinding, FindingFeedbackValue } from "./types";
import type { LeadAnalysisRow } from "./queryTypes";

export type IncorrectFindingKind = "lead_type" | "commercial_readiness" | "weak_spots" | "best_offer_angle";

export type OverriddenFieldKind = "lead_type" | "commercial_readiness" | "best_offer_angle" | "weak_spots";

export type QualityBucketStats = {
  count: number;
  avgOpportunity: number;
  avgConfidence: number;
  /** Mean overallCoverageScore in this segment (0–1). */
  avgCoverage: number;
  percentOverride: number;
  percentIncorrectLeadType: number;
  percentIncorrectCommercialReadiness: number;
  percentIncorrectWeakSpots: number;
  percentIncorrectBestOfferAngle: number;
};

export type SegmentAlertDimension = "vertical" | "lead_type" | "platform" | "commercial_readiness";

export type SegmentAlertKind =
  | "high_incorrect_rate"
  | "high_override_rate"
  | "low_avg_coverage"
  | "low_calibration_quality";

export type SegmentAlert = {
  dimension: SegmentAlertDimension;
  segmentKey: string;
  kind: SegmentAlertKind;
  /** Metric value that tripped the alert (scale matches kind). */
  value: number;
  threshold: number;
  sampleSize: number;
};

export type SegmentAlertsJson = {
  alerts: SegmentAlert[];
};

export type QualityBreakdownMap = Record<string, QualityBucketStats>;

export type FindingCalibrationCell = {
  highConfidenceCorrect: number;
  highConfidenceIncorrect: number;
  lowConfidenceCorrect: number;
  lowConfidenceIncorrect: number;
};

export type ConfidenceCalibrationJson = {
  leadType: FindingCalibrationCell;
  commercialReadiness: FindingCalibrationCell;
  weakSpots: FindingCalibrationCell;
  bestOfferAngle: FindingCalibrationCell;
};

export type DriftFlagsJson = {
  highConfidenceHighLeadTypeIncorrectRate: boolean;
  highConfidenceHighReadinessIncorrectRate: boolean;
  offerAnglePartiallyCorrectVerticalSpike: {
    vertical: string;
    partialRatePct: number;
    sampleSize: number;
  } | null;
  weakSpotsOverrideSpikeLeadType: {
    leadType: string;
    weakSpotsOverrideRatePct: number;
    sampleSize: number;
  } | null;
  weakSpotsOverrideSpikePlatform: {
    platform: string;
    weakSpotsOverrideRatePct: number;
    sampleSize: number;
  } | null;
  repeatedNegativeFeedbackUnderLowCoverage: boolean;
};

export type RunBatchSummary = {
  totalLeads: number;
  /** Pipeline version from analysis rows (rawAnalysisJson), when present. */
  pipelineVersion: string | null;
  /** Count of leads per pipelineVersion key (multi-version batches). */
  byPipelineVersion: Record<string, number>;
  byPlatform: Record<string, number>;
  byVertical: Record<string, number>;
  byLeadType: Record<string, number>;
  byCommercialReadiness: Record<string, number>;
  /** Bucket key = first 96 chars of suggested next move (trimmed) or "(empty)" */
  bySuggestedNextMove: Record<string, number>;
  byOperatorStatus: Record<string, number>;
  buyerIntentPresentCount: number;
  websiteMissingCount: number;
  lowCoverageCount: number;
  averageOpportunityScore: number;
  /** Run-quality metrics (0–100 where noted). */
  percentPublic: number;
  percentAccessLimited: number;
  averageCoverage: number;
  averageConfidence: number;
  /** Share of leads with any non-empty evidence bucket. */
  percentWithEvidence: number;
  /** Share with repeated buyer questions across posts (comment intel). */
  percentWithRepeatedAcrossPosts: number;
  /** Share with at least one operator value override. */
  percentWithOverrides: number;
  /** Share with at least one analyst feedback field set. */
  percentFeedbackPresent: number;
  /** Of total leads — explicit incorrect feedback on that finding. */
  percentLeadTypeIncorrect: number;
  percentCommercialReadinessIncorrect: number;
  percentWeakSpotsIncorrect: number;
  percentBestOfferAngleIncorrect: number;
  /** Of total leads — partially_correct per finding type. */
  percentPartiallyCorrectLeadType: number;
  percentPartiallyCorrectCommercialReadiness: number;
  percentPartiallyCorrectWeakSpots: number;
  percentPartiallyCorrectBestOfferAngle: number;
  /** Highest-frequency incorrect dimension (ties broken arbitrarily). */
  mostCommonIncorrectFindingType: IncorrectFindingKind | null;
  /** Highest-frequency overridden field (ties broken arbitrarily). */
  mostOverriddenField: OverriddenFieldKind | null;
  /** Mean confidence score among leads with any incorrect finding feedback. */
  avgConfidenceForIncorrectFindings: number | null;
  /** Heuristic drift / miscalibration watch flags. */
  driftFlagsJson: DriftFlagsJson;
  /** Quality + error rates by segment. */
  qualityByVertical: QualityBreakdownMap;
  qualityByLeadType: QualityBreakdownMap;
  qualityByPlatform: QualityBreakdownMap;
  qualityByCommercialReadiness: QualityBreakdownMap;
  /** Confidence × feedback alignment (high/low bands). */
  confidenceCalibrationJson: ConfidenceCalibrationJson;
  /** Segment-level threshold alerts (actionable tuning signals). */
  segmentAlertsJson: SegmentAlertsJson;
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function nextMoveKey(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "(empty)";
  return t.length <= 96 ? t : t.slice(0, 93) + "…";
}

function evidenceHasContent(e: EvidenceByFinding | null | undefined): boolean {
  if (!e) return false;
  return (
    e.weakSpots.length > 0 ||
    e.repeatedBuyerQuestions.length > 0 ||
    e.objectionThemes.length > 0 ||
    e.demandSignals.length > 0 ||
    e.actionRationale.length > 0
  );
}

function hasAnyFeedback(r: LeadAnalysisRow): boolean {
  return Boolean(
    r.operatorFeedbackLeadType ||
      r.operatorFeedbackCommercialReadiness ||
      r.operatorFeedbackWeakSpots ||
      r.operatorFeedbackBestOfferAngle
  );
}

function hasIncorrectFeedback(r: LeadAnalysisRow): boolean {
  return (
    r.operatorFeedbackLeadType === "incorrect" ||
    r.operatorFeedbackCommercialReadiness === "incorrect" ||
    r.operatorFeedbackWeakSpots === "incorrect" ||
    r.operatorFeedbackBestOfferAngle === "incorrect"
  );
}

function argMaxKey(counts: Record<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return bestN > 0 ? best : null;
}

const HIGH_CONF = 0.55;
const LOW_CONF = 0.45;
const MIN_BUCKET = 5;
const DRIFT_INCORRECT_RATE = 0.25;
const DRIFT_AVG_CONF = 0.52;
const PARTIAL_VERTICAL_PCT = 0.38;
const WEAK_OVERRIDE_PCT = 0.35;
const LOW_COV_NEG_RATIO = 0.18;
const LOW_COV = 0.35;

const MIN_ALERT_SEGMENT = 5;
const ALERT_HIGH_INCORRECT_PCT = 30;
const ALERT_HIGH_OVERRIDE_PCT = 45;
const ALERT_LOW_COVERAGE = 0.35;
const ALERT_CALIB_MISFIT = 0.35;
const MIN_CALIB_DENOM = 3;

type Acc = {
  n: number;
  oppSum: number;
  confSum: number;
  covSum: number;
  overrideN: number;
  ltIncorrect: number;
  crIncorrect: number;
  wsIncorrect: number;
  offerIncorrect: number;
};

function emptyAcc(): Acc {
  return {
    n: 0,
    oppSum: 0,
    confSum: 0,
    covSum: 0,
    overrideN: 0,
    ltIncorrect: 0,
    crIncorrect: 0,
    wsIncorrect: 0,
    offerIncorrect: 0,
  };
}

function touchBreakdown(map: Record<string, Acc>, key: string, r: LeadAnalysisRow): void {
  if (!map[key]) map[key] = emptyAcc();
  const a = map[key];
  a.n += 1;
  a.oppSum += r.opportunityScore;
  a.confSum += r.confidenceScore;
  a.covSum += r.overallCoverageScore;
  if (r.hasOperatorFieldOverrides) a.overrideN += 1;
  if (r.operatorFeedbackLeadType === "incorrect") a.ltIncorrect += 1;
  if (r.operatorFeedbackCommercialReadiness === "incorrect") a.crIncorrect += 1;
  if (r.operatorFeedbackWeakSpots === "incorrect") a.wsIncorrect += 1;
  if (r.operatorFeedbackBestOfferAngle === "incorrect") a.offerIncorrect += 1;
}

function finalizeBreakdown(map: Record<string, Acc>): QualityBreakdownMap {
  const out: QualityBreakdownMap = {};
  for (const [k, a] of Object.entries(map)) {
    if (a.n === 0) continue;
    const n = a.n;
    out[k] = {
      count: n,
      avgOpportunity: a.oppSum / n,
      avgConfidence: a.confSum / n,
      avgCoverage: a.covSum / n,
      percentOverride: (a.overrideN / n) * 100,
      percentIncorrectLeadType: (a.ltIncorrect / n) * 100,
      percentIncorrectCommercialReadiness: (a.crIncorrect / n) * 100,
      percentIncorrectWeakSpots: (a.wsIncorrect / n) * 100,
      percentIncorrectBestOfferAngle: (a.offerIncorrect / n) * 100,
    };
  }
  return out;
}

function maxCalibrationMisfit(rows: LeadAnalysisRow[]): number {
  const cal = buildConfidenceCalibrationJson(rows);
  const cells = [cal.leadType, cal.commercialReadiness, cal.weakSpots, cal.bestOfferAngle];
  let max = 0;
  for (const c of cells) {
    const den = c.highConfidenceCorrect + c.highConfidenceIncorrect;
    if (den < MIN_CALIB_DENOM) continue;
    const misfit = c.highConfidenceIncorrect / den;
    if (misfit > max) max = misfit;
  }
  return max;
}

function pushSegmentAlerts(
  rows: LeadAnalysisRow[],
  dimension: SegmentAlertDimension,
  map: QualityBreakdownMap,
  getSeg: (r: LeadAnalysisRow) => string,
  out: SegmentAlert[]
): void {
  for (const [key, stats] of Object.entries(map)) {
    if (stats.count < MIN_ALERT_SEGMENT) continue;
    const segRows = rows.filter((r) => getSeg(r) === key);
    const maxWrong = Math.max(
      stats.percentIncorrectLeadType,
      stats.percentIncorrectCommercialReadiness,
      stats.percentIncorrectWeakSpots,
      stats.percentIncorrectBestOfferAngle
    );
    if (maxWrong >= ALERT_HIGH_INCORRECT_PCT) {
      out.push({
        dimension,
        segmentKey: key,
        kind: "high_incorrect_rate",
        value: maxWrong,
        threshold: ALERT_HIGH_INCORRECT_PCT,
        sampleSize: stats.count,
      });
    }
    if (stats.percentOverride >= ALERT_HIGH_OVERRIDE_PCT) {
      out.push({
        dimension,
        segmentKey: key,
        kind: "high_override_rate",
        value: stats.percentOverride,
        threshold: ALERT_HIGH_OVERRIDE_PCT,
        sampleSize: stats.count,
      });
    }
    if (stats.avgCoverage < ALERT_LOW_COVERAGE) {
      out.push({
        dimension,
        segmentKey: key,
        kind: "low_avg_coverage",
        value: stats.avgCoverage,
        threshold: ALERT_LOW_COVERAGE,
        sampleSize: stats.count,
      });
    }
    const calMisfit = maxCalibrationMisfit(segRows);
    if (calMisfit >= ALERT_CALIB_MISFIT) {
      out.push({
        dimension,
        segmentKey: key,
        kind: "low_calibration_quality",
        value: calMisfit,
        threshold: ALERT_CALIB_MISFIT,
        sampleSize: stats.count,
      });
    }
  }
}

function buildSegmentAlertsJson(rows: LeadAnalysisRow[], breakdowns: ReturnType<typeof buildQualityBreakdownMaps>): SegmentAlertsJson {
  const alerts: SegmentAlert[] = [];
  pushSegmentAlerts(rows, "vertical", breakdowns.byVertical, (r) => r.inferredVertical || "unknown", alerts);
  pushSegmentAlerts(rows, "lead_type", breakdowns.byLeadType, (r) => r.effectiveLeadType || "unknown", alerts);
  pushSegmentAlerts(rows, "platform", breakdowns.byPlatform, (r) => r.platform || "unknown", alerts);
  pushSegmentAlerts(
    rows,
    "commercial_readiness",
    breakdowns.byCommercialReadiness,
    (r) => r.effectiveCommercialReadiness || "unknown",
    alerts
  );
  return { alerts };
}

function buildQualityBreakdownMaps(rows: LeadAnalysisRow[]): {
  byVertical: QualityBreakdownMap;
  byLeadType: QualityBreakdownMap;
  byPlatform: QualityBreakdownMap;
  byCommercialReadiness: QualityBreakdownMap;
} {
  const byVertical: Record<string, Acc> = {};
  const byLeadType: Record<string, Acc> = {};
  const byPlatform: Record<string, Acc> = {};
  const byReadiness: Record<string, Acc> = {};

  for (const r of rows) {
    touchBreakdown(byVertical, r.inferredVertical || "unknown", r);
    touchBreakdown(byLeadType, r.effectiveLeadType || "unknown", r);
    touchBreakdown(byPlatform, r.platform || "unknown", r);
    touchBreakdown(byReadiness, r.effectiveCommercialReadiness || "unknown", r);
  }

  return {
    byVertical: finalizeBreakdown(byVertical),
    byLeadType: finalizeBreakdown(byLeadType),
    byPlatform: finalizeBreakdown(byPlatform),
    byCommercialReadiness: finalizeBreakdown(byReadiness),
  };
}

function isAlignedFb(v: FindingFeedbackValue | null): boolean {
  return v === "correct" || v === "partially_correct";
}

function isIncorrectFb(v: FindingFeedbackValue | null): boolean {
  return v === "incorrect";
}

function buildConfidenceCalibrationJson(rows: LeadAnalysisRow[]): ConfidenceCalibrationJson {
  const leadType: FindingCalibrationCell = {
    highConfidenceCorrect: 0,
    highConfidenceIncorrect: 0,
    lowConfidenceCorrect: 0,
    lowConfidenceIncorrect: 0,
  };
  const commercialReadiness: FindingCalibrationCell = { ...leadType };
  const weakSpots: FindingCalibrationCell = { ...leadType };
  const bestOfferAngle: FindingCalibrationCell = { ...leadType };

  const bump = (cell: FindingCalibrationCell, r: LeadAnalysisRow, feedback: FindingFeedbackValue | null) => {
    if (feedback == null) return;
    const hi = r.confidenceScore >= HIGH_CONF;
    const lo = r.confidenceScore < LOW_CONF;
    if (!hi && !lo) return;
    const ok = isAlignedFb(feedback);
    const bad = isIncorrectFb(feedback);
    if (hi) {
      if (ok) cell.highConfidenceCorrect++;
      else if (bad) cell.highConfidenceIncorrect++;
    } else if (lo) {
      if (ok) cell.lowConfidenceCorrect++;
      else if (bad) cell.lowConfidenceIncorrect++;
    }
  };

  for (const r of rows) {
    bump(leadType, r, r.operatorFeedbackLeadType);
    bump(commercialReadiness, r, r.operatorFeedbackCommercialReadiness);
    bump(weakSpots, r, r.operatorFeedbackWeakSpots);
    bump(bestOfferAngle, r, r.operatorFeedbackBestOfferAngle);
  }

  return { leadType, commercialReadiness, weakSpots, bestOfferAngle };
}

function buildDriftFlagsJson(
  rows: LeadAnalysisRow[],
  breakdowns: ReturnType<typeof buildQualityBreakdownMaps>,
  _totalLeads: number
): DriftFlagsJson {
  let ltFeedbackN = 0;
  let ltIncorrectN = 0;
  let ltConfSum = 0;
  let crFeedbackN = 0;
  let crIncorrectN = 0;
  let crConfSum = 0;

  let lowCovCount = 0;
  let lowCovNegCount = 0;

  for (const r of rows) {
    if (r.operatorFeedbackLeadType != null) {
      ltFeedbackN++;
      ltConfSum += r.confidenceScore;
      if (r.operatorFeedbackLeadType === "incorrect") ltIncorrectN++;
    }
    if (r.operatorFeedbackCommercialReadiness != null) {
      crFeedbackN++;
      crConfSum += r.confidenceScore;
      if (r.operatorFeedbackCommercialReadiness === "incorrect") crIncorrectN++;
    }

    if (r.overallCoverageScore < LOW_COV) {
      lowCovCount++;
      if (
        r.operatorFeedbackLeadType === "incorrect" ||
        r.operatorFeedbackCommercialReadiness === "incorrect" ||
        r.operatorFeedbackWeakSpots === "incorrect" ||
        r.operatorFeedbackBestOfferAngle === "incorrect"
      ) {
        lowCovNegCount++;
      }
    }
  }

  const ltRate = ltFeedbackN ? ltIncorrectN / ltFeedbackN : 0;
  const ltAvgConf = ltFeedbackN ? ltConfSum / ltFeedbackN : 0;
  const highConfidenceHighLeadTypeIncorrectRate =
    ltFeedbackN >= MIN_BUCKET && ltAvgConf >= DRIFT_AVG_CONF && ltRate >= DRIFT_INCORRECT_RATE;

  const crRate = crFeedbackN ? crIncorrectN / crFeedbackN : 0;
  const crAvgConf = crFeedbackN ? crConfSum / crFeedbackN : 0;
  const highConfidenceHighReadinessIncorrectRate =
    crFeedbackN >= MIN_BUCKET && crAvgConf >= DRIFT_AVG_CONF && crRate >= DRIFT_INCORRECT_RATE;

  let offerAnglePartiallyCorrectVerticalSpike: DriftFlagsJson["offerAnglePartiallyCorrectVerticalSpike"] = null;
  for (const [vertical] of Object.entries(breakdowns.byVertical)) {
    const vr = rows.filter((x) => x.inferredVertical === vertical);
    const withOfferFb = vr.filter((x) => x.operatorFeedbackBestOfferAngle != null);
    if (withOfferFb.length < MIN_BUCKET) continue;
    const partial = withOfferFb.filter((x) => x.operatorFeedbackBestOfferAngle === "partially_correct").length;
    const rate = partial / withOfferFb.length;
    if (rate >= PARTIAL_VERTICAL_PCT) {
      offerAnglePartiallyCorrectVerticalSpike = {
        vertical,
        partialRatePct: rate * 100,
        sampleSize: withOfferFb.length,
      };
      break;
    }
  }

  let weakSpotsOverrideSpikeLeadType: DriftFlagsJson["weakSpotsOverrideSpikeLeadType"] = null;
  let bestLt = 0;
  for (const [leadType, stats] of Object.entries(breakdowns.byLeadType)) {
    if (stats.count < MIN_BUCKET) continue;
    const sub = rows.filter((x) => x.effectiveLeadType === leadType);
    const wsOv = sub.filter((x) => x.weakSpotsOverrideActive).length;
    const rate = wsOv / stats.count;
    if (rate >= WEAK_OVERRIDE_PCT && wsOv > bestLt) {
      bestLt = wsOv;
      weakSpotsOverrideSpikeLeadType = {
        leadType,
        weakSpotsOverrideRatePct: rate * 100,
        sampleSize: stats.count,
      };
    }
  }

  let weakSpotsOverrideSpikePlatform: DriftFlagsJson["weakSpotsOverrideSpikePlatform"] = null;
  let bestPl = 0;
  for (const [platform, stats] of Object.entries(breakdowns.byPlatform)) {
    if (stats.count < MIN_BUCKET) continue;
    const sub = rows.filter((x) => x.platform === platform);
    const wsOv = sub.filter((x) => x.weakSpotsOverrideActive).length;
    const rate = wsOv / stats.count;
    if (rate >= WEAK_OVERRIDE_PCT && wsOv > bestPl) {
      bestPl = wsOv;
      weakSpotsOverrideSpikePlatform = {
        platform,
        weakSpotsOverrideRatePct: rate * 100,
        sampleSize: stats.count,
      };
    }
  }

  const negUnderLowCovRatio = lowCovCount ? lowCovNegCount / lowCovCount : 0;
  const repeatedNegativeFeedbackUnderLowCoverage =
    lowCovCount >= MIN_BUCKET && negUnderLowCovRatio >= LOW_COV_NEG_RATIO;

  return {
    highConfidenceHighLeadTypeIncorrectRate,
    highConfidenceHighReadinessIncorrectRate,
    offerAnglePartiallyCorrectVerticalSpike,
    weakSpotsOverrideSpikeLeadType,
    weakSpotsOverrideSpikePlatform,
    repeatedNegativeFeedbackUnderLowCoverage,
  };
}

export function computeBatchSummary(rows: LeadAnalysisRow[]): RunBatchSummary {
  const byPlatform: Record<string, number> = {};
  const byVertical: Record<string, number> = {};
  const byLeadType: Record<string, number> = {};
  const byCommercialReadiness: Record<string, number> = {};
  const bySuggestedNextMove: Record<string, number> = {};
  const byOperatorStatus: Record<string, number> = {};
  const byPipelineVersion: Record<string, number> = {};

  let buyerIntentPresentCount = 0;
  let websiteMissingCount = 0;
  let lowCoverageCount = 0;
  let oppSum = 0;
  let covSum = 0;
  let confSum = 0;
  let publicCount = 0;
  let accessLimitedCount = 0;
  let evidenceCount = 0;
  let repeatedAcrossCount = 0;
  let overrideCount = 0;

  let feedbackPresentCount = 0;
  let ltIncorrect = 0;
  let crIncorrect = 0;
  let wsIncorrect = 0;
  let offerIncorrect = 0;
  let ltPartial = 0;
  let crPartial = 0;
  let wsPartial = 0;
  let offerPartial = 0;

  const incorrectByKind: Record<IncorrectFindingKind, number> = {
    lead_type: 0,
    commercial_readiness: 0,
    weak_spots: 0,
    best_offer_angle: 0,
  };

  const overrideByField: Record<OverriddenFieldKind, number> = {
    lead_type: 0,
    commercial_readiness: 0,
    best_offer_angle: 0,
    weak_spots: 0,
  };

  let confSumIncorrect = 0;
  let incorrectFindingLeadCount = 0;

  let dominantPipeline: string | null = null;

  for (const r of rows) {
    bump(byPlatform, r.platform || "unknown");
    bump(byVertical, r.inferredVertical || "unknown");
    bump(byLeadType, r.effectiveLeadType || "unknown");
    bump(byCommercialReadiness, r.effectiveCommercialReadiness || "unknown");
    bump(bySuggestedNextMove, nextMoveKey(r.suggestedNextMove));
    bump(byOperatorStatus, r.operatorStatus || "new");

    const pv = r.pipelineVersion?.trim() || "unknown";
    bump(byPipelineVersion, pv);
    if (!dominantPipeline && r.pipelineVersion?.trim()) dominantPipeline = r.pipelineVersion.trim();

    if (r.buyerIntentPresent) buyerIntentPresentCount++;
    if (!r.websiteUrl) websiteMissingCount++;
    if (r.overallCoverageScore < 0.35) lowCoverageCount++;
    oppSum += r.opportunityScore;
    covSum += r.overallCoverageScore;
    confSum += r.confidenceScore;

    if (r.accessStatus === "public") publicCount++;
    if (r.accessStatus === "access_limited") accessLimitedCount++;

    if (evidenceHasContent(r.evidenceJson ?? undefined)) evidenceCount++;
    if (r.repeatedAcrossPosts && r.repeatedAcrossPostsCount >= 2) repeatedAcrossCount++;
    if (r.hasOperatorFieldOverrides) overrideCount++;

    if (hasAnyFeedback(r)) feedbackPresentCount++;

    if (r.operatorFeedbackLeadType === "incorrect") {
      ltIncorrect++;
      incorrectByKind.lead_type++;
    }
    if (r.operatorFeedbackCommercialReadiness === "incorrect") {
      crIncorrect++;
      incorrectByKind.commercial_readiness++;
    }
    if (r.operatorFeedbackWeakSpots === "incorrect") {
      wsIncorrect++;
      incorrectByKind.weak_spots++;
    }
    if (r.operatorFeedbackBestOfferAngle === "incorrect") {
      offerIncorrect++;
      incorrectByKind.best_offer_angle++;
    }

    if (r.operatorFeedbackLeadType === "partially_correct") ltPartial++;
    if (r.operatorFeedbackCommercialReadiness === "partially_correct") crPartial++;
    if (r.operatorFeedbackWeakSpots === "partially_correct") wsPartial++;
    if (r.operatorFeedbackBestOfferAngle === "partially_correct") offerPartial++;

    if (hasIncorrectFeedback(r)) {
      confSumIncorrect += r.confidenceScore;
      incorrectFindingLeadCount++;
    }

    if (r.operatorOverrideLeadType) overrideByField.lead_type++;
    if (r.operatorOverrideCommercialReadiness) overrideByField.commercial_readiness++;
    if (typeof r.operatorOverrideBestOfferAngle === "string" && r.operatorOverrideBestOfferAngle.trim().length > 0) {
      overrideByField.best_offer_angle++;
    }
    if (r.weakSpotsOverrideActive) overrideByField.weak_spots++;
  }

  const n = rows.length;

  const mostIncorrect = argMaxKey(incorrectByKind as unknown as Record<string, number>) as IncorrectFindingKind | null;
  const mostOverride = argMaxKey(overrideByField as unknown as Record<string, number>) as OverriddenFieldKind | null;

  const breakdowns = buildQualityBreakdownMaps(rows);
  const driftFlagsJson = buildDriftFlagsJson(rows, breakdowns, n);
  const confidenceCalibrationJson = buildConfidenceCalibrationJson(rows);
  const segmentAlertsJson = buildSegmentAlertsJson(rows, breakdowns);

  return {
    totalLeads: n,
    pipelineVersion: dominantPipeline,
    byPipelineVersion,
    byPlatform,
    byVertical,
    byLeadType,
    byCommercialReadiness,
    bySuggestedNextMove,
    byOperatorStatus,
    buyerIntentPresentCount,
    websiteMissingCount,
    lowCoverageCount,
    averageOpportunityScore: n ? oppSum / n : 0,
    percentPublic: n ? (publicCount / n) * 100 : 0,
    percentAccessLimited: n ? (accessLimitedCount / n) * 100 : 0,
    averageCoverage: n ? covSum / n : 0,
    averageConfidence: n ? confSum / n : 0,
    percentWithEvidence: n ? (evidenceCount / n) * 100 : 0,
    percentWithRepeatedAcrossPosts: n ? (repeatedAcrossCount / n) * 100 : 0,
    percentWithOverrides: n ? (overrideCount / n) * 100 : 0,
    percentFeedbackPresent: n ? (feedbackPresentCount / n) * 100 : 0,
    percentLeadTypeIncorrect: n ? (ltIncorrect / n) * 100 : 0,
    percentCommercialReadinessIncorrect: n ? (crIncorrect / n) * 100 : 0,
    percentWeakSpotsIncorrect: n ? (wsIncorrect / n) * 100 : 0,
    percentBestOfferAngleIncorrect: n ? (offerIncorrect / n) * 100 : 0,
    percentPartiallyCorrectLeadType: n ? (ltPartial / n) * 100 : 0,
    percentPartiallyCorrectCommercialReadiness: n ? (crPartial / n) * 100 : 0,
    percentPartiallyCorrectWeakSpots: n ? (wsPartial / n) * 100 : 0,
    percentPartiallyCorrectBestOfferAngle: n ? (offerPartial / n) * 100 : 0,
    mostCommonIncorrectFindingType: mostIncorrect,
    mostOverriddenField: mostOverride,
    avgConfidenceForIncorrectFindings:
      incorrectFindingLeadCount > 0 ? confSumIncorrect / incorrectFindingLeadCount : null,
    driftFlagsJson,
    qualityByVertical: breakdowns.byVertical,
    qualityByLeadType: breakdowns.byLeadType,
    qualityByPlatform: breakdowns.byPlatform,
    qualityByCommercialReadiness: breakdowns.byCommercialReadiness,
    confidenceCalibrationJson,
    segmentAlertsJson,
  };
}
