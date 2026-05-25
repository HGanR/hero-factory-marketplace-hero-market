import type { ScoreBundle, ScoreExplanations } from "@/lib/bentley-social-leads/types";
import type { CommercialCommentSignals } from "@/lib/bentley-social-leads/types";
import type { AccessStatus } from "@/lib/bentley-social-leads/types";
import type { WebsiteGradeResult } from "@/lib/bentley-social-leads/types";

export type ScoreExplanationContext = {
  accessStatus: AccessStatus;
  weakSpotCount: number;
  hasBuyerIntentInComments: boolean;
  commentCount: number;
  postCount: number;
  hasBio: boolean;
  siteOk: boolean;
  leadCapturePresent: boolean;
  bookingPathPresent: boolean;
  clearCtaPresent: boolean;
  websiteGrade: WebsiteGradeResult | null;
  commercial: CommercialCommentSignals;
  overallCoverageScore: number;
};

function line(parts: string[]): string {
  return parts.filter(Boolean).join(" ").slice(0, 480);
}

/** Deterministic copy for operators — mirrors score magnitudes without implying causality. */
export function computeScoreExplanations(scores: ScoreBundle, ctx: ScoreExplanationContext): ScoreExplanations {
  const cov = ctx.overallCoverageScore;
  const vis = scores.visibilityScore;
  const dem = scores.demandScore;
  const intent = scores.intentScore;
  const fri = scores.frictionScore;
  const fit = scores.fitScore;
  const opp = scores.opportunityScore;
  const conf = scores.confidenceScore;

  return {
    visibility_score: line([
      `Visibility score ${vis.toFixed(2)}.`,
      ctx.postCount ? `${ctx.postCount} posts sampled.` : "Sparse post surface.",
      ctx.hasBio ? "Bio text present." : "Bio thin or missing.",
    ]),
    demand_score: line([
      `Demand score ${dem.toFixed(2)}.`,
      ctx.commentCount ? `${ctx.commentCount} comments reviewed.` : "Few public comments.",
    ]),
    intent_score: line([
      `Intent score ${intent.toFixed(2)}.`,
      ctx.hasBuyerIntentInComments ? "Buyer-intent language observed in thread." : "No strong buyer-intent markers.",
    ]),
    friction_score: line([
      `Friction score ${fri.toFixed(2)}.`,
      ctx.commercial.bookingFrictionSignals.length
        ? `${ctx.commercial.bookingFrictionSignals.length} booking-friction snippets.`
        : "Limited booking-friction signals.",
    ]),
    fit_score: line([`Fit score ${fit.toFixed(2)}.`, `Access: ${ctx.accessStatus}.`]),
    opportunity_score: line([
      `Opportunity score ${opp.toFixed(2)}.`,
      ctx.siteOk ? "Website surface reachable." : "Website surface limited or unreachable.",
    ]),
    top_positive_drivers: [
      ctx.clearCtaPresent ? "Clear on-site CTA language" : "",
      ctx.leadCapturePresent ? "Lead capture hints on site" : "",
      cov > 0.45 ? "Coverage depth on public surfaces" : "",
    ].filter(Boolean),
    top_negative_drivers: [
      ctx.weakSpotCount ? `${ctx.weakSpotCount} weak-spot tags` : "",
      !ctx.bookingPathPresent && ctx.siteOk ? "No obvious booking path on site" : "",
      fri > 0.55 ? "Elevated friction signals in public text" : "",
    ].filter(Boolean),
    confidence_rationale: line([
      `Confidence ${conf.toFixed(2)} driven by access=${ctx.accessStatus}, coverage=${cov.toFixed(2)}.`,
      `Website grade: ${ctx.websiteGrade?.websiteGrade ?? "n/a"}.`,
    ]),
  };
}
