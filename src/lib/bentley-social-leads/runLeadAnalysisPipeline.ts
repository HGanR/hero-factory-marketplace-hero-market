/**
 * Orchestrates public-surface fetch + deterministic analysis for one lead.
 * Extend fetchers per platform later — keep scoring and suggestions modular.
 */

import { buildActionRationale } from "./buildActionRationale";
import { buildActionEvidenceSnippets, buildEvidenceJson } from "./buildEvidenceJson";
import { buildFindingConfidenceJson } from "./buildFindingConfidence";
import { buildRankingDiagnosticsJson } from "./buildRankingDiagnosticsJson";
import { buildTopLeadDriversJson } from "./buildTopLeadDriversJson";
import { buildManualApproachSuggestions } from "./buildManualApproachSuggestions";
import { computeScoreExplanations } from "./computeScoreExplanations";
import { computeScores } from "./computeScores";
import { deriveWeakSpots } from "./deriveWeakSpots";
import { extractCommercialSignals } from "./extractCommercialSignals";
import { fetchLinkedWebsiteSurface } from "./fetchLinkedWebsiteSurface";
import { fetchPublicSocialSurface } from "./fetchPublicSocialSurface";
import { gradeWebsiteSurface } from "./gradeWebsiteSurface";
import { inferCommercialReadiness } from "./inferCommercialReadiness";
import { inferLeadType } from "./inferLeadType";
import { applySurfaceCoverage } from "./normalizePublicSurface";
import {
  buildCorpusForVertical,
  inferVertical,
  prioritizeWeakSpotsForLeadType,
  prioritizeWeakSpotsForVertical,
  sharpenManualAngles,
  sharpenOfferAngle,
  sharpenOfferAngleWithLeadContext,
} from "./mapVerticalPlaybook";
import { mapOfferAngle } from "./mapOfferAngle";
import { applyBentleyCsvImportSurfaceMerge } from "./applyCsvImportSurface";
import { buildEngineSignals } from "./engine/buildEngineSignals";
import type { EvidenceByFinding, FullLeadAnalysis, MaturityStage, NormalizedLead } from "./types";
import { BENTLEY_SLI_PIPELINE_VERSION } from "./types";

function inferBusinessType(bio: string, title: string): string {
  const t = `${bio} ${title}`.toLowerCase();
  if (/coach|consult|agency|marketing|creative/i.test(t)) return "service_business";
  if (/shop|store|boutique|ecommerce|shipping/i.test(t)) return "commerce";
  if (/creator|influencer|content|youtube|tiktok/i.test(t)) return "creator_led";
  if (/saas|software|app|api/i.test(t)) return "tech_product";
  return "general_small_business";
}

function inferMaturity(followers: number | undefined, hasSite: boolean): MaturityStage {
  const f = followers ?? 0;
  if (f < 800 && !hasSite) return "early_stage";
  if (f < 8000 && hasSite) return "active_but_manual";
  if (f < 80_000) return "growing";
  return "established_but_underoptimized";
}

export async function runLeadAnalysisPipeline(
  normalized: NormalizedLead,
  rawRow: Record<string, unknown>
): Promise<FullLeadAnalysis> {
  let social = await fetchPublicSocialSurface(normalized.profileUrl || null);
  social = applyBentleyCsvImportSurfaceMerge(social, rawRow);
  const siteUrl = normalized.websiteUrl || social.linkInBio || null;
  const hadWebsiteUrlAttempt = Boolean(siteUrl?.trim());
  const site = await fetchLinkedWebsiteSurface(siteUrl);
  const websiteGrade = gradeWebsiteSurface(site);

  social = applySurfaceCoverage(social, site, hadWebsiteUrlAttempt);

  const inferredLeadType = inferLeadType({ lead: normalized, social, website: site });
  const commercial = extractCommercialSignals(social.posts, social.comments);

  const hasBuyerIntentInComments = social.comments.some((c) =>
    c.classifications.some((x) => x === "buyer_intent" || x === "price_inquiry" || x === "booking_intent")
  );

  const overallCov = social.coverageBreakdown?.overallCoverageScore ?? social.coverageScore ?? 0;
  const commercialReadiness = inferCommercialReadiness({
    social,
    website: site,
    websiteGrade,
    hasBuyerIntentInComments,
    overallCoverageScore: overallCov,
  });

  const corpus = buildCorpusForVertical({
    lead: normalized,
    social,
    websiteTitle: site?.title,
    websiteDescription: site?.description,
    postSnippets: social.posts.map((p) => p.captionSnippet),
  });
  const inferredVertical = inferVertical(corpus);

  let weakSpots = deriveWeakSpots(normalized, social, site, commercial, websiteGrade);
  weakSpots = prioritizeWeakSpotsForVertical(inferredVertical, weakSpots);
  weakSpots = prioritizeWeakSpotsForLeadType(inferredLeadType, weakSpots);

  const hasWebsiteSignals = Boolean(site?.ok);

  const scores = computeScores(
    social,
    weakSpots,
    hasBuyerIntentInComments,
    hasWebsiteSignals,
    site,
    websiteGrade,
    commercial,
    overallCov
  );

  const scoreExplanations = computeScoreExplanations(scores, {
    accessStatus: social.accessStatus,
    weakSpotCount: weakSpots.length,
    hasBuyerIntentInComments,
    commentCount: social.comments.length,
    postCount: social.posts.length,
    hasBio: Boolean(social.bio && social.bio.length > 15),
    siteOk: Boolean(site?.ok),
    leadCapturePresent: Boolean(site?.leadCapturePresent),
    bookingPathPresent: Boolean(site?.bookingPathPresent),
    clearCtaPresent: Boolean(site?.clearCtaPresent),
    websiteGrade,
    commercial,
    overallCoverageScore: overallCov,
  });

  const topLeadDriversJson = buildTopLeadDriversJson(scoreExplanations);

  const baseOffer = mapOfferAngle(weakSpots, normalized.businessName);
  let bestOfferAngle = sharpenOfferAngle(inferredVertical, baseOffer, weakSpots);
  if (commercial.bookingFrictionSignals.length >= 2) {
    bestOfferAngle +=
      " Public comments mention booking friction — prioritize one clear scheduling path and confirmation copy.";
  }
  if (commercial.urgencySignals.length >= 2) {
    bestOfferAngle += " Urgency language in threads — shorten the path from interest to booked slot.";
  }
  bestOfferAngle = sharpenOfferAngleWithLeadContext(bestOfferAngle, inferredLeadType, commercialReadiness);

  const tagBlock = buildManualApproachSuggestions(normalized, social, scores, bestOfferAngle, {
    inferredLeadType,
    commercialReadiness,
  });
  const rankingDiagnosticsJson = buildRankingDiagnosticsJson(
    scoreExplanations,
    scores,
    overallCov,
    tagBlock.suggestedActionTags
  );
  const manual = sharpenManualAngles(inferredVertical, normalized, social, scores, bestOfferAngle, {
    inferredLeadType,
    commercialReadiness,
  });

  const emailPresent = Boolean(normalized.email?.trim());
  const websitePresent = Boolean(site?.ok || normalized.websiteUrl?.trim());
  const actionRationale = buildActionRationale({
    accessStatus: social.accessStatus,
    overallCoverageScore: overallCov,
    emailPresent,
    websitePresent,
    hasBuyerIntentInComments,
    commercialReadiness,
    confidenceScore: scores.confidenceScore,
    opportunityScore: scores.opportunityScore,
  });

  const bioText = `${social.bio ?? ""} ${social.displayName ?? ""}`;
  const businessType = inferBusinessType(bioText, social.displayName ?? "");
  const maturityStage = inferMaturity(social.followerCount, hasWebsiteSignals);

  const repeatedBuyerQuestions = commercial.repeatedBuyerQuestions;

  const objectionThemes = commercial.objectionClusters.map(
    (c) => `${c.label}: ${c.examples[0] ?? ""}`.trim()
  );

  const demandSignals: string[] = [];
  if (hasBuyerIntentInComments) demandSignals.push("Visible comment threads show purchase or booking curiosity.");
  if (social.comments.length >= 4) demandSignals.push("Repeated engagement on public threads (volume signal).");
  if (weakSpots.includes("manual_follow_up_risk")) demandSignals.push("Inbound interest may be outpacing capture systems.");
  if (commercial.urgencySignals.length > 0) demandSignals.push("Urgency/time-bound phrasing in public comments.");
  if (commercial.locationOrServiceAreaQuestions.length > 0) demandSignals.push("Location/service-area questions indicate geo-qualified demand.");
  if (commercial.bookingFrictionSignals.length > 0) demandSignals.push("Booking friction phrases — prospects want a clearer path.");
  if (commercial.repeatedAcrossPosts && commercial.repeatedAcrossPostsCount >= 2) {
    demandSignals.push("Similar buyer questions recur across multiple public posts or comment threads.");
  }

  const findingConfidenceJson = buildFindingConfidenceJson({
    accessStatus: social.accessStatus,
    overallCoverageScore: overallCov,
    confidenceScore: scores.confidenceScore,
    inferredLeadType,
    commercialReadiness,
    commercial,
    weakSpots,
    bestOfferAngle,
    hasBuyerIntentInComments,
  });

  const evidenceJsonBase = buildEvidenceJson({
    social,
    site,
    commercial,
    weakSpots,
    websiteGrade,
    demandSignals,
  });
  const evidenceJson: EvidenceByFinding = {
    ...evidenceJsonBase,
    actionRationale: buildActionEvidenceSnippets({
      accessStatus: social.accessStatus,
      overallCoverageScore: overallCov,
      emailPresent,
      websitePresent,
      hasBuyerIntentInComments,
    }),
  };

  const evidenceSnippetCount =
    evidenceJson.weakSpots.length +
    evidenceJson.repeatedBuyerQuestions.length +
    evidenceJson.objectionThemes.length +
    evidenceJson.demandSignals.length +
    evidenceJson.actionRationale.length;

  const engineSignals = buildEngineSignals({
    postSnippets: social.posts.map((p) => p.captionSnippet),
    commentTexts: social.comments.map((c) => c.text),
    commercial,
    commercialReadiness,
    inferredVertical,
    opportunityScore: scores.opportunityScore,
    intentScore: scores.intentScore,
    confidenceScore: scores.confidenceScore,
    buyerIntentPresent: hasBuyerIntentInComments,
    overallCoverageScore: overallCov,
    bestOfferAngle,
    suggestedNextMove: manual.suggestedNextMove,
    actionRationale,
    evidenceJsonSnippetCount: evidenceSnippetCount,
  });

  const strengths: string[] = [];
  if (social.accessStatus === "public") strengths.push("Public profile surface is reachable for review.");
  if (social.bio && social.bio.length > 30) strengths.push("Bio presents a clear positioning snippet.");
  if (social.posts.some((p) => p.classifications.includes("strong_cta"))) strengths.push("Some posts include explicit CTAs.");
  if (site?.bookingPathPresent) strengths.push("Website shows a booking/scheduling path.");
  if (site?.leadCapturePresent) strengths.push("Website shows lead capture (email/form/newsletter).");
  if (websiteGrade && ["A", "B"].includes(websiteGrade.websiteGrade)) {
    strengths.push(`Website graded ${websiteGrade.websiteGrade} on visible conversion signals.`);
  }
  if (overallCov >= 0.55) strengths.push(`Extraction coverage ${(overallCov * 100).toFixed(0)}% — enough public signal for triage.`);

  const likelyPainPoints: string[] = [];
  if (weakSpots.includes("no_lead_capture")) likelyPainPoints.push("Leads may leak without owned capture.");
  if (weakSpots.includes("dm_booking_only")) likelyPainPoints.push("Conversion may depend on manual DM handling.");
  if (weakSpots.includes("weak_offer_clarity")) likelyPainPoints.push("Offer and next step may be ambiguous for buyers.");
  if (commercial.bookingFrictionSignals.length >= 2) likelyPainPoints.push("Commenters report friction booking or getting a reply.");
  if (overallCov < 0.35) likelyPainPoints.push("Low extraction coverage — limited public text for scoring.");
  if (commercial.repeatedAcrossPosts && commercial.repeatedAcrossPostsCount >= 2) {
    likelyPainPoints.push("Buyers may be asking the same question repeatedly — answer once in a pinned post or site FAQ.");
  }

  const riskNotes: string[] = [...social.accessNotes];
  if (social.extractionNotes?.length) riskNotes.push(...social.extractionNotes);
  riskNotes.push("Bentley does not execute outreach — manual operator actions only.");
  if (social.accessStatus !== "public") {
    riskNotes.push("Low public surface — scores and angles are fallback heuristics with reduced confidence.");
  }
  if (social.coverageBreakdown?.notes?.length) {
    riskNotes.push(`Coverage: ${social.coverageBreakdown.notes.slice(0, 3).join(" · ")}`);
  }

  const coverageJson = social.coverageBreakdown
    ? {
        ...social.coverageBreakdown,
        coverageScore: social.coverageScore ?? social.coverageBreakdown.overallCoverageScore,
      }
    : {
        profileCoverageScore: 0,
        postCoverageScore: 0,
        commentCoverageScore: 0,
        websiteCoverageScore: 0,
        overallCoverageScore: 0,
        notes: ["Coverage breakdown unavailable — treat as low coverage."],
        coverageScore: 0,
      };

  const summary = `${normalized.businessName} (${normalized.platform}) · ${inferredVertical.replace(/_/g, " ")} · ${inferredLeadType.replace(/_/g, " ")} · readiness ${commercialReadiness} · opportunity ${(scores.opportunityScore * 100).toFixed(0)}/100 · access ${social.accessStatus}.`;

  const accountSummary = {
    handle: normalized.handle,
    platform: normalized.platform,
    inferredVertical,
    inferredLeadType,
    commercialReadiness,
    coverageScore: coverageJson.coverageScore,
    displayName: social.displayName,
    bio: social.bio,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    linkInBio: social.linkInBio,
    profileUrl: social.profileUrlResolved ?? normalized.profileUrl,
    accessStatus: social.accessStatus,
    websiteGrade: websiteGrade
      ? {
          letter: websiteGrade.websiteGrade,
          explanation: websiteGrade.websiteGradeExplanation,
        }
      : null,
  };

  const contentSummary = {
    postSurfacesAnalyzed: social.posts.length,
    postLabels: social.posts.map((p, i) => ({ i, classifications: p.classifications })),
    note: "Post items are heuristics from visible HTML only — not video/audio classification.",
    profileSurface: social.profileSurface ?? null,
  };

  const commentIntelligenceSummary = {
    commentSamples: social.comments.length,
    buyerIntentSignals: hasBuyerIntentInComments,
    topPatterns: [...new Set(social.comments.flatMap((c) => c.classifications))].slice(0, 12),
    objectionClusters: commercial.objectionClusters,
    bookingFrictionSignals: commercial.bookingFrictionSignals,
    urgencySignals: commercial.urgencySignals,
    locationOrServiceAreaQuestions: commercial.locationOrServiceAreaQuestions,
    repeatedAcrossPosts: commercial.repeatedAcrossPosts,
    repeatedAcrossPostsCount: commercial.repeatedAcrossPostsCount,
  };

  const rawAnalysis: Record<string, unknown> = {
    model: "bentley-sli-v6-heuristic",
    pipelineVersion: BENTLEY_SLI_PIPELINE_VERSION,
    rawInputKeys: Object.keys(rawRow),
    socialAccessNotes: social.accessNotes,
    socialExtractionNotes: social.extractionNotes ?? [],
    websiteNotes: site?.notes ?? [],
    websiteSignals: site
      ? {
          clearCtaPresent: site.clearCtaPresent,
          bookingPathPresent: site.bookingPathPresent,
          leadCapturePresent: site.leadCapturePresent,
          reviewSignalPresent: site.reviewSignalPresent,
          contactMethodSummary: site.contactMethodSummary,
        }
      : null,
    websiteGradeDetail: websiteGrade,
    corpusLength: corpus.length,
    inferredLeadType,
    commercialReadiness,
    coverageBreakdown: social.coverageBreakdown,
    engineSignals,
  };

  return {
    accessStatus: social.accessStatus,
    summary,
    strengths,
    weakSpots,
    likelyPainPoints,
    businessType,
    maturityStage,
    inferredVertical,
    inferredLeadType,
    commercialReadiness,
    coverageJson,
    scoreExplanations,
    accountSummary,
    contentSummary,
    commentIntelligenceSummary,
    commercialCommentSignals: commercial,
    websiteGrade,
    pipelineVersion: BENTLEY_SLI_PIPELINE_VERSION,
    repeatedBuyerQuestions,
    objectionThemes,
    demandSignals,
    scores,
    bestOfferAngle,
    suggestedCommentAngle: manual.suggestedCommentAngle,
    suggestedFollowMessageAngle: manual.suggestedFollowMessageAngle,
    suggestedEmailAngle: manual.suggestedEmailAngle,
    suggestedNextMove: manual.suggestedNextMove,
    actionRationale,
    evidenceJson,
    findingConfidenceJson,
    topLeadDriversJson,
    rankingDiagnosticsJson,
    riskNotes,
    suggestedActionTags: tagBlock.suggestedActionTags,
    postClassifications: social.posts.map((p, i) => ({ index: i, labels: p.classifications })),
    rawAnalysis,
  };
}
