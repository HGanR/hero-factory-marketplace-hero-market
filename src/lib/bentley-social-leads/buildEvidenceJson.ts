/**
 * Evidence snippets from public text only — grouped by finding key (caps enforced).
 */

import type { AccessStatus, CommercialCommentSignals, EvidenceByFinding } from "./types";
import type { PublicSocialSurface } from "./types";
import type { WeakSpotTag } from "./types";
import type { WebsiteGradeResult } from "./types";
import type { WebsiteSurface } from "./types";

const MAX = 6;
const SNIP = 180;

function snip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= SNIP ? t : t.slice(0, SNIP - 1) + "…";
}

/** Short lines that ground the suggested next move in observable public signals. */
export function buildActionEvidenceSnippets(args: {
  accessStatus: AccessStatus;
  overallCoverageScore: number;
  emailPresent: boolean;
  websitePresent: boolean;
  hasBuyerIntentInComments: boolean;
}): string[] {
  const out: string[] = [];
  if (args.accessStatus === "public") {
    out.push("Public profile HTML was reachable for this pass.");
  } else {
    out.push(`Access mode: ${args.accessStatus} — triage on thinner HTML.`);
  }
  out.push(
    `Overall extraction coverage ${(args.overallCoverageScore * 100).toFixed(0)}% (profile, posts, comments, site when fetched).`
  );
  if (args.websitePresent) {
    out.push("A website link resolved from lead or bio — compare on-site capture vs DMs.");
  } else {
    out.push("No confirmed website from lead/bio — first touch should clarify channel.");
  }
  if (args.emailPresent) {
    out.push("Email present on the lead row — optional direct path when policy allows.");
  } else {
    out.push("No email on lead row — rely on public thread or site form cues.");
  }
  if (args.hasBuyerIntentInComments) {
    out.push("Buyer-intent phrasing appears in visible comment text.");
  } else {
    out.push("Buyer intent not clearly detected in visible comments — lean on post copy.");
  }
  return out.map(snip).slice(0, MAX);
}

export function buildEvidenceJson(args: {
  social: PublicSocialSurface;
  site: WebsiteSurface | null;
  commercial: CommercialCommentSignals;
  weakSpots: WeakSpotTag[];
  websiteGrade: WebsiteGradeResult | null;
  demandSignals: string[];
}): EvidenceByFinding {
  const { social, site, commercial, weakSpots, websiteGrade } = args;

  let repeatedBuyerQuestions = commercial.repeatedBuyerQuestions.map(snip);
  if (commercial.repeatedAcrossPosts && commercial.repeatedAcrossPostsCount >= 2) {
    const hint = snip(
      `Similar buyer-style question seen across ${commercial.repeatedAcrossPostsCount} public surfaces (posts/comments).`
    );
    if (!repeatedBuyerQuestions.includes(hint)) {
      repeatedBuyerQuestions = [hint, ...repeatedBuyerQuestions];
    }
  }
  repeatedBuyerQuestions = repeatedBuyerQuestions.slice(0, MAX);

  const objectionThemes: string[] = [];
  for (const cl of commercial.objectionClusters) {
    for (const ex of cl.examples.slice(0, 2)) {
      objectionThemes.push(snip(`${cl.label}: ${ex}`));
      if (objectionThemes.length >= MAX) break;
    }
    if (objectionThemes.length >= MAX) break;
  }

  const weakCta: string[] = [];
  for (const p of social.posts) {
    if (
      p.classifications.includes("weak_cta") ||
      (p.classifications.includes("direct_offer") && !p.classifications.includes("strong_cta"))
    ) {
      weakCta.push(snip(p.captionSnippet));
      if (weakCta.length >= MAX) break;
    }
  }
  if (weakCta.length === 0 && weakSpots.includes("weak_cta")) {
    const bio = social.bio ?? "";
    if (bio.length > 15) weakCta.push(snip(`Bio: ${bio}`));
  }

  const bookingFriction = commercial.bookingFrictionSignals.map(snip).slice(0, MAX);

  const trustSignalGaps: string[] = [];
  if (weakSpots.includes("no_reviews_visible") || weakSpots.includes("low_trust_signals")) {
    if (site?.ok && !site.reviewSignalPresent) {
      trustSignalGaps.push(snip("Visible page copy lacks strong review/testimonial cues."));
    } else if (!site?.ok) {
      trustSignalGaps.push(snip("Website surface missing or failed fetch — trust signals not verified."));
    }
  }
  if (websiteGrade && websiteGrade.trustSignalScore < 0.35) {
    trustSignalGaps.push(snip(`Trust signal score ${websiteGrade.trustSignalScore.toFixed(2)} (surface heuristics).`));
  }

  const leadCaptureGaps: string[] = [];
  if (weakSpots.includes("no_lead_capture") || weakSpots.includes("no_email_capture")) {
    if (site?.ok && !site.leadCapturePresent) {
      leadCaptureGaps.push(snip("No obvious email/form/newsletter capture in visible HTML."));
    } else if (!site?.ok) {
      leadCaptureGaps.push(snip("No working site segment — capture path not confirmed."));
    }
  }

  const weakSpotsBucket: string[] = [];
  for (const x of weakCta) weakSpotsBucket.push(`Weak CTA: ${x}`);
  for (const x of bookingFriction) weakSpotsBucket.push(`Booking friction (comments): ${x}`);
  for (const x of trustSignalGaps) weakSpotsBucket.push(`Trust: ${x}`);
  for (const x of leadCaptureGaps) weakSpotsBucket.push(`Capture: ${x}`);
  for (const tag of weakSpots.slice(0, 8)) {
    weakSpotsBucket.push(snip(`Tagged weak spot: ${tag.replace(/_/g, " ")}`));
  }

  const demandSignals = args.demandSignals.map(snip).slice(0, MAX);

  return {
    weakSpots: weakSpotsBucket.slice(0, MAX * 2),
    repeatedBuyerQuestions,
    objectionThemes,
    demandSignals,
    actionRationale: [],
  };
}
