/**
 * Phase 4J — Heuristic posting volume + platform focus from conversion + activity signals.
 */

export type VolumeRecommendationInput = {
  bookedRate: number;
  closeRate: number;
  trackedLeadCount: number;
  postedDeploymentsLast30d: number;
  /** Optional: primary short-form platform to bias (e.g. from experiments). */
  winningPlatformHint?: string | null;
};

export type VolumeRecommendationResult = {
  postsPerWeekSuggested: { min: number; max: number };
  platformFocus: string[];
  rationale: string[];
  /** Ties back to optimization / conversion loops for UI copy */
  feedbackNotes: string[];
};

export function buildVolumeRecommendations(input: VolumeRecommendationInput): VolumeRecommendationResult {
  const { bookedRate, closeRate, trackedLeadCount, postedDeploymentsLast30d, winningPlatformHint } = input;
  const rationale: string[] = [];
  const feedbackNotes: string[] = [];
  const platformFocus: string[] = [];

  const funnel = Math.max(bookedRate, closeRate);
  let min = 1;
  let max = 3;

  if (trackedLeadCount >= 20 && funnel >= 0.08) {
    min = 4;
    max = 7;
    rationale.push("Strong funnel signals — increase surface area with 4–7 posts/week while monitoring lead quality.");
    feedbackNotes.push("High performer: route outcomes back into variant optimization (Phase 4I) monthly.");
  } else if (trackedLeadCount >= 8 && funnel >= 0.04) {
    min = 3;
    max = 5;
    rationale.push("Healthy conversion — sustain 3–5 posts/week and keep A/B variant discipline.");
    feedbackNotes.push("Compare experiment groups weekly; shift budget to winning hooks.");
  } else if (trackedLeadCount < 5) {
    min = 1;
    max = 2;
    rationale.push("Low sample — prioritize learning: 1–2 quality posts/week until attribution firms up.");
    feedbackNotes.push("Link every deployment to a generation variant for closed-loop analytics.");
  } else {
    min = 2;
    max = 4;
    rationale.push("Mixed signals — test 2–4 posts/week; tighten CTA and hook diversity before scaling.");
    feedbackNotes.push("Use batch variations from a winning snapshot to iterate without losing the core pattern.");
  }

  if (postedDeploymentsLast30d >= max * 5) {
    rationale.push("You are already posting frequently — watch for fatigue; rotate hooks and offers.");
  }

  if (winningPlatformHint && /tiktok/i.test(winningPlatformHint)) {
    platformFocus.push("TikTok-first for discovery; repurpose to Reels/Shorts with the short-form pack.");
  } else if (winningPlatformHint && /instagram|reel/i.test(winningPlatformHint)) {
    platformFocus.push("Instagram Reels for warm audiences; use Saves + DMs as success metrics.");
  } else if (winningPlatformHint && /youtube|short/i.test(winningPlatformHint)) {
    platformFocus.push("YouTube Shorts for search-intent remixes; pin a comment CTA.");
  } else {
    platformFocus.push("TikTok / Reels / Shorts triangle — same core pattern, three native CTAs.");
  }

  platformFocus.push("Keep generationVariantId on deployments so conversion analytics tie to creative.");

  return {
    postsPerWeekSuggested: { min, max },
    platformFocus,
    rationale,
    feedbackNotes,
  };
}
