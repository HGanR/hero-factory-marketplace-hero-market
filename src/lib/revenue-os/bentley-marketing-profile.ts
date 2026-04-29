/**
 * Thin normalizer: reconcile session Bentley snapshot, shared launch profile, and optional auth context.
 */

import { industryResolved, type BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { RevenueOsLaunchSharedProfile } from "@/lib/revenue-os/launch-mode-types";
import type { SocialPlatform } from "@/lib/social/config";

export type BentleyMarketingProfile = {
  businessName: string;
  coreOffer: string;
  transformation: string;
  targetAudience: string;
  industryLabel: string;
  postingPlatforms: string[];
  oauthPostingPlatforms: SocialPlatform[];
  campaignNotesPreview: string;
  sources: {
    usedBentleySnapshot: boolean;
    usedSharedProfile: boolean;
    usedAuthenticatedContext: boolean;
  };
};

export type BentleyMarketingProfileCompleteness = {
  score: number;
  max: number;
  missing: string[];
  strengths: string[];
};

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

/**
 * Build a single profile object from overlapping inputs (snapshot wins on structured fields when present).
 */
export function buildBentleyMarketingProfile(args: {
  bentleySnapshot?: BentleySnapshot | null;
  sharedProfile?: RevenueOsLaunchSharedProfile | null;
  /** e.g. same platforms as snapshot when authenticated context has them */
  authenticatedPostingPlatforms?: SocialPlatform[] | null;
}): BentleyMarketingProfile {
  const snap = args.bentleySnapshot;
  const shared = args.sharedProfile;
  const usedSnap = Boolean(snap);
  const usedShared = Boolean(shared);

  const businessName = norm(snap?.businessName) || norm(shared?.businessName);
  const coreOffer = norm(snap?.coreOffer) || norm(shared?.coreOffer);
  const transformation = norm(snap?.transformation) || norm(shared?.transformation);
  const targetAudience = norm(snap?.targetAudience) || norm(shared?.targetAudience);

  let industryLabel = "";
  if (snap && industryResolved(snap)) {
    industryLabel = norm(snap.contentIndustry) || (snap.industryKey ? String(snap.industryKey) : "");
  }
  if (!industryLabel) industryLabel = norm(shared?.industry);

  const fromSnapPlatforms = snap?.postingPlatforms?.length
    ? snap.postingPlatforms.map((p) => String(p))
    : [];
  const fromShared = shared?.postingPlatforms?.length ? [...shared.postingPlatforms] : [];
  const postingPlatforms = fromSnapPlatforms.length ? fromSnapPlatforms : fromShared;

  const oauthPostingPlatforms =
    args.authenticatedPostingPlatforms?.filter(Boolean) ??
    (snap?.postingPlatforms?.length ? [...snap.postingPlatforms] : []);

  const campaignNotesPreview = norm(snap?.campaignNotes).slice(0, 280);

  return {
    businessName,
    coreOffer,
    transformation,
    targetAudience,
    industryLabel,
    postingPlatforms,
    oauthPostingPlatforms,
    campaignNotesPreview,
    sources: {
      usedBentleySnapshot: usedSnap,
      usedSharedProfile: usedShared,
      usedAuthenticatedContext: Boolean(args.authenticatedPostingPlatforms?.length),
    },
  };
}

/** Deep-merge two profiles for completeness checks (second wins on strings when non-empty). */
export function mergeBentleyMarketingProfile(
  a: BentleyMarketingProfile,
  b: BentleyMarketingProfile
): BentleyMarketingProfile {
  const pick = (x: string, y: string) => (norm(y) ? y : x);
  const plat = [...a.postingPlatforms];
  for (const p of b.postingPlatforms) {
    if (!plat.includes(p)) plat.push(p);
  }
  const oauth = [...a.oauthPostingPlatforms];
  for (const p of b.oauthPostingPlatforms) {
    if (!oauth.includes(p)) oauth.push(p);
  }
  return {
    businessName: pick(a.businessName, b.businessName),
    coreOffer: pick(a.coreOffer, b.coreOffer),
    transformation: pick(a.transformation, b.transformation),
    targetAudience: pick(a.targetAudience, b.targetAudience),
    industryLabel: pick(a.industryLabel, b.industryLabel),
    postingPlatforms: plat,
    oauthPostingPlatforms: oauth,
    campaignNotesPreview: norm(b.campaignNotesPreview) || a.campaignNotesPreview,
    sources: {
      usedBentleySnapshot: a.sources.usedBentleySnapshot || b.sources.usedBentleySnapshot,
      usedSharedProfile: a.sources.usedSharedProfile || b.sources.usedSharedProfile,
      usedAuthenticatedContext:
        a.sources.usedAuthenticatedContext || b.sources.usedAuthenticatedContext,
    },
  };
}

export function summarizeBentleyMarketingProfileCompleteness(
  p: BentleyMarketingProfile
): BentleyMarketingProfileCompleteness {
  const missing: string[] = [];
  const strengths: string[] = [];
  let score = 0;
  const max = 7;

  if (norm(p.businessName)) {
    score += 1;
    strengths.push("Business name");
  } else missing.push("Business name");

  if (norm(p.industryLabel)) {
    score += 1;
    strengths.push("Industry");
  } else missing.push("Industry");

  if (norm(p.targetAudience)) {
    score += 1;
    strengths.push("Target audience");
  } else missing.push("Target audience");

  if (norm(p.coreOffer)) {
    score += 1;
    strengths.push("Core offer");
  } else missing.push("Core offer");

  if (norm(p.transformation)) {
    score += 1;
    strengths.push("Transformation / outcome");
  } else missing.push("Transformation / outcome");

  if (p.postingPlatforms.length) {
    score += 1;
    strengths.push("Posting platforms (intent)");
  } else missing.push("Posting platforms");

  if (norm(p.campaignNotesPreview)) {
    score += 1;
    strengths.push("Campaign notes (preview)");
  } else missing.push("Campaign notes (optional but helpful)");

  return { score, max, missing, strengths };
}
