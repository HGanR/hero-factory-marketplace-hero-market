/**
 * Build EngineSignals bundle for persistence under rawAnalysis.engineSignals.
 */

import type { CommercialCommentSignals } from "../types";
import type { CommercialReadiness } from "../types";
import type { EngineSignals } from "./domainTypes";
import {
  classifyIntentFlags,
  classifyPainFromText,
  classifyUrgencyFromText,
  inferCommercialStageFromSignals,
} from "./classifySignals";
import { computeIntentScore0To100 } from "./intentScoreModel";

function buildCorpus(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join(" \n ")
    .slice(0, 24_000);
}

function pickEvidenceSnippets(commercial: CommercialCommentSignals, max = 8): string[] {
  const out: string[] = [];
  for (const q of commercial.repeatedBuyerQuestions.slice(0, 3)) {
    out.push(q);
  }
  for (const cl of commercial.objectionClusters.slice(0, 2)) {
    out.push(...cl.examples.slice(0, 2));
  }
  for (const u of commercial.urgencySignals.slice(0, 2)) {
    out.push(u);
  }
  return out.slice(0, max).map((s) => (s.length > 220 ? `${s.slice(0, 217)}…` : s));
}

function hooksFromPain(pain: string, vertical: string): { hook: string; cta: string } {
  const v = vertical.replace(/_/g, " ");
  const map: Record<string, { hook: string; cta: string }> = {
    lead_generation: {
      hook: `“Still buying leads the hard way?” — speak to ${v} owners drowning in DMs.`,
      cta: "Book a 15‑min pipeline audit — we’ll map one capture fix.",
    },
    low_sales: {
      hook: `“Quiet phone, busy calendar elsewhere?” — ${v} prospects are comparing you in comments.`,
      cta: "Reply with your niche — we’ll send one angle to test this week.",
    },
    content_problem: {
      hook: "“Posting daily but hearing crickets?” — turn comment questions into hooks.",
      cta: "Steal our 5‑hook template built from real buyer questions.",
    },
    other: {
      hook: "“What buyers actually said this week” — market language for your next post.",
      cta: "Save this angle before you draft your next CTA.",
    },
  };
  return map[pain] ?? map.other;
}

function engineHandoffFromHeuristics(params: {
  evidenceCount: number;
  hasRationale: boolean;
  hasNextMove: boolean;
  confidenceScore: number;
  coverageScore: number;
}): EngineSignals["handoffReadiness"] {
  if (!params.hasRationale || !params.hasNextMove || params.coverageScore < 0.28 || params.confidenceScore < 0.38) {
    return "not_ready";
  }
  if (
    params.evidenceCount >= 3 &&
    params.confidenceScore >= 0.52 &&
    params.coverageScore >= 0.38 &&
    params.hasRationale &&
    params.hasNextMove
  ) {
    return "ready";
  }
  if (params.evidenceCount < 1 || params.confidenceScore < 0.45 || params.coverageScore < 0.35) {
    return "review_needed";
  }
  return "review_needed";
}

export function buildEngineSignals(params: {
  postSnippets: string[];
  commentTexts: string[];
  commercial: CommercialCommentSignals;
  commercialReadiness: CommercialReadiness;
  inferredVertical: string;
  opportunityScore: number;
  intentScore: number;
  confidenceScore: number;
  buyerIntentPresent: boolean;
  overallCoverageScore: number;
  bestOfferAngle: string;
  suggestedNextMove: string;
  actionRationale: string;
  evidenceJsonSnippetCount: number;
}): EngineSignals {
  const corpus = buildCorpus([...params.postSnippets, ...params.commentTexts]);
  const painType = classifyPainFromText(corpus);
  const urgency = classifyUrgencyFromText(corpus);
  const commercialReadinessStage = inferCommercialStageFromSignals(params.commercialReadiness, corpus);
  const intentScoreResult = computeIntentScore0To100({
    corpus,
    commercial: params.commercial,
    opportunityScore: params.opportunityScore,
    intentScore: params.intentScore,
    confidenceScore: params.confidenceScore,
    buyerIntentPresent: params.buyerIntentPresent,
    overallCoverageScore: params.overallCoverageScore,
  });

  const { hook, cta } = hooksFromPain(painType, params.inferredVertical);
  const evidenceSnippets = pickEvidenceSnippets(params.commercial);

  const hasRationale = Boolean(params.actionRationale?.trim());
  const hasNext = Boolean(params.suggestedNextMove?.trim());
  const handoffReadiness = engineHandoffFromHeuristics({
    evidenceCount: params.evidenceJsonSnippetCount,
    hasRationale,
    hasNextMove: hasNext,
    confidenceScore: params.confidenceScore,
    coverageScore: params.overallCoverageScore,
  });

  return {
    schemaVersion: 1,
    intentScore: intentScoreResult,
    painType,
    urgency,
    commercialReadinessStage,
    evidenceSnippets,
    recommendedContentHook: hook,
    recommendedCtaAngle: cta,
    handoffReadiness,
    intentClassification: classifyIntentFlags(corpus),
  };
}
