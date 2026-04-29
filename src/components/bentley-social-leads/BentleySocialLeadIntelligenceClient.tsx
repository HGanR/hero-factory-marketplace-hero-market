"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ConfidenceCalibrationJson,
  DriftFlagsJson,
  QualityBreakdownMap,
  RunBatchSummary,
  SegmentAlertsJson,
} from "@/lib/bentley-social-leads/computeBatchSummary";
import {
  drilldownPatchForCalibrationFinding,
  drilldownPatchForDrift,
  drilldownPatchForHandoffBucket,
  drilldownPatchForQualityRow,
  type DrilldownFilterPatch,
  rowMatchesSegmentDrilldown,
  type SegmentDrilldown,
} from "@/lib/bentley-social-leads/summaryDrilldown";
import { computeRunQualityDelta } from "@/lib/bentley-social-leads/computeRunQualityDelta";
import {
  parseStoredEvidenceJson,
  parseStoredFindingConfidenceJson,
  parseStoredRankingDiagnosticsJson,
  parseStoredTopLeadDriversJson,
} from "@/lib/bentley-social-leads/mapLeadAnalysisRow";
import type { LeadAnalysisRow } from "@/lib/bentley-social-leads/queryTypes";
import {
  buildContentInsightsBatch,
  computeEngineBatchSummary,
} from "@/lib/bentley-social-leads/engine";
import type { ContentInsightsBatch, EngineLeadBatchSummary, EngineSignals } from "@/lib/bentley-social-leads/engine";
import {
  buildBentleyContentBundleReadableNotes,
  buildContentBundleHandoff,
  buildSliHandoffFiltersApplied,
  serializeContentBundleHandoff,
  type BentleyContentBundleHandoff,
} from "@/lib/bentley-social-leads/handoff";
import { loadWorkflowState, saveWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  generateBentleySliSampleCsv,
  parseValidateCsvImport,
} from "@/lib/bentley-social-leads/import";
import type { CsvImportResult } from "@/lib/bentley-social-leads/import";

type UploadRow = {
  id: string;
  filename: string;
  sourceType: string;
  uploadedAt: string | null;
  parsedCount: number;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  totalLeads: number;
  successCount: number;
  failureCount: number;
  createdAt: string | null;
  pipelineVersion?: string | null;
  modelVersion?: string | null;
};

type LeadDetail = {
  record: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  comparisonAnalysis?: Record<string, unknown> | null;
  comparisonDeltas?: Record<string, unknown> | null;
};

const card =
  "rounded-2xl border border-cyan-500/35 bg-slate-900/50 p-5 shadow-lg";

const PRESET_FILTERS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  high_opportunity: (r) => r.opportunityScore >= 0.55,
  buyer_intent: (r) => r.buyerIntentPresent,
  website_missing: (r) => !r.websiteUrl,
  access_limited: (r) => r.accessStatus === "access_limited",
  manual_email_first: (r) => r.suggestedActionTags.includes("manual_email") || Boolean(r.email),
  manual_comment_first: (r) => r.suggestedActionTags.includes("manual_comment"),
  low_confidence: (r) => r.confidenceScore < 0.45,
};

/** Queue-style views (stack with row filters + optional presets). */
const QUEUE_VIEWS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  needs_review: (r) =>
    (r.operatorStatus === "new" || r.operatorStatus === "reviewing") && !r.manuallyReviewedAt,
  high_opp_not_reviewed: (r) => r.opportunityScore >= 0.55 && !r.manuallyReviewedAt,
  override_applied: (r) => r.hasOperatorFieldOverrides,
  low_cov_high_opp: (r) => r.overallCoverageScore < 0.35 && r.opportunityScore >= 0.5,
  contacted_manually: (r) => r.operatorStatus === "contacted_manually",
  revisit_later: (r) => r.operatorStatus === "revisit_later",
};

/** Calibration shortcuts (stack with queue + presets + row filters). */
const CALIBRATION_VIEWS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  high_opp_low_conf: (r) => r.opportunityScore >= 0.55 && r.confidenceScore < 0.45,
  low_opp_high_conf: (r) => r.opportunityScore < 0.45 && r.confidenceScore >= 0.55,
  override_high_conf: (r) => r.hasOperatorFieldOverrides && r.confidenceScore >= 0.55,
  repeat_q_weak_cta: (r) => r.repeatedAcrossPosts && r.effectiveWeakSpots.includes("weak_cta"),
  high_fit_watch: (r) => r.fitScore >= 0.55 && r.suggestedActionTags.includes("watch_only"),
};

function hasAnyFeedbackRow(r: LeadAnalysisRow): boolean {
  return Boolean(
    r.operatorFeedbackLeadType ||
      r.operatorFeedbackCommercialReadiness ||
      r.operatorFeedbackWeakSpots ||
      r.operatorFeedbackBestOfferAngle
  );
}

function hasNegativeFeedbackRow(r: LeadAnalysisRow): boolean {
  return (
    r.operatorFeedbackLeadType === "incorrect" ||
    r.operatorFeedbackCommercialReadiness === "incorrect" ||
    r.operatorFeedbackWeakSpots === "incorrect" ||
    r.operatorFeedbackBestOfferAngle === "incorrect"
  );
}

function feedbackOverrideMismatchRow(r: LeadAnalysisRow): boolean {
  if (!r.hasOperatorFieldOverrides) return false;
  if (r.operatorOverrideLeadType && r.operatorFeedbackLeadType === "incorrect") return true;
  if (r.operatorOverrideCommercialReadiness && r.operatorFeedbackCommercialReadiness === "incorrect") return true;
  if (
    typeof r.operatorOverrideBestOfferAngle === "string" &&
    r.operatorOverrideBestOfferAngle.trim().length > 0 &&
    r.operatorFeedbackBestOfferAngle === "incorrect"
  )
    return true;
  if (r.weakSpotsOverrideActive && r.operatorFeedbackWeakSpots === "incorrect") return true;
  return false;
}

/** Analyst feedback filters (stack with queue / calibration / presets). */
const FEEDBACK_VIEWS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  incorrect_lead_type: (r) => r.operatorFeedbackLeadType === "incorrect",
  incorrect_readiness: (r) => r.operatorFeedbackCommercialReadiness === "incorrect",
  incorrect_weak_spots: (r) => r.operatorFeedbackWeakSpots === "incorrect",
  partial_offer_angle: (r) => r.operatorFeedbackBestOfferAngle === "partially_correct",
  incorrect_offer_angle: (r) => r.operatorFeedbackBestOfferAngle === "incorrect",
  high_opp_negative_fb: (r) => r.opportunityScore >= 0.55 && hasNegativeFeedbackRow(r),
  override_feedback_mismatch: (r) => feedbackOverrideMismatchRow(r),
};

const HANDOFF_VIEWS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  handoff_ready: (r) => r.handoffReadiness === "ready",
  handoff_review: (r) => r.handoffReadiness === "review_needed",
  handoff_not_ready: (r) => r.handoffReadiness === "not_ready",
};

const PRODUCTIVITY_VIEWS: Record<string, (r: LeadAnalysisRow) => boolean> = {
  ready_handoff: (r) => r.handoffReadiness === "ready",
  feedback_pending: (r) =>
    !hasAnyFeedbackRow(r) &&
    !r.manuallyReviewedAt &&
    (r.operatorStatus === "new" || r.operatorStatus === "reviewing"),
  override_not_reviewed: (r) => r.hasOperatorFieldOverrides && !r.manuallyReviewedAt,
  high_opp_no_status: (r) => r.opportunityScore >= 0.55 && r.operatorStatus === "new",
  contacted_no_disposition: (r) =>
    r.operatorStatus === "contacted_manually" && !(r.operatorNotes?.trim()),
};

function formatDriversCompact(r: LeadAnalysisRow): string {
  const td = r.topLeadDriversJson;
  if (!td) return "—";
  const pos = td.topPositive.slice(0, 3).filter(Boolean).join(" · ");
  const lim = td.limitingFactors
    .slice(0, 2)
    .filter(Boolean)
    .map((x) => `− ${x}`)
    .join(" ");
  if (!pos && !lim) return "—";
  return [pos, lim].filter(Boolean).join(" | ");
}

function DriftWatchSection({
  flags,
  onDrill,
}: {
  flags: DriftFlagsJson;
  onDrill: (patch: DrilldownFilterPatch, label: string) => void;
}) {
  const f = flags.offerAnglePartiallyCorrectVerticalSpike;
  const lt = flags.weakSpotsOverrideSpikeLeadType;
  const pl = flags.weakSpotsOverrideSpikePlatform;
  const anyActive =
    flags.highConfidenceHighLeadTypeIncorrectRate ||
    flags.highConfidenceHighReadinessIncorrectRate ||
    f ||
    lt ||
    pl ||
    flags.repeatedNegativeFeedbackUnderLowCoverage;
  return (
    <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-rose-300/90 mb-2">Drift watch</p>
      {!anyActive ? (
        <p className="text-[11px] text-slate-500">No drift heuristics tripped (needs feedback volume ≥ 5 where noted).</p>
      ) : (
        <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4">
          {flags.highConfidenceHighLeadTypeIncorrectRate ? (
            <li className="text-rose-100/90">
              <button
                type="button"
                className="text-left underline decoration-rose-500/50 hover:text-rose-50"
                onClick={() => {
                  const p = drilldownPatchForDrift("lead_type_miscalibration", flags);
                  if (p) onDrill(p, "Drift · lead-type miscalibration");
                }}
              >
                High avg confidence on lead-type feedback, but incorrect rate is elevated.
              </button>
            </li>
          ) : null}
          {flags.highConfidenceHighReadinessIncorrectRate ? (
            <li className="text-rose-100/90">
              <button
                type="button"
                className="text-left underline decoration-rose-500/50 hover:text-rose-50"
                onClick={() => {
                  const p = drilldownPatchForDrift("readiness_miscalibration", flags);
                  if (p) onDrill(p, "Drift · readiness miscalibration");
                }}
              >
                High avg confidence on readiness feedback, but incorrect rate is elevated.
              </button>
            </li>
          ) : null}
          {f ? (
            <li>
              <button
                type="button"
                className="text-left underline decoration-amber-500/40 hover:text-amber-100"
                onClick={() => {
                  const p = drilldownPatchForDrift("offer_partial_vertical", flags);
                  if (p) onDrill(p, `Drift · partial offer angle · ${f.vertical}`);
                }}
              >
                Offer angle often “partial” in <span className="font-mono text-amber-200/90">{f.vertical}</span> (
                {f.partialRatePct.toFixed(0)}% of {f.sampleSize} with offer feedback)
              </button>
            </li>
          ) : null}
          {lt ? (
            <li>
              <button
                type="button"
                className="text-left underline decoration-amber-500/40 hover:text-amber-100"
                onClick={() => {
                  const p = drilldownPatchForDrift("weak_override_lead_type", flags);
                  if (p) onDrill(p, `Drift · weak-spot overrides · ${lt.leadType}`);
                }}
              >
                Weak-spot overrides frequent for <span className="font-mono text-amber-200/90">{lt.leadType}</span> (
                {lt.weakSpotsOverrideRatePct.toFixed(0)}% · n={lt.sampleSize})
              </button>
            </li>
          ) : null}
          {pl ? (
            <li>
              <button
                type="button"
                className="text-left underline decoration-amber-500/40 hover:text-amber-100"
                onClick={() => {
                  const p = drilldownPatchForDrift("weak_override_platform", flags);
                  if (p) onDrill(p, `Drift · weak-spot overrides · ${pl.platform}`);
                }}
              >
                Weak-spot overrides frequent on <span className="font-mono text-amber-200/90">{pl.platform}</span> (
                {pl.weakSpotsOverrideRatePct.toFixed(0)}% · n={pl.sampleSize})
              </button>
            </li>
          ) : null}
          {flags.repeatedNegativeFeedbackUnderLowCoverage ? (
            <li className="text-rose-100/90">
              <button
                type="button"
                className="text-left underline decoration-rose-500/50 hover:text-rose-50"
                onClick={() => {
                  const p = drilldownPatchForDrift("neg_feedback_low_cov", flags);
                  if (p) onDrill(p, "Drift · negative feedback under low coverage");
                }}
              >
                Negative finding feedback clusters under low extraction coverage.
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function CalibrationCellTable({
  label,
  cell,
  onClick,
}: {
  label: string;
  cell: ConfidenceCalibrationJson["leadType"];
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="text-[10px] text-indigo-200/80 mb-1">{label}</p>
      <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
        hi+ok {cell.highConfidenceCorrect} · hi+wrong {cell.highConfidenceIncorrect} · lo+ok {cell.lowConfidenceCorrect} · lo+wrong{" "}
        {cell.lowConfidenceIncorrect}
      </p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-indigo-500/25 bg-indigo-950/20 px-2 py-2 text-left w-full hover:border-indigo-400/50 hover:bg-indigo-950/35 transition-colors"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-indigo-500/25 bg-indigo-950/20 px-2 py-2">
      {inner}
    </div>
  );
}

function ConfidenceCalibrationSection({
  cal,
  onDrill,
}: {
  cal: ConfidenceCalibrationJson;
  onDrill: (patch: DrilldownFilterPatch, label: string) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-950/15 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-indigo-300/90 mb-2">Confidence calibration</p>
      <p className="text-[10px] text-slate-500 mb-2">
        High = score ≥ 0.55 · Low = &lt; 0.45 · Counts only rows with feedback on that finding. “ok” = correct or partial. Click a cell to
        filter.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        <CalibrationCellTable
          label="Lead type"
          cell={cal.leadType}
          onClick={() => onDrill(drilldownPatchForCalibrationFinding("lead_type"), "Calibration · lead type feedback")}
        />
        <CalibrationCellTable
          label="Readiness"
          cell={cal.commercialReadiness}
          onClick={() => onDrill(drilldownPatchForCalibrationFinding("commercial_readiness"), "Calibration · readiness feedback")}
        />
        <CalibrationCellTable
          label="Weak spots"
          cell={cal.weakSpots}
          onClick={() => onDrill(drilldownPatchForCalibrationFinding("weak_spots"), "Calibration · weak spots feedback")}
        />
        <CalibrationCellTable
          label="Offer angle"
          cell={cal.bestOfferAngle}
          onClick={() => onDrill(drilldownPatchForCalibrationFinding("best_offer_angle"), "Calibration · offer angle feedback")}
        />
      </div>
    </div>
  );
}

function QualityBreakdownBlock({
  title,
  data,
  dimension,
  onDrill,
}: {
  title: string;
  data: QualityBreakdownMap;
  dimension: "vertical" | "lead_type" | "platform" | "readiness";
  onDrill: (patch: DrilldownFilterPatch, label: string) => void;
}) {
  const keys = Object.keys(data).sort((a, b) => data[b]!.count - data[a]!.count);
  if (keys.length === 0) return null;
  return (
    <details className="mb-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1">
      <summary className="cursor-pointer text-xs text-slate-400 select-none">
        {title} <span className="text-slate-600">({keys.length})</span>
      </summary>
      <div className="overflow-x-auto mt-2">
        <table className="min-w-full text-[10px] font-mono text-slate-400">
          <thead>
            <tr className="text-left text-slate-500 border-b border-white/10">
              <th className="pr-2 pb-1">Key</th>
              <th className="pr-2 pb-1">n</th>
              <th className="pr-2 pb-1">cov</th>
              <th className="pr-2 pb-1">opp</th>
              <th className="pr-2 pb-1">conf</th>
              <th className="pr-2 pb-1">ovr%</th>
              <th className="pr-2 pb-1">wrong LT</th>
              <th className="pr-2 pb-1">wrong RD</th>
              <th className="pr-2 pb-1">wrong WS</th>
              <th className="pb-1">wrong offer</th>
            </tr>
          </thead>
          <tbody>
            {keys.slice(0, 14).map((k) => {
              const s = data[k]!;
              return (
                <tr
                  key={k}
                  className="border-b border-white/5 cursor-pointer hover:bg-white/[0.06]"
                  onClick={() =>
                    onDrill(
                      drilldownPatchForQualityRow(dimension, k),
                      `Segment · ${title} · ${k}`
                    )
                  }
                >
                  <td className="py-1 pr-2 text-slate-300 max-w-[140px] truncate" title={k}>
                    {k}
                  </td>
                  <td className="py-1 pr-2">{s.count}</td>
                  <td className="py-1 pr-2">{(s.avgCoverage * 100).toFixed(0)}%</td>
                  <td className="py-1 pr-2">{(s.avgOpportunity * 100).toFixed(0)}%</td>
                  <td className="py-1 pr-2">{(s.avgConfidence * 100).toFixed(0)}%</td>
                  <td className="py-1 pr-2">{s.percentOverride.toFixed(0)}%</td>
                  <td className="py-1 pr-2">{s.percentIncorrectLeadType.toFixed(0)}%</td>
                  <td className="py-1 pr-2">{s.percentIncorrectCommercialReadiness.toFixed(0)}%</td>
                  <td className="py-1 pr-2">{s.percentIncorrectWeakSpots.toFixed(0)}%</td>
                  <td className="py-1">{s.percentIncorrectBestOfferAngle.toFixed(0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function SegmentAlertsSection({
  alertsJson,
  onDrill,
}: {
  alertsJson: SegmentAlertsJson;
  onDrill: (patch: DrilldownFilterPatch, label: string) => void;
}) {
  const { alerts } = alertsJson;
  if (alerts.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/15 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wide text-amber-300/90 mb-2">Segment alerts</p>
      <ul className="text-[11px] text-slate-300 space-y-1.5">
        {alerts.slice(0, 12).map((a, i) => {
          const valLabel =
            a.kind === "low_avg_coverage" || a.kind === "low_calibration_quality"
              ? `${(a.value * 100).toFixed(0)}%`
              : `${a.value.toFixed(0)}%`;
          return (
            <li key={`${a.dimension}-${a.segmentKey}-${a.kind}-${i}`}>
              <button
                type="button"
                className="text-left underline decoration-amber-500/40 hover:text-amber-100"
                onClick={() =>
                  onDrill(
                    drilldownPatchForQualityRow(
                      a.dimension === "commercial_readiness" ? "readiness" : a.dimension,
                      a.segmentKey
                    ),
                    `Alert · ${a.kind} · ${a.dimension} · ${a.segmentKey}`
                  )
                }
              >
                <span className="font-mono text-amber-200/90">{a.dimension}</span> · {a.segmentKey} ·{" "}
                <span className="text-slate-400">{a.kind}</span> · {valLabel} (n={a.sampleSize})
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContentIntelligenceSection({
  insights,
  engineSummary,
  filteredCount,
  totalRunCount,
  extraActions,
  handoffFooter,
}: {
  insights: ContentInsightsBatch;
  engineSummary: EngineLeadBatchSummary;
  filteredCount: number;
  totalRunCount: number;
  extraActions?: ReactNode;
  handoffFooter?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const payload = JSON.stringify(insights, null, 2);

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Could not copy to clipboard.");
    }
  }

  const topPain = Object.entries(engineSummary.byPainType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topUrgency = Object.entries(engineSummary.byUrgency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const topStage = Object.entries(engineSummary.byCommercialStage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className={`${card} mb-4 border-violet-500/30`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-violet-200">Bentley Engine · content intelligence</h2>
          <p className="text-[11px] text-slate-500 mt-1">
            Derived from the <span className="text-violet-300/90">current table filters</span> ({filteredCount} of{" "}
            {totalRunCount} in run). Copy JSON for AI Revenue OS / Content Bundle workflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => void copyPayload()}
            className="rounded-lg border border-violet-500/40 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-100 hover:border-violet-400/60"
          >
            {copied ? "Copied" : "Copy insights JSON"}
          </button>
          {extraActions}
          <Link
            href="/ai-revenue-os"
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500/40 hover:text-white"
          >
            AI Revenue OS →
          </Link>
        </div>
        {handoffFooter ? (
          <div className="mt-2 text-[11px] text-slate-500">{handoffFooter}</div>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4">
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-500">Avg engine intent</p>
          <p className="text-xl font-mono text-violet-200">
            {engineSummary.avgIntentScore0To100 > 0 ? engineSummary.avgIntentScore0To100.toFixed(0) : "—"}
            <span className="text-xs text-slate-500 ml-1">/100</span>
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <p className="text-[10px] uppercase text-slate-500">Avg confidence</p>
          <p className="text-xl font-mono text-fuchsia-200/90">
            {(engineSummary.avgConfidence0To1 * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] uppercase text-slate-500 mb-1">Engine pain / urgency / stage (top)</p>
          <p className="text-[11px] font-mono text-slate-300 leading-snug">
            <span className="text-slate-500">pain:</span>{" "}
            {topPain.length ? topPain.map(([k, v]) => `${k}(${v})`).join(" · ") : "—"}{" "}
            <span className="text-slate-600">|</span> <span className="text-slate-500">urg:</span>{" "}
            {topUrgency.length ? topUrgency.map(([k, v]) => `${k}(${v})`).join(" · ") : "—"}{" "}
            <span className="text-slate-600">|</span> <span className="text-slate-500">stage:</span>{" "}
            {topStage.length ? topStage.map(([k, v]) => `${k}(${v})`).join(" · ") : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 mb-4">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">What the market is saying</p>
        <p className="text-sm text-slate-200">{insights.marketSummary}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-violet-400/80 mb-2">Hook ideas (top)</p>
          <ul className="space-y-1.5 text-[13px] text-slate-300 list-disc pl-4">
            {insights.hookIdeas.length === 0 ? (
              <li className="text-slate-500 list-none -ml-4">No engine hooks yet — run analysis on leads with comment text.</li>
            ) : (
              insights.hookIdeas.map((h, i) => (
                <li key={i}>{h}</li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-violet-400/80 mb-2">CTA angles · offer angles</p>
          <ul className="text-[12px] text-slate-400 space-y-1 mb-3">
            <li>
              <span className="text-slate-500">CTAs:</span> {insights.ctaAngles.length ? insights.ctaAngles.join(" · ") : "—"}
            </li>
            <li>
              <span className="text-slate-500">Offers:</span> {insights.offerAngles.length ? insights.offerAngles.join(" · ") : "—"}
            </li>
          </ul>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Top objections (from evidence)</p>
          <ul className="text-[12px] text-slate-400 space-y-0.5 list-disc pl-4">
            {insights.topObjections.length === 0 ? (
              <li className="text-slate-500 list-none -ml-4">—</li>
            ) : (
              insights.topObjections.slice(0, 6).map((o, i) => (
                <li key={i}>
                  <span className="text-slate-300">{o.text}</span>{" "}
                  <span className="text-slate-600">×{o.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/90 mb-2">Content pillars</p>
          <ul className="text-[12px] text-slate-300 list-disc pl-4 space-y-1">
            {insights.contentPillars.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-amber-300/90 mb-2">What to post next</p>
          <ul className="text-[12px] text-slate-300 list-decimal pl-4 space-y-1">
            {insights.whatToPostNext.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 mt-3 font-mono">schema v{insights.schemaVersion} · {insights.generatedAt}</p>
    </div>
  );
}

export function BentleySocialLeadIntelligenceClient() {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [csvPreview, setCsvPreview] = useState<{
    fileName: string;
    text: string;
    result: CsvImportResult;
  } | null>(null);
  const [csvDragActive, setCsvDragActive] = useState(false);

  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rows, setRows] = useState<LeadAnalysisRow[]>([]);
  const [batchSummary, setBatchSummary] = useState<RunBatchSummary | null>(null);

  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterAccess, setFilterAccess] = useState("");
  const [filterOppMin, setFilterOppMin] = useState(0);
  const [filterBuyerIntent, setFilterBuyerIntent] = useState<"" | "yes" | "no">("");
  const [filterWebsite, setFilterWebsite] = useState<"" | "missing" | "present">("");
  const [filterEmail, setFilterEmail] = useState<"" | "yes" | "no">("");
  const [filterNextMove, setFilterNextMove] = useState("");
  const [filterPreset, setFilterPreset] = useState<string>("");
  const [filterQueue, setFilterQueue] = useState<string>("");
  const [filterCalibration, setFilterCalibration] = useState<string>("");
  const [filterFeedback, setFilterFeedback] = useState<string>("");
  const [filterProductivity, setFilterProductivity] = useState<string>("");
  const [filterHandoff, setFilterHandoff] = useState<string>("");
  const [segmentDrilldown, setSegmentDrilldown] = useState<SegmentDrilldown | null>(null);
  const [summaryDrilldownLabel, setSummaryDrilldownLabel] = useState<string | null>(null);

  const [compareQualityRunId, setCompareQualityRunId] = useState<string | null>(null);
  const [baselineSummaryForQuality, setBaselineSummaryForQuality] = useState<RunBatchSummary | null>(null);

  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailAnalysisId, setDetailAnalysisId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCompareRunId, setDetailCompareRunId] = useState<string | null>(null);
  const [detailLeadRow, setDetailLeadRow] = useState<LeadAnalysisRow | null>(null);

  const loadUploads = useCallback(async () => {
    const r = await fetch("/api/bentley-social-leads/uploads", { credentials: "include" });
    if (!r.ok) {
      if (r.status === 401) setErr("Sign in required.");
      return;
    }
    const j = (await r.json()) as { uploads: UploadRow[] };
    setUploads(j.uploads ?? []);
  }, []);

  useEffect(() => {
    void loadUploads();
  }, [loadUploads]);

  const loadUploadDetail = useCallback(async (id: string, preferredRunId?: string | null) => {
    const r = await fetch(`/api/bentley-social-leads/uploads/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!r.ok) return;
    const j = (await r.json()) as { runs: RunRow[] };
    const list = j.runs ?? [];
    setRuns(list);
    if (preferredRunId && list.some((x) => x.id === preferredRunId)) {
      setSelectedRunId(preferredRunId);
    } else {
      setSelectedRunId(list[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    if (selectedUploadId) void loadUploadDetail(selectedUploadId);
  }, [selectedUploadId, loadUploadDetail]);

  useEffect(() => {
    setCompareQualityRunId(null);
  }, [selectedUploadId]);

  useEffect(() => {
    setSegmentDrilldown(null);
    setSummaryDrilldownLabel(null);
  }, [selectedRunId]);

  const applySummaryDrilldown = useCallback((patch: DrilldownFilterPatch, label: string) => {
    if (patch.filterFeedback) setFilterFeedback(patch.filterFeedback);
    if (patch.filterCalibration) setFilterCalibration(patch.filterCalibration);
    if (patch.filterQueue) setFilterQueue(patch.filterQueue);
    if (patch.filterPreset) setFilterPreset(patch.filterPreset);
    if (patch.filterHandoff) setFilterHandoff(patch.filterHandoff);
    if (patch.filterProductivity) setFilterProductivity(patch.filterProductivity);
    if (patch.filterPlatform) setFilterPlatform(patch.filterPlatform);
    if (patch.filterNextMove) setFilterNextMove(patch.filterNextMove);
    if (patch.segmentDrilldown) setSegmentDrilldown(patch.segmentDrilldown);
    setSummaryDrilldownLabel(label);
  }, []);

  const loadAnalyses = useCallback(async () => {
    if (!selectedUploadId || !selectedRunId) {
      setRows([]);
      return;
    }
    const r = await fetch(
      `/api/bentley-social-leads/analyses?uploadId=${encodeURIComponent(selectedUploadId)}&runId=${encodeURIComponent(selectedRunId)}&includeSummary=1`,
      { credentials: "include" }
    );
    if (!r.ok) return;
    const j = (await r.json()) as {
      rows: LeadAnalysisRow[];
      summary?: RunBatchSummary;
      summarySource?: "computed" | "stored";
    };
    setRows(j.rows ?? []);
    setBatchSummary(j.summary ?? null);
  }, [selectedUploadId, selectedRunId]);

  useEffect(() => {
    void loadAnalyses();
  }, [loadAnalyses]);

  useEffect(() => {
    if (!selectedUploadId || !compareQualityRunId || compareQualityRunId === selectedRunId) {
      setBaselineSummaryForQuality(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await fetch(
        `/api/bentley-social-leads/analyses?uploadId=${encodeURIComponent(selectedUploadId)}&runId=${encodeURIComponent(compareQualityRunId)}&omitRows=1&includeSummary=1&preferStoredSummary=1`,
        { credentials: "include" }
      );
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as { summary?: RunBatchSummary };
      if (!cancelled) setBaselineSummaryForQuality(j.summary ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUploadId, selectedRunId, compareQualityRunId]);

  const handoffCounts = useMemo(() => {
    let ready = 0;
    let review = 0;
    let notReady = 0;
    for (const r of rows) {
      if (r.handoffReadiness === "ready") ready++;
      else if (r.handoffReadiness === "review_needed") review++;
      else notReady++;
    }
    return { ready, review, notReady };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (!rowMatchesSegmentDrilldown(row, segmentDrilldown)) return false;
      if (filterQueue && QUEUE_VIEWS[filterQueue] && !QUEUE_VIEWS[filterQueue](row)) return false;
      if (filterCalibration && CALIBRATION_VIEWS[filterCalibration] && !CALIBRATION_VIEWS[filterCalibration](row)) {
        return false;
      }
      if (filterFeedback && FEEDBACK_VIEWS[filterFeedback] && !FEEDBACK_VIEWS[filterFeedback](row)) return false;
      if (filterProductivity && PRODUCTIVITY_VIEWS[filterProductivity] && !PRODUCTIVITY_VIEWS[filterProductivity](row)) {
        return false;
      }
      if (filterHandoff && HANDOFF_VIEWS[filterHandoff] && !HANDOFF_VIEWS[filterHandoff](row)) return false;
      if (filterPreset && PRESET_FILTERS[filterPreset] && !PRESET_FILTERS[filterPreset](row)) return false;
      if (filterPlatform && !row.platform.toLowerCase().includes(filterPlatform.toLowerCase())) return false;
      if (filterAccess && row.accessStatus !== filterAccess) return false;
      if (row.opportunityScore < filterOppMin) return false;
      if (filterBuyerIntent === "yes" && !row.buyerIntentPresent) return false;
      if (filterBuyerIntent === "no" && row.buyerIntentPresent) return false;
      if (filterWebsite === "missing" && row.websiteUrl) return false;
      if (filterWebsite === "present" && !row.websiteUrl) return false;
      if (filterEmail === "yes" && !row.email) return false;
      if (filterEmail === "no" && row.email) return false;
      if (filterNextMove.trim() && !(row.suggestedNextMove ?? "").toLowerCase().includes(filterNextMove.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [
    rows,
    segmentDrilldown,
    filterQueue,
    filterCalibration,
    filterFeedback,
    filterProductivity,
    filterHandoff,
    filterPreset,
    filterPlatform,
    filterAccess,
    filterOppMin,
    filterBuyerIntent,
    filterWebsite,
    filterEmail,
    filterNextMove,
  ]);

  const contentInsights = useMemo(() => buildContentInsightsBatch(filtered), [filtered]);
  const engineBatchSummary = useMemo(() => computeEngineBatchSummary(filtered), [filtered]);

  const selectedUpload = useMemo(
    () => uploads.find((u) => u.id === selectedUploadId) ?? null,
    [uploads, selectedUploadId]
  );

  const HANDOFF_LAST_ID_KEY = "bentley_sli_last_handoff_id";
  const HANDOFF_DRAFT_KEY = "bentley_sli_content_bundle_handoff_draft_v1";

  const [handoffSendState, setHandoffSendState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [lastHandoffIdLocal, setLastHandoffIdLocal] = useState<string | null>(null);
  const [handoffActionErr, setHandoffActionErr] = useState<string | null>(null);
  const [handoffPreviewOpen, setHandoffPreviewOpen] = useState(false);
  const [handoffPreviewTab, setHandoffPreviewTab] = useState<"readable" | "json">("readable");
  const [previewPayload, setPreviewPayload] = useState<BentleyContentBundleHandoff | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem(HANDOFF_LAST_ID_KEY);
      if (id) setLastHandoffIdLocal(id);
    } catch {
      /* ignore */
    }
  }, []);

  const buildCurrentHandoffPayload = useCallback((): BentleyContentBundleHandoff | null => {
    if (!selectedRunId || filtered.length === 0) return null;
    return buildContentBundleHandoff({
      insights: contentInsights,
      engineSummary: engineBatchSummary,
      filteredRows: filtered,
      totalRunRowCount: rows.length,
      filtersApplied: buildSliHandoffFiltersApplied({
        filterPlatform,
        filterAccess,
        filterOppMin,
        filterBuyerIntent,
        filterWebsite,
        filterEmail,
        filterNextMove,
        filterPreset,
        filterQueue,
        filterCalibration,
        filterFeedback,
        filterProductivity,
        filterHandoff,
        segmentDrilldown,
      }),
      provenance: {
        uploadId: selectedUploadId,
        runId: selectedRunId,
        uploadSourceType: selectedUpload?.sourceType ?? null,
        uploadFilename: selectedUpload?.filename ?? null,
        csvImportFileName: selectedUpload?.sourceType === "csv_sli" ? selectedUpload.filename : null,
        csvValidRowsImported: selectedUpload?.sourceType === "csv_sli" ? selectedUpload.parsedCount : null,
        totalRunRowCount: rows.length,
        filteredLeadRecordIds: filtered.map((r) => r.leadRecordId),
        filteredAnalysisIds: filtered.map((r) => r.analysisId),
      },
    });
  }, [
    selectedRunId,
    filtered,
    contentInsights,
    engineBatchSummary,
    rows.length,
    filterPlatform,
    filterAccess,
    filterOppMin,
    filterBuyerIntent,
    filterWebsite,
    filterEmail,
    filterNextMove,
    filterPreset,
    filterQueue,
    filterCalibration,
    filterFeedback,
    filterProductivity,
    filterHandoff,
    segmentDrilldown,
    selectedUploadId,
    selectedUpload,
  ]);

  const canBuildHandoff = Boolean(selectedRunId && filtered.length > 0);

  async function sendHandoffToAiRevenueOs() {
    const p = buildCurrentHandoffPayload();
    if (!p) {
      setHandoffActionErr("Select a run with at least one filtered row.");
      return;
    }
    setHandoffActionErr(null);
    setHandoffSendState("loading");
    try {
      const r = await fetch("/api/bentley-social-leads/content-bundle-handoff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: p }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; handoffId?: string; createdAt?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "Handoff failed");
      const full: BentleyContentBundleHandoff = {
        ...p,
        handoffId: j.handoffId,
        createdAt: j.createdAt ?? p.createdAt,
      };
      try {
        if (j.handoffId) localStorage.setItem(HANDOFF_LAST_ID_KEY, j.handoffId);
      } catch {
        /* ignore */
      }
      setLastHandoffIdLocal(j.handoffId ?? null);
      const ws = loadWorkflowState();
      saveWorkflowState({
        ...ws,
        artifacts: { ...ws.artifacts, bentleySliContentHandoff: full },
      });
      setHandoffSendState("ok");
      window.setTimeout(() => setHandoffSendState("idle"), 5000);
    } catch (e) {
      setHandoffSendState("idle");
      setHandoffActionErr(e instanceof Error ? e.message : "Handoff failed");
    }
  }

  function openHandoffPreview() {
    const p = buildCurrentHandoffPayload();
    if (!p) {
      setHandoffActionErr("Nothing to preview — adjust filters or run analysis.");
      return;
    }
    setHandoffActionErr(null);
    setPreviewPayload(p);
    setHandoffPreviewTab("readable");
    setHandoffPreviewOpen(true);
  }

  function saveHandoffDraftLocal() {
    const p = buildCurrentHandoffPayload();
    if (!p) {
      setHandoffActionErr("Nothing to save — adjust filters.");
      return;
    }
    try {
      localStorage.setItem(HANDOFF_DRAFT_KEY, serializeContentBundleHandoff(p));
      setHandoffActionErr(null);
    } catch {
      setHandoffActionErr("Could not save draft (storage unavailable).");
    }
  }

  async function viewLastHandoffFromServer() {
    setHandoffActionErr(null);
    try {
      const r = await fetch("/api/bentley-social-leads/content-bundle-handoff", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      const j = (await r.json()) as { handoff: BentleyContentBundleHandoff | null };
      if (!j.handoff) {
        setHandoffActionErr("No handoff on server yet.");
        return;
      }
      setPreviewPayload(j.handoff);
      setHandoffPreviewTab("readable");
      setHandoffPreviewOpen(true);
    } catch (e) {
      setHandoffActionErr(e instanceof Error ? e.message : "Load failed");
    }
  }

  function downloadSampleCsv() {
    const blob = new Blob([generateBentleySliSampleCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bentley-sli-comment-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyCsvPreviewFromText(text: string, fileName: string) {
    setErr(null);
    const result = parseValidateCsvImport(text);
    setCsvPreview({ fileName, text, result });
  }

  async function onCsvFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const t = await file.text();
    applyCsvPreviewFromText(t, file.name);
    e.target.value = "";
  }

  async function commitCsvImport() {
    if (!csvPreview) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/bentley-social-leads/uploads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "csv_sli",
          csvText: csvPreview.text,
          filename: csvPreview.fileName,
        }),
      });
      const j = (await r.json()) as { error?: string; uploadId?: string };
      if (!r.ok) throw new Error(j.error || "Import failed");
      setCsvPreview(null);
      await loadUploads();
      if (j.uploadId) setSelectedUploadId(j.uploadId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitPaste(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/bentley-social-leads/uploads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "paste", text: pasteText, filename: "paste.txt" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setPasteText("");
      await loadUploads();
      setSelectedUploadId(j.uploadId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      const ext = file.name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : file.name.toLowerCase().endsWith(".csv")
          ? "csv"
          : "txt";
      fd.set("sourceType", ext);
      fd.set("file", file);
      const r = await fetch("/api/bentley-social-leads/uploads", { method: "POST", credentials: "include", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      await loadUploads();
      setSelectedUploadId(j.uploadId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function runAnalysis() {
    if (!selectedUploadId) {
      setErr("Select an upload first.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/bentley-social-leads/runs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: selectedUploadId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Run failed");
      const runId = j.runId as string;
      await loadUploadDetail(selectedUploadId, runId);
      const r2 = await fetch(
        `/api/bentley-social-leads/analyses?uploadId=${encodeURIComponent(selectedUploadId)}&runId=${encodeURIComponent(runId)}`,
        { credentials: "include" }
      );
      if (r2.ok) {
        const ja = (await r2.json()) as { rows: LeadAnalysisRow[]; summary?: RunBatchSummary };
        setRows(ja.rows ?? []);
        setBatchSummary(ja.summary ?? null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const loadLeadDetail = useCallback(
    async (leadRecordId: string, compareRunId?: string | null) => {
      if (!selectedRunId) return;
      const qs = new URLSearchParams({ runId: selectedRunId });
      if (compareRunId) qs.set("compareRunId", compareRunId);
      const r = await fetch(
        `/api/bentley-social-leads/lead-records/${encodeURIComponent(leadRecordId)}?${qs}`,
        { credentials: "include" }
      );
      if (!r.ok) return;
      const j = (await r.json()) as LeadDetail;
      setDetail(j);
    },
    [selectedRunId]
  );

  async function openDetail(leadRecordId: string, analysisId: string) {
    if (!selectedRunId) return;
    setDetailLeadRow(rows.find((x) => x.leadRecordId === leadRecordId) ?? null);
    setDetailCompareRunId(null);
    setDetailAnalysisId(analysisId);
    setDetailOpen(true);
    await loadLeadDetail(leadRecordId, null);
  }

  async function exportCsv() {
    if (!selectedUploadId || !selectedRunId) return;
    const r = await fetch(
      `/api/bentley-social-leads/export?uploadId=${encodeURIComponent(selectedUploadId)}&runId=${encodeURIComponent(selectedRunId)}`,
      { credentials: "include" }
    );
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bentley-sli-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportHandoffCsv() {
    if (!selectedUploadId || !selectedRunId) return;
    const r = await fetch(
      `/api/bentley-social-leads/export?uploadId=${encodeURIComponent(selectedUploadId)}&runId=${encodeURIComponent(selectedRunId)}&format=handoff`,
      { credentials: "include" }
    );
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bentley-handoff.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/90 mb-2">Bentley · Revenue OS</p>
          <h1 className="text-3xl md:text-4xl font-bold text-white">Social Lead Intelligence</h1>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Upload GOLD leads, run public-surface analysis, review scores and manual follow-up angles.{" "}
            <span className="text-amber-200/90">Analysis only</span> — no auto-DM, email, comments, or follows.
          </p>
        </div>
        <Link
          href="/revenue-os/dashboard"
          className="text-sm text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 rounded-xl px-4 py-2"
        >
          ← Revenue OS Dashboard
        </Link>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {err}
        </div>
      )}

      <div
        className={`${card} mb-6 border-violet-500/25 ${
          csvDragActive ? "ring-2 ring-violet-500/50 bg-violet-950/20" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCsvDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setCsvDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCsvDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (!f) return;
          const ok = f.name.toLowerCase().endsWith(".csv") || f.type === "text/csv" || f.type === "application/vnd.ms-excel";
          if (!ok) {
            setErr("Drop a .csv file for comment import.");
            return;
          }
          void f.text().then((t) => applyCsvPreviewFromText(t, f.name));
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-violet-200">CSV comment import</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Import public comment rows for signal detection (manual review only). Required columns:{" "}
              <span className="font-mono text-slate-400">platform</span>,{" "}
              <span className="font-mono text-slate-400">commentText</span>. Drag/drop or choose a file, preview
              validation, then import valid rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadSampleCsv()}
              className="rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-1.5 text-xs text-violet-100 hover:border-violet-400/60"
            >
              Download sample CSV
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-slate-400">
            <span className="sr-only">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="text-xs file:mr-2 file:rounded file:border-0 file:bg-violet-900/80 file:px-2 file:py-1 file:text-violet-100"
              onChange={(e) => void onCsvFileInput(e)}
              disabled={busy}
            />
          </label>
          {csvPreview ? (
            <>
              <span className="text-xs font-mono text-slate-500 truncate max-w-[200px]" title={csvPreview.fileName}>
                {csvPreview.fileName}
              </span>
              <button
                type="button"
                onClick={() => setCsvPreview(null)}
                className="text-xs text-slate-500 hover:text-white underline"
              >
                Discard preview
              </button>
            </>
          ) : null}
        </div>
        {csvPreview ? (
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-slate-500 text-xs">Parsed rows</span>
                <p className="font-mono text-white">{csvPreview.result.summary.totalDataRows}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Valid</span>
                <p className="font-mono text-emerald-300">{csvPreview.result.summary.validCount}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Invalid</span>
                <p className="font-mono text-rose-300">{csvPreview.result.summary.invalidCount}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Warnings</span>
                <p className="font-mono text-amber-200/90">{csvPreview.result.summary.warningCount}</p>
              </div>
            </div>
            {csvPreview.result.invalidRows.length > 0 ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-amber-200/90">
                  Invalid rows ({csvPreview.result.invalidRows.length}) — click to expand
                </summary>
                <ul className="mt-2 space-y-2 text-slate-400 max-h-40 overflow-y-auto">
                  {csvPreview.result.invalidRows.slice(0, 12).map((inv) => (
                    <li key={inv.rowNumber} className="border-b border-white/5 pb-2">
                      <span className="font-mono text-slate-300">Row {inv.rowNumber}</span>:{" "}
                      {inv.messages
                        .filter((m) => m.severity === "error")
                        .map((m) => m.text)
                        .join(" · ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || csvPreview.result.validRows.length === 0}
                onClick={() => void commitCsvImport()}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2"
              >
                {busy ? "Working…" : "Import valid rows"}
              </button>
              <p className="text-[11px] text-slate-500 self-center">
                Only validated rows are written. Re-run analysis from Recent uploads after import.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">No CSV preview — select a file or drop a .csv here.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className={card}>
          <h2 className="text-lg font-semibold text-cyan-300 mb-3">Paste leads</h2>
          <p className="text-xs text-slate-500 mb-2">
            CSV-style rows (header row) or loose lines with profile URLs / handles.
          </p>
          <form onSubmit={onSubmitPaste} className="space-y-3">
            <textarea
              className="w-full min-h-[140px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder={`business_name,platform,handle,profile_url\nAcme Co,instagram,acmeco,https://instagram.com/acmeco`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload pasted text"}
            </button>
          </form>
        </div>

        <div className={card}>
          <h2 className="text-lg font-semibold text-cyan-300 mb-3">Upload file</h2>
          <p className="text-xs text-slate-500 mb-2">CSV, TXT, or PDF (text extracted).</p>
          <input type="file" accept=".csv,.txt,.pdf,text/plain" onChange={onFileChange} disabled={busy} />
        </div>
      </div>

      <div className={`${card} mb-6`}>
        <h2 className="text-lg font-semibold text-cyan-300 mb-3">Recent uploads</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-slate-500">No uploads yet.</p>
        ) : (
          <ul className="space-y-2">
            {uploads.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUploadId(u.id);
                  }}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedUploadId === u.id
                      ? "border-cyan-500/60 bg-cyan-950/40"
                      : "border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  <span className="text-white font-medium">{u.filename}</span>{" "}
                  {u.sourceType === "csv_sli" ? (
                    <span className="inline-block rounded border border-violet-500/40 bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-violet-200 mr-1">
                      CSV import
                    </span>
                  ) : null}
                  <span className="text-slate-500">
                    · {u.sourceType} · {u.parsedCount} rows · {u.status}
                  </span>
                  <span className="block text-xs text-slate-600 font-mono mt-0.5">{u.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => void runAnalysis()}
            disabled={busy || !selectedUploadId}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Running…" : "Run analysis on selected upload"}
          </button>
          {selectedUpload?.sourceType === "csv_sli" ? (
            <span className="text-[11px] text-violet-300/90 rounded-lg border border-violet-500/35 bg-violet-950/20 px-2 py-1">
              Import: <span className="font-mono text-violet-100">{selectedUpload.filename}</span> ·{" "}
              {selectedUpload.parsedCount} rows
            </span>
          ) : null}
          {selectedRunId && (
            <>
              <button
                type="button"
                onClick={() => void exportCsv()}
                className="rounded-xl border border-white/20 text-sm px-4 py-2 hover:bg-white/5"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void exportHandoffCsv()}
                className="rounded-xl border border-emerald-500/35 text-sm px-4 py-2 text-emerald-200/90 hover:bg-emerald-950/30"
              >
                Operator handoff CSV
              </button>
            </>
          )}
        </div>
        {runs.length > 0 && (
          <div className="mt-3">
            <label className="text-xs text-slate-500">Analysis run</label>
            <select
              className="mt-1 block w-full max-w-md rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
              value={selectedRunId ?? ""}
              onChange={(e) => setSelectedRunId(e.target.value || null)}
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.pipelineVersion ?? r.modelVersion ?? "run"} · {r.status} · ok {r.successCount} / {r.totalLeads} ·{" "}
                  {r.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={`${card} mb-4`}>
        <h2 className="text-lg font-semibold text-cyan-300 mb-2">Filters</h2>
        <p className="text-xs text-slate-500 mb-3">
          Queue, calibration, feedback, and productivity views stack with presets and row filters below.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] text-slate-500 w-full uppercase tracking-wide">Queue</span>
          {(
            [
              ["", "All leads"],
              ["needs_review", "Needs review"],
              ["high_opp_not_reviewed", "High opp · not reviewed"],
              ["override_applied", "Override applied"],
              ["low_cov_high_opp", "Low coverage · high opp"],
              ["contacted_manually", "Contacted manually"],
              ["revisit_later", "Revisit later"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "q-none"}
              type="button"
              onClick={() => setFilterQueue(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterQueue === id
                  ? "border-violet-500/60 bg-violet-950/50 text-violet-100"
                  : "border-white/10 text-slate-400 hover:border-violet-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] text-slate-500 w-full uppercase tracking-wide">Calibration</span>
          {(
            [
              ["", "All (no calibration view)"],
              ["high_opp_low_conf", "High opp · low confidence"],
              ["low_opp_high_conf", "Low opp · high confidence"],
              ["override_high_conf", "Override · high confidence"],
              ["repeat_q_weak_cta", "Repeated Q · weak CTA"],
              ["high_fit_watch", "High fit · watch only"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "cal-none"}
              type="button"
              onClick={() => setFilterCalibration(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterCalibration === id
                  ? "border-amber-500/55 bg-amber-950/40 text-amber-100"
                  : "border-white/10 text-slate-400 hover:border-amber-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] text-slate-500 w-full uppercase tracking-wide">Feedback</span>
          {(
            [
              ["", "All (no feedback view)"],
              ["incorrect_lead_type", "Incorrect lead type"],
              ["incorrect_readiness", "Incorrect readiness"],
              ["incorrect_weak_spots", "Incorrect weak spots"],
              ["incorrect_offer_angle", "Incorrect offer angle"],
              ["partial_offer_angle", "Partially correct offer angle"],
              ["high_opp_negative_fb", "High opp · negative feedback"],
              ["override_feedback_mismatch", "Override · feedback mismatch"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "fb-none"}
              type="button"
              onClick={() => setFilterFeedback(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterFeedback === id
                  ? "border-rose-500/55 bg-rose-950/35 text-rose-100"
                  : "border-white/10 text-slate-400 hover:border-rose-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] text-slate-500 w-full uppercase tracking-wide">Productivity</span>
          {(
            [
              ["", "All (no productivity view)"],
              ["ready_handoff", "Ready for handoff"],
              ["feedback_pending", "Feedback pending"],
              ["override_not_reviewed", "Override · not reviewed"],
              ["high_opp_no_status", "High opp · no status"],
              ["contacted_no_disposition", "Contacted · no disposition"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "prod-none"}
              type="button"
              onClick={() => setFilterProductivity(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterProductivity === id
                  ? "border-sky-500/50 bg-sky-950/40 text-sky-100"
                  : "border-white/10 text-slate-400 hover:border-sky-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] text-slate-500 w-full uppercase tracking-wide">Handoff</span>
          {(
            [
              ["", "All (no handoff filter)"],
              ["handoff_ready", "Handoff ready"],
              ["handoff_review", "Handoff review needed"],
              ["handoff_not_ready", "Handoff not ready"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "ho-none"}
              type="button"
              onClick={() => setFilterHandoff(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterHandoff === id
                  ? "border-lime-500/50 bg-lime-950/35 text-lime-100"
                  : "border-white/10 text-slate-400 hover:border-lime-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ["", "All (no preset)"],
              ["high_opportunity", "High opportunity"],
              ["buyer_intent", "Buyer intent present"],
              ["website_missing", "Website missing"],
              ["access_limited", "Access limited"],
              ["manual_email_first", "Manual email first"],
              ["manual_comment_first", "Manual comment first"],
              ["low_confidence", "Low confidence review"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id || "none"}
              type="button"
              onClick={() => setFilterPreset(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                filterPreset === id
                  ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-100"
                  : "border-white/10 text-slate-400 hover:border-cyan-500/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label className="block">
            <span className="text-slate-500 text-xs">Platform contains</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Access status</span>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterAccess}
              onChange={(e) => setFilterAccess(e.target.value)}
            >
              <option value="">Any</option>
              <option value="public">public</option>
              <option value="access_limited">access_limited</option>
              <option value="private">private</option>
              <option value="broken_link">broken_link</option>
              <option value="not_found">not_found</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Opportunity ≥</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterOppMin}
              onChange={(e) => setFilterOppMin(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Buyer intent (comments)</span>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterBuyerIntent}
              onChange={(e) => setFilterBuyerIntent(e.target.value as "" | "yes" | "no")}
            >
              <option value="">Any</option>
              <option value="yes">Present</option>
              <option value="no">Not detected</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Website</span>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterWebsite}
              onChange={(e) => setFilterWebsite(e.target.value as "" | "missing" | "present")}
            >
              <option value="">Any</option>
              <option value="missing">Missing</option>
              <option value="present">Present</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Email on lead</span>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterEmail}
              onChange={(e) => setFilterEmail(e.target.value as "" | "yes" | "no")}
            >
              <option value="">Any</option>
              <option value="yes">Present</option>
              <option value="no">Missing</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-500 text-xs">Suggested next move contains</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5"
              value={filterNextMove}
              onChange={(e) => setFilterNextMove(e.target.value)}
            />
          </label>
        </div>
      </div>

      {batchSummary && selectedRunId && (
        <div className={`${card} mb-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-cyan-300">Run summary</h2>
            {batchSummary.pipelineVersion ? (
              <p className="text-[10px] font-mono text-slate-500">
                pipeline <span className="text-cyan-200/80">{batchSummary.pipelineVersion}</span>
              </p>
            ) : null}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Total leads</p>
              <p className="text-xl font-mono text-white">{batchSummary.totalLeads}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Avg opportunity</p>
              <p className="text-xl font-mono text-emerald-200/90">
                {(batchSummary.averageOpportunityScore * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Buyer intent (comments)</p>
              <p className="text-xl font-mono text-cyan-200/90">{batchSummary.buyerIntentPresentCount}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Website missing / Low coverage</p>
              <p className="text-xl font-mono text-amber-200/90">
                {batchSummary.websiteMissingCount} · {batchSummary.lowCoverageCount}
              </p>
            </div>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/20 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Public / Access-limited</p>
              <p className="text-sm font-mono text-fuchsia-100/90">
                {batchSummary.percentPublic.toFixed(0)}% pub · {batchSummary.percentAccessLimited.toFixed(0)}% lim
              </p>
            </div>
            <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/20 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Avg coverage / confidence</p>
              <p className="text-sm font-mono text-fuchsia-100/90">
                {(batchSummary.averageCoverage * 100).toFixed(0)}% cov · {(batchSummary.averageConfidence * 100).toFixed(0)}% conf
              </p>
            </div>
            <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/20 px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Evidence / repeat Q / overrides</p>
              <p className="text-sm font-mono text-fuchsia-100/90">
                {batchSummary.percentWithEvidence.toFixed(0)}% ev · {batchSummary.percentWithRepeatedAcrossPosts.toFixed(0)}% rep ·{" "}
                {batchSummary.percentWithOverrides.toFixed(0)}% ovr
              </p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-teal-400/90 mb-2">Feedback quality</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Feedback coverage</p>
                <p className="text-sm font-mono text-teal-100/90">{batchSummary.percentFeedbackPresent.toFixed(0)}%</p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Override rate</p>
                <p className="text-sm font-mono text-teal-100/90">{batchSummary.percentWithOverrides.toFixed(0)}%</p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Most incorrect finding</p>
                <p className="text-sm font-mono text-teal-100/90">{batchSummary.mostCommonIncorrectFindingType ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Most overridden field</p>
                <p className="text-sm font-mono text-teal-100/90">{batchSummary.mostOverriddenField ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Avg confidence (incorrect feedback)</p>
                <p className="text-sm font-mono text-teal-100/90">
                  {batchSummary.avgConfidenceForIncorrectFindings != null
                    ? `${(batchSummary.avgConfidenceForIncorrectFindings * 100).toFixed(0)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-950/25 px-3 py-2">
                <p className="text-[10px] uppercase text-slate-500">Partial / wrong mix (lead · read · ws · offer)</p>
                <p className="text-[10px] font-mono text-teal-100/80 leading-snug">
                  p {batchSummary.percentPartiallyCorrectLeadType.toFixed(0)}% ·{" "}
                  {batchSummary.percentPartiallyCorrectCommercialReadiness.toFixed(0)}% ·{" "}
                  {batchSummary.percentPartiallyCorrectWeakSpots.toFixed(0)}% ·{" "}
                  {batchSummary.percentPartiallyCorrectBestOfferAngle.toFixed(0)}% · wrong{" "}
                  {batchSummary.percentLeadTypeIncorrect.toFixed(0)}% / {batchSummary.percentCommercialReadinessIncorrect.toFixed(0)}% /{" "}
                  {batchSummary.percentWeakSpotsIncorrect.toFixed(0)}% / {batchSummary.percentBestOfferAngleIncorrect.toFixed(0)}%
                </p>
              </div>
            </div>
            {Object.keys(batchSummary.byPipelineVersion).length > 1 && (
              <p className="text-[10px] text-slate-500 mt-2 font-mono">
                By pipeline (mixed batch):{" "}
                {Object.entries(batchSummary.byPipelineVersion)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          {summaryDrilldownLabel && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-lime-500/35 bg-lime-950/20 px-3 py-2 text-[11px] text-lime-100/90">
              <span className="text-[10px] uppercase tracking-wide text-lime-400/80">Active drilldown</span>
              <span className="font-mono text-lime-100">{summaryDrilldownLabel}</span>
              {segmentDrilldown ? (
                <span className="text-slate-500">
                  · segment {segmentDrilldown.dimension}={segmentDrilldown.value}
                </span>
              ) : null}
              <button
                type="button"
                className="ml-auto text-[10px] uppercase tracking-wide text-lime-300 hover:text-white"
                onClick={() => {
                  setSummaryDrilldownLabel(null);
                  setSegmentDrilldown(null);
                }}
              >
                Clear drilldown
              </button>
            </div>
          )}
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
            <button
              type="button"
              onClick={() => applySummaryDrilldown(drilldownPatchForHandoffBucket("ready"), "Handoff · ready")}
              className="rounded-lg border border-emerald-500/35 bg-emerald-950/25 px-3 py-2 text-left hover:border-emerald-400/50"
            >
              <p className="text-[10px] uppercase text-slate-500">Handoff ready</p>
              <p className="text-xl font-mono text-emerald-200">{handoffCounts.ready}</p>
            </button>
            <button
              type="button"
              onClick={() => applySummaryDrilldown(drilldownPatchForHandoffBucket("review_needed"), "Handoff · review needed")}
              className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-3 py-2 text-left hover:border-amber-400/50"
            >
              <p className="text-[10px] uppercase text-slate-500">Review needed</p>
              <p className="text-xl font-mono text-amber-200">{handoffCounts.review}</p>
            </button>
            <button
              type="button"
              onClick={() => applySummaryDrilldown(drilldownPatchForHandoffBucket("not_ready"), "Handoff · not ready")}
              className="rounded-lg border border-slate-500/35 bg-slate-950/40 px-3 py-2 text-left hover:border-slate-400/50"
            >
              <p className="text-[10px] uppercase text-slate-500">Not ready</p>
              <p className="text-xl font-mono text-slate-300">{handoffCounts.notReady}</p>
            </button>
          </div>
          <DriftWatchSection flags={batchSummary.driftFlagsJson} onDrill={applySummaryDrilldown} />
          <ConfidenceCalibrationSection cal={batchSummary.confidenceCalibrationJson} onDrill={applySummaryDrilldown} />
          <SegmentAlertsSection alertsJson={batchSummary.segmentAlertsJson} onDrill={applySummaryDrilldown} />
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Quality by segment</p>
            <QualityBreakdownBlock
              title="Vertical"
              data={batchSummary.qualityByVertical}
              dimension="vertical"
              onDrill={applySummaryDrilldown}
            />
            <QualityBreakdownBlock
              title="Lead type (effective)"
              data={batchSummary.qualityByLeadType}
              dimension="lead_type"
              onDrill={applySummaryDrilldown}
            />
            <QualityBreakdownBlock
              title="Platform"
              data={batchSummary.qualityByPlatform}
              dimension="platform"
              onDrill={applySummaryDrilldown}
            />
            <QualityBreakdownBlock
              title="Commercial readiness"
              data={batchSummary.qualityByCommercialReadiness}
              dimension="readiness"
              onDrill={applySummaryDrilldown}
            />
          </div>
          {runs.length > 1 && batchSummary && (
            <div className="mt-4 rounded-xl border border-slate-500/30 bg-slate-950/50 px-3 py-3">
              <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                Compare run quality (baseline)
              </label>
              <select
                className="w-full max-w-md rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
                value={compareQualityRunId ?? ""}
                onChange={(e) => setCompareQualityRunId(e.target.value || null)}
              >
                <option value="">— Select another run as baseline —</option>
                {runs
                  .filter((x) => x.id !== selectedRunId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {(r.pipelineVersion ?? r.modelVersion ?? "run").toString()} · {r.id.slice(0, 8)}…
                    </option>
                  ))}
              </select>
              {compareQualityRunId && !baselineSummaryForQuality && (
                <p className="text-xs text-slate-500 mt-2">Loading baseline summary…</p>
              )}
              {compareQualityRunId && baselineSummaryForQuality && (
                <RunQualityDeltaStrip current={batchSummary} baseline={baselineSummaryForQuality} />
              )}
            </div>
          )}
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-[11px] text-slate-400">
            <div>
              <p className="text-slate-500 mb-1">By platform</p>
              <ul className="font-mono space-y-0.5">
                {Object.entries(batchSummary.byPlatform)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k}: <span className="text-slate-200">{v}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="text-slate-500 mb-1">By vertical</p>
              <ul className="font-mono space-y-0.5">
                {Object.entries(batchSummary.byVertical)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k}: <span className="text-slate-200">{v}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="text-slate-500 mb-1">By lead type (effective)</p>
              <ul className="font-mono space-y-0.5">
                {Object.entries(batchSummary.byLeadType)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <li key={k}>
                      {k}: <span className="text-slate-200">{v}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="text-slate-500 mb-1">By readiness</p>
              <ul className="font-mono space-y-0.5">
                {Object.entries(batchSummary.byCommercialReadiness).map(([k, v]) => (
                  <li key={k}>
                    {k}: <span className="text-slate-200">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Operator status</p>
              <ul className="font-mono space-y-0.5">
                {Object.entries(batchSummary.byOperatorStatus).map(([k, v]) => (
                  <li key={k}>
                    {k}: <span className="text-slate-200">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="text-slate-500 mb-1">By suggested next move (truncated keys)</p>
              <ul className="font-mono space-y-0.5 text-[10px]">
                {Object.entries(batchSummary.bySuggestedNextMove)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k} className="truncate" title={k}>
                      {k}: <span className="text-slate-200">{v}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {selectedRunId && rows.length > 0 ? (
        <ContentIntelligenceSection
          insights={contentInsights}
          engineSummary={engineBatchSummary}
          filteredCount={filtered.length}
          totalRunCount={rows.length}
          extraActions={
            <>
              <button
                type="button"
                disabled={!canBuildHandoff || handoffSendState === "loading"}
                onClick={() => openHandoffPreview()}
                className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-slate-200 hover:border-violet-400/50 disabled:opacity-40"
              >
                Preview handoff
              </button>
              <button
                type="button"
                disabled={!canBuildHandoff || handoffSendState === "loading"}
                onClick={() => void sendHandoffToAiRevenueOs()}
                className="rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-100 hover:border-emerald-400/60 disabled:opacity-40"
              >
                {handoffSendState === "loading" ? "Sending…" : "Send to AI Revenue OS"}
              </button>
              <button
                type="button"
                disabled={!canBuildHandoff}
                onClick={() => saveHandoffDraftLocal()}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-white/30 disabled:opacity-40"
              >
                Save draft (local)
              </button>
              <button
                type="button"
                onClick={() => void viewLastHandoffFromServer()}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-white/30"
              >
                View last handoff
              </button>
            </>
          }
          handoffFooter={
            <>
              {handoffActionErr ? <span className="text-rose-400/90 block">{handoffActionErr}</span> : null}
              {lastHandoffIdLocal ? (
                <span className="text-slate-500 block">
                  Last handoff id: <span className="font-mono text-violet-300/90">{lastHandoffIdLocal}</span>
                </span>
              ) : null}
              {handoffSendState === "ok" ? (
                <span className="text-emerald-400/90 block">
                  Stored on server and attached to this browser&apos;s Revenue OS workflow session.
                </span>
              ) : null}
            </>
          }
        />
      ) : null}

      <div className={card}>
        <h2 className="text-lg font-semibold text-cyan-300 mb-3">Results ({filtered.length})</h2>
        {!selectedRunId ? (
          <p className="text-sm text-slate-500">Run analysis to see results.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="pb-2 pr-3">Business</th>
                  <th className="pb-2 pr-3">Vertical</th>
                  <th className="pb-2 pr-3">Lead type</th>
                  <th className="pb-2 pr-3">Handoff</th>
                  <th className="pb-2 pr-3">Ready</th>
                  <th className="pb-2 pr-3">Cov</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Platform</th>
                  <th className="pb-2 pr-3">Access</th>
                  <th className="pb-2 pr-3">Type / stage</th>
                  <th className="pb-2 pr-3">Opp</th>
                  <th className="pb-2 pr-3" title="Lead Intelligence Engine · 0–100 intent">
                    Eng·int
                  </th>
                  <th className="pb-2 pr-3">Pain</th>
                  <th className="pb-2 pr-3" title="Engine commercial stage">
                    Eng stg
                  </th>
                  <th className="pb-2 pr-3 max-w-[200px]">Drivers</th>
                  <th className="pb-2 pr-3">Email</th>
                  <th className="pb-2 pr-3">Site</th>
                  <th className="pb-2 pr-3">Next move</th>
                  <th className="pb-2"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.leadRecordId} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 pr-3 text-white">{r.businessName}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400 font-mono">{r.inferredVertical}</td>
                    <td
                      className="py-2 pr-3 text-[10px] font-mono text-slate-400 max-w-[100px] truncate"
                      title={
                        r.effectiveLeadType !== r.inferredLeadType
                          ? `Inferred: ${r.inferredLeadType} · Effective: ${r.effectiveLeadType}`
                          : r.effectiveLeadType
                      }
                    >
                      {r.effectiveLeadType}
                    </td>
                    <td className="py-2 pr-3">
                      <HandoffBadge row={r} />
                    </td>
                    <td className="py-2 pr-3">
                      <ReadinessChip
                        readiness={r.effectiveCommercialReadiness}
                        title={
                          r.effectiveCommercialReadiness !== r.commercialReadiness
                            ? `Inferred: ${r.commercialReadiness}`
                            : undefined
                        }
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono">{r.overallCoverageScore.toFixed(2)}</td>
                    <td className="py-2 pr-3">
                      <OperatorStatusChip status={r.operatorStatus} />
                    </td>
                    <td className="py-2 pr-3">{r.platform}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.accessStatus}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400">
                      {r.businessType} · {r.maturityStage}
                    </td>
                    <td className="py-2 pr-3">{r.opportunityScore.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-xs font-mono text-violet-200/90">
                      {r.engineIntentScore0To100 != null ? r.engineIntentScore0To100 : "—"}
                    </td>
                    <td
                      className="py-2 pr-3 text-[10px] font-mono text-slate-400 max-w-[100px] truncate"
                      title={r.enginePainType ?? ""}
                    >
                      {r.enginePainType ?? "—"}
                    </td>
                    <td
                      className="py-2 pr-3 text-[10px] font-mono text-slate-400 max-w-[100px] truncate"
                      title={r.engineCommercialStage ?? ""}
                    >
                      {r.engineCommercialStage ?? "—"}
                    </td>
                    <td
                      className="py-2 pr-3 max-w-[200px] truncate text-[10px] text-slate-500"
                      title={formatDriversCompact(r)}
                    >
                      {formatDriversCompact(r)}
                    </td>
                    <td className="py-2 pr-3">{r.email ? "yes" : "—"}</td>
                    <td className="py-2 pr-3">{r.websiteUrl ? "yes" : "no"}</td>
                    <td
                      className="py-2 pr-3 max-w-[220px] truncate text-slate-400"
                      title={r.actionRationale?.trim() ? r.actionRationale : (r.suggestedNextMove ?? "")}
                    >
                      {r.suggestedNextMove}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-cyan-400 hover:underline"
                        onClick={() => void openDetail(r.leadRecordId, r.analysisId)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailOpen && detail?.analysis && detailAnalysisId && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-4">
              <h3 className="text-xl font-semibold text-white">Lead detail</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-white"
                onClick={() => setDetailOpen(false)}
              >
                Close
              </button>
            </div>
            {runs.filter((x) => x.id !== selectedRunId).length > 0 && (
              <label className="block text-xs text-slate-500 mb-3">
                Compare to another run (same upload)
                <select
                  className="mt-1 block w-full max-w-md rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm text-white"
                  value={detailCompareRunId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setDetailCompareRunId(v);
                    const rid = detail?.record?.id;
                    if (typeof rid === "string") void loadLeadDetail(rid, v);
                  }}
                >
                  <option value="">— No comparison —</option>
                  {runs
                    .filter((x) => x.id !== selectedRunId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {(r.pipelineVersion ?? r.modelVersion ?? "prior").toString()} · {r.id.slice(0, 8)}…
                      </option>
                    ))}
                </select>
              </label>
            )}
            <DetailBody
              analysis={detail.analysis}
              comparisonAnalysis={detail.comparisonAnalysis ?? null}
              comparisonDeltas={detail.comparisonDeltas ?? null}
              analysisId={detailAnalysisId}
              handoffReadiness={detailLeadRow?.handoffReadiness ?? null}
              handoffReadinessReasons={detailLeadRow?.handoffReadinessReasons ?? null}
              onSaved={async () => {
                await loadAnalyses();
                const rid = detail.record?.id;
                if (typeof rid === "string") await loadLeadDetail(rid, detailCompareRunId);
              }}
            />
          </div>
        </div>
      )}

      {handoffPreviewOpen && previewPayload ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-violet-500/40 bg-slate-950 p-6 shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-4">
              <h3 className="text-lg font-semibold text-violet-200">Bentley → Content Bundle handoff</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-white text-sm"
                onClick={() => setHandoffPreviewOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Upstream market intelligence from Bentley SLI — not generated campaign output. Use{" "}
              <span className="text-slate-400">Raw JSON</span> for audit exports.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setHandoffPreviewTab("readable")}
                className={`rounded-lg px-3 py-1 text-xs ${
                  handoffPreviewTab === "readable"
                    ? "bg-violet-600 text-white"
                    : "border border-white/15 text-slate-400"
                }`}
              >
                Readable notes
              </button>
              <button
                type="button"
                onClick={() => setHandoffPreviewTab("json")}
                className={`rounded-lg px-3 py-1 text-xs ${
                  handoffPreviewTab === "json"
                    ? "bg-violet-600 text-white"
                    : "border border-white/15 text-slate-400"
                }`}
              >
                Raw JSON
              </button>
            </div>
            {handoffPreviewTab === "readable" ? (
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed border border-white/10 rounded-lg p-4 bg-black/30">
                {buildBentleyContentBundleReadableNotes(previewPayload).compactMarkdown}
              </pre>
            ) : (
              <pre className="text-[10px] text-slate-400 overflow-x-auto font-mono border border-white/10 rounded-lg p-4 bg-black/30 max-h-[50vh]">
                {serializeContentBundleHandoff(previewPayload)}
              </pre>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OperatorStatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "border-slate-500/50 text-slate-300 bg-slate-900/60",
    reviewing: "border-amber-500/40 text-amber-200 bg-amber-950/40",
    shortlisted: "border-emerald-500/40 text-emerald-200 bg-emerald-950/35",
    contacted_manually: "border-cyan-500/40 text-cyan-200 bg-cyan-950/35",
    not_a_fit: "border-rose-500/35 text-rose-200 bg-rose-950/30",
    revisit_later: "border-violet-500/35 text-violet-200 bg-violet-950/30",
  };
  const cls = styles[status] ?? "border-white/15 text-slate-400 bg-black/40";
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}>{status}</span>
  );
}

function HandoffBadge({ row }: { row: LeadAnalysisRow }) {
  const cls =
    row.handoffReadiness === "ready"
      ? "border-emerald-500/40 text-emerald-200"
      : row.handoffReadiness === "review_needed"
        ? "border-amber-500/40 text-amber-200"
        : "border-slate-500/40 text-slate-400";
  const title = [row.handoffReadiness, ...(row.handoffReadinessReasons ?? [])].join(" · ");
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-mono max-w-[100px] truncate ${cls}`}
      title={title}
    >
      {row.handoffReadiness}
    </span>
  );
}

function ReadinessChip({ readiness, title }: { readiness: string; title?: string }) {
  const cls =
    readiness === "high"
      ? "border-emerald-500/40 text-emerald-200"
      : readiness === "low"
        ? "border-rose-500/35 text-rose-200"
        : "border-slate-500/40 text-slate-300";
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}
      title={title}
    >
      {readiness}
    </span>
  );
}

function RunQualityDeltaStrip({
  current,
  baseline,
}: {
  current: RunBatchSummary;
  baseline: RunBatchSummary;
}) {
  const d = computeRunQualityDelta(current, baseline);
  const fmt01 = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}`;
  const fmtPts = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  return (
    <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-slate-300 space-y-1">
      <p className="text-slate-500 text-[10px] uppercase tracking-wide">Δ vs baseline (this run − baseline)</p>
      <p className="font-mono leading-relaxed">
        Avg coverage {fmt01(d.deltaAverageCoverage)} · Avg confidence {fmt01(d.deltaAverageConfidence)} · % public{" "}
        {fmtPts(d.deltaPercentPublic)} · % w/ evidence {fmtPts(d.deltaPercentWithEvidence)} · % repeat Q{" "}
        {fmtPts(d.deltaPercentWithRepeatedAcrossPosts)} · % w/ overrides {fmtPts(d.deltaPercentWithOverrides)}
      </p>
      <p className="font-mono leading-relaxed text-[10px] text-slate-400">
        Δ feedback coverage {fmtPts(d.deltaPercentFeedbackPresent)} · Δ wrong lead {fmtPts(d.deltaPercentLeadTypeIncorrect)} · Δ wrong readiness{" "}
        {fmtPts(d.deltaPercentCommercialReadinessIncorrect)} · Δ wrong weak spots {fmtPts(d.deltaPercentWeakSpotsIncorrect)} · Δ wrong offer{" "}
        {fmtPts(d.deltaPercentBestOfferAngleIncorrect)}
      </p>
      {d.deltaAvgConfidenceIncorrect != null && (
        <p className="font-mono text-[10px] text-slate-400">
          Δ avg confidence (rows w/ any incorrect feedback) {fmt01(d.deltaAvgConfidenceIncorrect)}
        </p>
      )}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="ml-2 text-[10px] uppercase tracking-wide text-cyan-400 hover:text-cyan-300"
      onClick={() => void navigator.clipboard.writeText(text)}
    >
      Copy
    </button>
  );
}

function analysisNum(a: Record<string, unknown>, k: string): number {
  const v = a[k];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function FindingConfChip({ v, label }: { v: number | undefined; label: string }) {
  if (v === undefined || Number.isNaN(v)) {
    return (
      <span className="ml-2 text-[10px] text-slate-600" title={`${label} confidence not persisted — re-run analysis`}>
        —
      </span>
    );
  }
  const pct = Math.round(Math.min(1, Math.max(0, v)) * 100);
  return (
    <span
      className="ml-2 inline-block rounded border border-slate-500/45 px-1.5 py-0.5 text-[10px] font-mono text-slate-400"
      title={`Heuristic finding confidence for ${label}`}
    >
      {pct}% conf
    </span>
  );
}

function EvidenceBullets({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-400 space-y-1 border-t border-white/10 pt-2">
      <li className="list-none text-[10px] uppercase tracking-wide text-slate-500 -ml-4 mb-1">Supporting evidence</li>
      {lines.slice(0, 10).map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

function EngineSignalsDetailBlock({ analysis }: { analysis: Record<string, unknown> }) {
  const raw = analysis.rawAnalysisJson;
  if (!raw || typeof raw !== "object") return null;
  const es = (raw as { engineSignals?: EngineSignals }).engineSignals;
  if (!es) return null;
  const ic = es.intentClassification;
  const breakdown = es.intentScore?.breakdown ?? [];
  return (
    <div className="rounded-xl border border-violet-500/35 bg-violet-950/25 px-3 py-3 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-violet-300/90 mb-1">Lead Intelligence Engine</p>
        <p className="text-xs text-slate-400">
          Intent <span className="font-mono text-violet-200">{es.intentScore?.score0To100 ?? "—"}</span>/100 · Pain{" "}
          <span className="font-mono text-slate-200">{es.painType}</span> · Urgency{" "}
          <span className="font-mono text-slate-200">{es.urgency}</span> · Stage{" "}
          <span className="font-mono text-slate-200">{es.commercialReadinessStage}</span>
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Engine handoff hint: <span className="font-mono text-slate-400">{es.handoffReadiness}</span> (pipeline handoff may
          differ)
        </p>
      </div>
      {(es.recommendedContentHook || es.recommendedCtaAngle) && (
        <div className="text-[12px] text-slate-300 space-y-1 border-t border-white/10 pt-2">
          {es.recommendedContentHook ? (
            <p>
              <span className="text-slate-500">Hook:</span> {es.recommendedContentHook}
            </p>
          ) : null}
          {es.recommendedCtaAngle ? (
            <p>
              <span className="text-slate-500">CTA angle:</span> {es.recommendedCtaAngle}
            </p>
          ) : null}
        </div>
      )}
      {ic && (
        <div className="text-[11px] text-slate-500 border-t border-white/10 pt-2">
          <span className="text-slate-600">Signals:</span> help {String(ic.hasExplicitHelpRequest)} · pain{" "}
          {String(ic.hasFirstPersonPain)} · reco {String(ic.hasRecommendationAsk)} · frustration{" "}
          {String(ic.hasFrustrationMarkers)} · urgency {String(ic.hasUrgencyMarkers)} · money{" "}
          {String(ic.hasMoneyOrRevenueRef)} · owner {String(ic.hasOwnerSelfId)}
        </div>
      )}
      {breakdown.length > 0 && (
        <div className="border-t border-white/10 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Score breakdown</p>
          <ul className="text-[11px] font-mono text-slate-400 space-y-0.5">
            {breakdown.slice(0, 12).map((line, i) => (
              <li key={i}>
                {line.label}: <span className="text-violet-200/90">+{line.contribution.toFixed(1)}</span>
                <span className="text-slate-600"> ({line.points}×{line.weight})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {es.evidenceSnippets && es.evidenceSnippets.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-slate-400 space-y-1 border-t border-white/10 pt-2">
          <li className="list-none text-[10px] uppercase tracking-wide text-slate-500 -ml-4 mb-1">
            Engine evidence snippets
          </li>
          {es.evidenceSnippets.slice(0, 8).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailBody({
  analysis,
  comparisonAnalysis,
  comparisonDeltas,
  analysisId,
  handoffReadiness,
  handoffReadinessReasons,
  onSaved,
}: {
  analysis: Record<string, unknown>;
  comparisonAnalysis: Record<string, unknown> | null;
  comparisonDeltas: Record<string, unknown> | null;
  analysisId: string;
  handoffReadiness: string | null;
  handoffReadinessReasons: string[] | null;
  onSaved: () => void;
}) {
  const str = (k: string) => (typeof analysis[k] === "string" ? (analysis[k] as string) : "");
  const arrLines = (k: string) =>
    Array.isArray(analysis[k]) ? "• " + (analysis[k] as string[]).join("\n• ") : "—";

  const fc = parseStoredFindingConfidenceJson(analysis.findingConfidenceJson);
  const ev = parseStoredEvidenceJson(analysis.evidenceJson);
  const tdParsed = parseStoredTopLeadDriversJson(analysis.topLeadDriversJson);
  const rankDiag = parseStoredRankingDiagnosticsJson(analysis.rankingDiagnosticsJson);

  const [opStatus, setOpStatus] = useState(String(analysis.operatorStatus ?? "new"));
  const [opPriority, setOpPriority] = useState(String(analysis.operatorPriority ?? "normal"));
  const [opNotes, setOpNotes] = useState(String(analysis.operatorNotes ?? ""));
  const [ovLeadType, setOvLeadType] = useState(String(analysis.operatorOverrideLeadType ?? ""));
  const [ovReadiness, setOvReadiness] = useState(String(analysis.operatorOverrideCommercialReadiness ?? ""));
  const [ovOffer, setOvOffer] = useState(String(analysis.operatorOverrideBestOfferAngle ?? ""));
  const [ovWeakJson, setOvWeakJson] = useState(
    Array.isArray(analysis.operatorOverrideWeakSpotsJson)
      ? JSON.stringify(analysis.operatorOverrideWeakSpotsJson)
      : ""
  );
  const [ovReasonLead, setOvReasonLead] = useState(String(analysis.operatorOverrideLeadTypeReason ?? ""));
  const [ovReasonReadiness, setOvReasonReadiness] = useState(
    String(analysis.operatorOverrideCommercialReadinessReason ?? "")
  );
  const [ovReasonOffer, setOvReasonOffer] = useState(String(analysis.operatorOverrideBestOfferAngleReason ?? ""));
  const [ovReasonWeak, setOvReasonWeak] = useState(String(analysis.operatorOverrideWeakSpotsReason ?? ""));
  const [fbLeadType, setFbLeadType] = useState(String(analysis.operatorFeedbackLeadType ?? ""));
  const [fbReadiness, setFbReadiness] = useState(String(analysis.operatorFeedbackCommercialReadiness ?? ""));
  const [fbWeak, setFbWeak] = useState(String(analysis.operatorFeedbackWeakSpots ?? ""));
  const [fbOffer, setFbOffer] = useState(String(analysis.operatorFeedbackBestOfferAngle ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = String(analysis.operatorStatus ?? "new");
    const legacy: Record<string, string> = {
      in_progress: "reviewing",
      done: "shortlisted",
      snoozed: "revisit_later",
      discarded: "not_a_fit",
    };
    setOpStatus(legacy[raw] ?? raw);
    setOpPriority(String(analysis.operatorPriority ?? "normal"));
    setOpNotes(String(analysis.operatorNotes ?? ""));
    setOvLeadType(String(analysis.operatorOverrideLeadType ?? ""));
    setOvReadiness(String(analysis.operatorOverrideCommercialReadiness ?? ""));
    setOvOffer(String(analysis.operatorOverrideBestOfferAngle ?? ""));
    setOvWeakJson(
      Array.isArray(analysis.operatorOverrideWeakSpotsJson)
        ? JSON.stringify(analysis.operatorOverrideWeakSpotsJson)
        : ""
    );
    setOvReasonLead(String(analysis.operatorOverrideLeadTypeReason ?? ""));
    setOvReasonReadiness(String(analysis.operatorOverrideCommercialReadinessReason ?? ""));
    setOvReasonOffer(String(analysis.operatorOverrideBestOfferAngleReason ?? ""));
    setOvReasonWeak(String(analysis.operatorOverrideWeakSpotsReason ?? ""));
    setFbLeadType(String(analysis.operatorFeedbackLeadType ?? ""));
    setFbReadiness(String(analysis.operatorFeedbackCommercialReadiness ?? ""));
    setFbWeak(String(analysis.operatorFeedbackWeakSpots ?? ""));
    setFbOffer(String(analysis.operatorFeedbackBestOfferAngle ?? ""));
  }, [analysisId, analysis]);

  async function saveFeedback() {
    setSaving(true);
    try {
      await fetch(`/api/bentley-social-leads/analyses/${encodeURIComponent(analysisId)}/operator`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorFeedbackLeadType: fbLeadType.trim() ? fbLeadType.trim() : null,
          operatorFeedbackCommercialReadiness: fbReadiness.trim() ? fbReadiness.trim() : null,
          operatorFeedbackWeakSpots: fbWeak.trim() ? fbWeak.trim() : null,
          operatorFeedbackBestOfferAngle: fbOffer.trim() ? fbOffer.trim() : null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function saveOperator() {
    setSaving(true);
    try {
      const wtrim = ovWeakJson.trim();
      let operatorOverrideWeakSpotsJson: string[] | null;
      if (!wtrim) {
        operatorOverrideWeakSpotsJson = null;
      } else {
        try {
          const p = JSON.parse(wtrim) as unknown;
          operatorOverrideWeakSpotsJson = Array.isArray(p)
            ? p.filter((x): x is string => typeof x === "string")
            : null;
        } catch {
          window.alert("Weak spots override must be valid JSON (e.g. [\"weak_cta\",\"no_lead_capture\"]).");
          setSaving(false);
          return;
        }
      }

      await fetch(`/api/bentley-social-leads/analyses/${encodeURIComponent(analysisId)}/operator`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorStatus: opStatus,
          operatorPriority: opPriority,
          operatorNotes: opNotes.trim() ? opNotes : null,
          operatorOverrideLeadType: ovLeadType.trim() ? ovLeadType.trim() : null,
          operatorOverrideCommercialReadiness: ovReadiness.trim() ? ovReadiness.trim() : null,
          operatorOverrideBestOfferAngle: ovOffer.trim() ? ovOffer.trim() : null,
          operatorOverrideWeakSpotsJson,
          operatorOverrideLeadTypeReason: ovReasonLead.trim() ? ovReasonLead.trim() : null,
          operatorOverrideCommercialReadinessReason: ovReasonReadiness.trim() ? ovReasonReadiness.trim() : null,
          operatorOverrideBestOfferAngleReason: ovReasonOffer.trim() ? ovReasonOffer.trim() : null,
          operatorOverrideWeakSpotsReason: ovReasonWeak.trim() ? ovReasonWeak.trim() : null,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function markReviewed() {
    setSaving(true);
    try {
      await fetch(`/api/bentley-social-leads/analyses/${encodeURIComponent(analysisId)}/operator`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuallyReviewed: true }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const se = analysis.scoreExplanationJson as Record<string, unknown> | undefined;
  const posDrivers = Array.isArray(se?.top_positive_drivers) ? (se?.top_positive_drivers as string[]) : [];
  const negDrivers = Array.isArray(se?.top_negative_drivers) ? (se?.top_negative_drivers as string[]) : [];
  const confRationale = typeof se?.confidence_rationale === "string" ? se.confidence_rationale : "";

  const wg = analysis.websiteGradeJson as Record<string, unknown> | undefined;
  const gradeLetter = wg?.websiteGrade != null ? String(wg.websiteGrade) : "—";
  const gradeExpl = typeof wg?.websiteGradeExplanation === "string" ? wg.websiteGradeExplanation : "";

  return (
    <div className="space-y-4 text-sm text-slate-200">
      {handoffReadiness && handoffReadinessReasons && handoffReadinessReasons.length > 0 && (
        <div className="rounded-xl border border-lime-500/30 bg-lime-950/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-lime-300/90 mb-1">Handoff completeness</p>
          <p className="text-xs font-mono text-lime-100/90 mb-2">{handoffReadiness}</p>
          <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
            {handoffReadinessReasons.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <EngineSignalsDetailBlock analysis={analysis} />
      <p className="text-slate-300">{String(analysis.summary ?? "")}</p>
      {tdParsed && (tdParsed.topPositive.length > 0 || tdParsed.limitingFactors.length > 0) && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-300/90 mb-1">Lead scan drivers</p>
          {tdParsed.topPositive.length > 0 && (
            <p className="text-xs text-slate-200">
              <span className="text-slate-500">+ </span>
              {tdParsed.topPositive.join(" · ")}
            </p>
          )}
          {tdParsed.limitingFactors.length > 0 && (
            <p className="text-xs text-rose-200/90 mt-1">
              <span className="text-slate-500">− </span>
              {tdParsed.limitingFactors.join(" · ")}
            </p>
          )}
        </div>
      )}
      {rankDiag && (
        <div className="rounded-xl border border-cyan-500/35 bg-slate-900/60 px-3 py-3">
          <p className="text-xs font-semibold text-cyan-200/90 mb-2">Why this ranked here?</p>
          {rankDiag.topPositiveDrivers.length > 0 && (
            <p className="text-[11px] text-slate-300 mb-2">
              <span className="text-slate-500">Drivers · </span>
              {rankDiag.topPositiveDrivers.join(" · ")}
            </p>
          )}
          {rankDiag.topLimitingFactors.length > 0 && (
            <p className="text-[11px] text-slate-400 mb-2">
              <span className="text-slate-500">Limits · </span>
              {rankDiag.topLimitingFactors.join(" · ")}
            </p>
          )}
          {rankDiag.coveragePenalties.length > 0 && (
            <p className="text-[10px] text-amber-200/85 mb-1">
              <span className="text-slate-500">Coverage · </span>
              {rankDiag.coveragePenalties.join(" ")}
            </p>
          )}
          {rankDiag.confidencePenalties.length > 0 && (
            <p className="text-[10px] text-rose-200/80 mb-1">
              <span className="text-slate-500">Confidence · </span>
              {rankDiag.confidencePenalties.join(" ")}
            </p>
          )}
          {rankDiag.actionBiasFactors.length > 0 && (
            <p className="text-[10px] text-sky-200/85">
              <span className="text-slate-500">Action bias · </span>
              {rankDiag.actionBiasFactors.join(" ")}
            </p>
          )}
        </div>
      )}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-amber-200/80 mb-2">Analyst feedback (calibration)</p>
        <p className="text-[10px] text-slate-500 mb-2">
          Rate each finding vs ground truth — stored separately from overrides.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block text-[10px] text-slate-500">
            Lead type
            <select
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white"
              value={fbLeadType}
              onChange={(e) => setFbLeadType(e.target.value)}
            >
              <option value="">—</option>
              <option value="correct">correct</option>
              <option value="partially_correct">partial</option>
              <option value="incorrect">incorrect</option>
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">
            Commercial readiness
            <select
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white"
              value={fbReadiness}
              onChange={(e) => setFbReadiness(e.target.value)}
            >
              <option value="">—</option>
              <option value="correct">correct</option>
              <option value="partially_correct">partial</option>
              <option value="incorrect">incorrect</option>
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">
            Weak spots
            <select
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white"
              value={fbWeak}
              onChange={(e) => setFbWeak(e.target.value)}
            >
              <option value="">—</option>
              <option value="correct">correct</option>
              <option value="partially_correct">partial</option>
              <option value="incorrect">incorrect</option>
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">
            Best offer angle
            <select
              className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[11px] text-white"
              value={fbOffer}
              onChange={(e) => setFbOffer(e.target.value)}
            >
              <option value="">—</option>
              <option value="correct">correct</option>
              <option value="partially_correct">partial</option>
              <option value="incorrect">incorrect</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveFeedback()}
          className="mt-2 rounded-lg border border-amber-500/40 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save feedback"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Inferred vertical:{" "}
        <span className="font-mono text-cyan-200/90">{String(analysis.inferredVertical ?? "—")}</span>
      </p>
      <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1">
        <span>
          Lead type (inferred):{" "}
          <span className="font-mono text-slate-200">{String(analysis.leadType ?? "—")}</span>
        </span>
        <FindingConfChip v={fc?.inferredLeadType} label="lead type" />
        {analysis.operatorOverrideLeadType ? (
          <span className="text-amber-100/90 font-mono">
            · override {String(analysis.operatorOverrideLeadType)}
          </span>
        ) : null}
      </p>
      {analysis.operatorOverrideLeadTypeReason ? (
        <p className="text-[11px] text-slate-500 pl-2 border-l border-amber-500/30">
          Override reason: {String(analysis.operatorOverrideLeadTypeReason)}
        </p>
      ) : null}
      <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-1">
        <span>
          Readiness (inferred):{" "}
          <span className="font-mono text-slate-200">{String(analysis.commercialReadiness ?? "—")}</span>
        </span>
        <FindingConfChip v={fc?.inferredCommercialReadiness} label="readiness" />
        {analysis.operatorOverrideCommercialReadiness ? (
          <span className="text-amber-100/90 font-mono">
            · override {String(analysis.operatorOverrideCommercialReadiness)}
          </span>
        ) : null}
      </p>
      {analysis.operatorOverrideCommercialReadinessReason ? (
        <p className="text-[11px] text-slate-500 pl-2 border-l border-amber-500/30">
          Override reason: {String(analysis.operatorOverrideCommercialReadinessReason)}
        </p>
      ) : null}

      <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3">
        <p className="text-cyan-200/90 text-xs font-semibold uppercase tracking-wide mb-2">Suggested next move</p>
        <p className="text-slate-100 whitespace-pre-wrap">{str("suggestedNextMove")}</p>
        {typeof analysis.actionRationale === "string" && analysis.actionRationale.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 border-t border-cyan-500/20 pt-2">
            <span className="text-slate-500">Action rationale:</span> {analysis.actionRationale}
          </p>
        )}
        <EvidenceBullets lines={ev?.actionRationale ?? []} />
      </div>

      {analysis.coverageJson && typeof analysis.coverageJson === "object" && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3">
          <p className="text-sky-200/90 text-xs font-semibold uppercase tracking-wide mb-2">Coverage (extraction)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-300">
            <div>
              Overall: {analysisNum(analysis.coverageJson as Record<string, unknown>, "overallCoverageScore").toFixed(2)}
            </div>
            <div>
              Profile: {analysisNum(analysis.coverageJson as Record<string, unknown>, "profileCoverageScore").toFixed(2)}
            </div>
            <div>
              Posts: {analysisNum(analysis.coverageJson as Record<string, unknown>, "postCoverageScore").toFixed(2)}
            </div>
            <div>
              Comments:{" "}
              {analysisNum(analysis.coverageJson as Record<string, unknown>, "commentCoverageScore").toFixed(2)}
            </div>
            <div>
              Website:{" "}
              {analysisNum(analysis.coverageJson as Record<string, unknown>, "websiteCoverageScore").toFixed(2)}
            </div>
          </div>
          {Array.isArray((analysis.coverageJson as { notes?: string[] }).notes) && (
            <ul className="mt-2 text-[10px] text-slate-500 list-disc pl-4 space-y-0.5">
              {(analysis.coverageJson as { notes: string[] }).notes.slice(0, 5).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {wg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-3">
          <p className="text-emerald-200/90 text-xs font-semibold uppercase tracking-wide mb-1">Website grade</p>
          <p className="text-2xl font-bold text-white">
            {gradeLetter}{" "}
            <span className="text-sm font-normal text-slate-400">(surface-only)</span>
          </p>
          {gradeExpl && <p className="text-xs text-slate-400 mt-2">{gradeExpl}</p>}
        </div>
      )}

      {comparisonAnalysis && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3">
          <p className="text-violet-200/90 text-xs font-semibold uppercase tracking-wide mb-2">Run comparison (this run vs selected run)</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[11px] font-mono">
            <span className="text-slate-500">Metric</span>
            <span className="text-slate-500">This run</span>
            <span className="text-slate-500">Compare run</span>
            <span>Opportunity</span>
            <span>{analysisNum(analysis, "opportunityScore").toFixed(3)}</span>
            <span>{analysisNum(comparisonAnalysis, "opportunityScore").toFixed(3)}</span>
            <span>Confidence</span>
            <span>{analysisNum(analysis, "confidenceScore").toFixed(3)}</span>
            <span>{analysisNum(comparisonAnalysis, "confidenceScore").toFixed(3)}</span>
            <span>Friction</span>
            <span>{analysisNum(analysis, "frictionScore").toFixed(3)}</span>
            <span>{analysisNum(comparisonAnalysis, "frictionScore").toFixed(3)}</span>
          </div>
          {comparisonDeltas && (
            <div className="mt-3 border-t border-violet-500/20 pt-3 text-[11px] text-slate-400 space-y-1">
              <p className="text-violet-300/90 font-medium">Deltas (this − compare)</p>
              <p>
                Δ opportunity {Number(comparisonDeltas.opportunityScoreDelta).toFixed(3)} · Δ confidence{" "}
                {Number(comparisonDeltas.confidenceScoreDelta).toFixed(3)} · Δ visibility{" "}
                {Number(comparisonDeltas.visibilityScoreDelta).toFixed(3)} · Δ demand{" "}
                {Number(comparisonDeltas.demandScoreDelta).toFixed(3)} · Δ intent{" "}
                {Number(comparisonDeltas.intentScoreDelta).toFixed(3)} · Δ friction{" "}
                {Number(comparisonDeltas.frictionScoreDelta).toFixed(3)} · Δ fit{" "}
                {Number(comparisonDeltas.fitScoreDelta).toFixed(3)} · Δ website grade (ordinal){" "}
                {Number(comparisonDeltas.websiteGradeDelta)}
              </p>
              {Boolean(comparisonDeltas.changedBestOfferAngle) && (
                <p className="text-amber-200/80">Best offer angle changed vs compare run.</p>
              )}
              {Array.isArray(comparisonDeltas.newlyDetectedWeakSpots) &&
                (comparisonDeltas.newlyDetectedWeakSpots as string[]).length > 0 && (
                  <p>
                    New weak spots:{" "}
                    <span className="font-mono text-rose-200/90">
                      {(comparisonDeltas.newlyDetectedWeakSpots as string[]).join(", ")}
                    </span>
                  </p>
                )}
              {Array.isArray(comparisonDeltas.resolvedWeakSpots) &&
                (comparisonDeltas.resolvedWeakSpots as string[]).length > 0 && (
                  <p>
                    Resolved weak spots:{" "}
                    <span className="font-mono text-emerald-200/90">
                      {(comparisonDeltas.resolvedWeakSpots as string[]).join(", ")}
                    </span>
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Operator workflow</p>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <label className="block text-slate-500">
            Status
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={opStatus}
              onChange={(e) => setOpStatus(e.target.value)}
            >
              <option value="new">new</option>
              <option value="reviewing">reviewing</option>
              <option value="shortlisted">shortlisted</option>
              <option value="contacted_manually">contacted_manually</option>
              <option value="not_a_fit">not_a_fit</option>
              <option value="revisit_later">revisit_later</option>
            </select>
          </label>
          <label className="block text-slate-500">
            Priority
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={opPriority}
              onChange={(e) => setOpPriority(e.target.value)}
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
          </label>
        </div>
        <label className="block text-slate-500 text-xs mt-2">
          Notes
          <textarea
            className="mt-1 w-full min-h-[72px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-sm"
            value={opNotes}
            onChange={(e) => setOpNotes(e.target.value)}
          />
        </label>
        <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
          <p className="text-[11px] text-slate-500">
            Operator overrides (optional). Inferred values in the sections below are never erased — overrides layer on
            top for your review queue.
          </p>
          <label className="block text-slate-500 text-xs">
            Override lead type
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-sm font-mono"
              placeholder="e.g. agency (leave empty to use inferred)"
              value={ovLeadType}
              onChange={(e) => setOvLeadType(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Reason (lead type override)
            <textarea
              className="mt-1 w-full min-h-[44px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs"
              placeholder="Optional — why you changed this"
              value={ovReasonLead}
              onChange={(e) => setOvReasonLead(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Override commercial readiness
            <select
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-sm font-mono"
              value={ovReadiness}
              onChange={(e) => setOvReadiness(e.target.value)}
            >
              <option value="">— use inferred —</option>
              <option value="low">low</option>
              <option value="moderate">moderate</option>
              <option value="high">high</option>
            </select>
          </label>
          <label className="block text-slate-500 text-xs">
            Reason (readiness override)
            <textarea
              className="mt-1 w-full min-h-[44px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs"
              placeholder="Optional"
              value={ovReasonReadiness}
              onChange={(e) => setOvReasonReadiness(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Override best offer angle
            <textarea
              className="mt-1 w-full min-h-[56px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-sm"
              placeholder="Leave empty to use inferred angle"
              value={ovOffer}
              onChange={(e) => setOvOffer(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Reason (offer angle override)
            <textarea
              className="mt-1 w-full min-h-[44px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs"
              placeholder="Optional"
              value={ovReasonOffer}
              onChange={(e) => setOvReasonOffer(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Override weak spots (JSON array of tags)
            <textarea
              className="mt-1 w-full min-h-[56px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs font-mono"
              placeholder='e.g. ["weak_cta","no_lead_capture"] or leave empty'
              value={ovWeakJson}
              onChange={(e) => setOvWeakJson(e.target.value)}
            />
          </label>
          <label className="block text-slate-500 text-xs">
            Reason (weak spots override)
            <textarea
              className="mt-1 w-full min-h-[44px] rounded border border-white/10 bg-black/40 px-2 py-1 text-white text-xs"
              placeholder="Optional"
              value={ovReasonWeak}
              onChange={(e) => setOvReasonWeak(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveOperator()}
            className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save operator fields"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void markReviewed()}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
          >
            Mark manually reviewed
          </button>
        </div>
        {analysis.manuallyReviewedAt && (
          <p className="text-[10px] text-slate-600 mt-1 font-mono">
            Reviewed at {String(analysis.manuallyReviewedAt)}
          </p>
        )}
      </div>

      {se && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-3">
          <p className="text-amber-200/90 text-xs font-semibold uppercase tracking-wide mb-2">Why this score?</p>
          <ul className="space-y-2 text-xs text-slate-300">
            {(
              [
                ["visibility_score", "Visibility"],
                ["demand_score", "Demand"],
                ["intent_score", "Intent"],
                ["friction_score", "Friction"],
                ["fit_score", "Fit"],
                ["opportunity_score", "Opportunity"],
              ] as const
            ).map(([key, label]) => {
              const val = se[key];
              const text = typeof val === "string" ? val : "";
              return text ? (
                <li key={key}>
                  <span className="text-slate-500">{label}:</span> {text}
                </li>
              ) : null;
            })}
          </ul>
          {confRationale && (
            <p className="text-[11px] text-slate-400 mt-3 border-t border-amber-500/20 pt-2">
              <span className="text-slate-500">Confidence:</span> {confRationale}
            </p>
          )}
          {(posDrivers.length > 0 || negDrivers.length > 0) && (
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-[11px]">
              {posDrivers.length > 0 && (
                <div>
                  <p className="text-emerald-500/90 font-medium mb-1">Positive drivers</p>
                  <ul className="list-disc pl-4 text-slate-400 space-y-0.5">
                    {posDrivers.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {negDrivers.length > 0 && (
                <div>
                  <p className="text-rose-400/90 font-medium mb-1">Negative drivers</p>
                  <ul className="list-disc pl-4 text-slate-400 space-y-0.5">
                    {negDrivers.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Section title="Account summary" body={JSON.stringify(analysis.accountSummaryJson ?? {}, null, 2)} />
      <Section title="Content summary" body={JSON.stringify(analysis.contentSummaryJson ?? {}, null, 2)} />
      <Section title="Comment intelligence" body={JSON.stringify(analysis.commentSummaryJson ?? {}, null, 2)} />
      <p>
        <span className="text-slate-500">Strengths</span>
        <br />
        {arrLines("strengthsJson")}
      </p>
      <div className="rounded-lg border border-rose-500/20 bg-rose-950/10 p-3">
        <p className="text-slate-500 text-xs">
          Weak spots (inferred){" "}
          <span className="text-[10px] text-slate-600">· tags drive scoring; evidence below is public text only.</span>
        </p>
        <p className="text-slate-200 mt-1">{arrLines("weakSpotsJson")}</p>
        <EvidenceBullets lines={ev?.weakSpots ?? []} />
      </div>
      {Array.isArray(analysis.operatorOverrideWeakSpotsJson) &&
        (analysis.operatorOverrideWeakSpotsJson as string[]).length > 0 && (
          <p>
            <span className="text-slate-500">Weak spots (operator override)</span>
            <br />
            {"• " + (analysis.operatorOverrideWeakSpotsJson as string[]).join("\n• ")}
          </p>
        )}
      {analysis.operatorOverrideWeakSpotsReason ? (
        <p className="text-[11px] text-slate-500 pl-2 border-l border-amber-500/30">
          Override reason: {String(analysis.operatorOverrideWeakSpotsReason)}
        </p>
      ) : null}
      <p>
        <span className="text-slate-500">Pain points</span>
        <br />
        {arrLines("painPointsJson")}
      </p>
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3">
        <p className="text-slate-500 text-xs flex flex-wrap items-center gap-x-1">
          Buyer questions (inferred list)
          <FindingConfChip v={fc?.repeatedBuyerQuestions} label="buyer questions" />
        </p>
        <p className="text-slate-200 mt-1">{arrLines("repeatedBuyerQuestionsJson")}</p>
        <EvidenceBullets lines={ev?.repeatedBuyerQuestions ?? []} />
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-3">
        <p className="text-slate-500 text-xs flex flex-wrap items-center gap-x-1">
          Objections
          <FindingConfChip v={fc?.objectionThemes} label="objections" />
        </p>
        <p className="text-slate-200 mt-1">{arrLines("objectionThemesJson")}</p>
        <EvidenceBullets lines={ev?.objectionThemes ?? []} />
      </div>
      <div className="rounded-lg border border-sky-500/20 bg-sky-950/10 p-3">
        <p className="text-slate-500 text-xs">Demand signals</p>
        <p className="text-slate-200 mt-1">{arrLines("demandSignalsJson")}</p>
        <EvidenceBullets lines={ev?.demandSignals ?? []} />
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-3">
        <p className="text-slate-500 text-xs flex flex-wrap items-center gap-x-1">
          Best offer angle (inferred)
          <FindingConfChip v={fc?.bestOfferAngle} label="best offer angle" />
        </p>
        <p className="text-slate-200 mt-1 whitespace-pre-wrap">{str("bestOfferAngle")}</p>
      </div>
      {typeof analysis.operatorOverrideBestOfferAngle === "string" && analysis.operatorOverrideBestOfferAngle.trim() ? (
        <p>
          <span className="text-slate-500">Best offer angle (operator override)</span>
          <br />
          <span className="text-amber-100/90">{analysis.operatorOverrideBestOfferAngle}</span>
        </p>
      ) : null}
      {analysis.operatorOverrideBestOfferAngleReason ? (
        <p className="text-[11px] text-slate-500 pl-2 border-l border-amber-500/30">
          Override reason: {String(analysis.operatorOverrideBestOfferAngleReason)}
        </p>
      ) : null}
      <p className="flex flex-col gap-1">
        <span className="text-slate-500">
          Manual comment angle
          <CopyBtn text={str("suggestedCommentAngle")} />
        </span>
        <span className="text-slate-200">{str("suggestedCommentAngle")}</span>
      </p>
      <p className="flex flex-col gap-1">
        <span className="text-slate-500">
          Follow message angle (manual)
          <CopyBtn text={str("suggestedFollowMessageAngle")} />
        </span>
        <span className="text-slate-200">{str("suggestedFollowMessageAngle")}</span>
      </p>
      <p className="flex flex-col gap-1">
        <span className="text-slate-500">
          Email angle (manual)
          <CopyBtn text={str("suggestedEmailAngle")} />
        </span>
        <span className="text-slate-200">{str("suggestedEmailAngle")}</span>
      </p>
      <p>
        <span className="text-slate-500">Confidence / access</span>
        <br />
        confidence {String(analysis.confidenceScore ?? "")} · access {str("accessStatus")}
      </p>
      <p className="text-xs text-slate-500">{arrLines("riskNotesJson")}</p>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">{title}</p>
      <pre className="text-xs bg-black/40 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{body}</pre>
    </div>
  );
}
