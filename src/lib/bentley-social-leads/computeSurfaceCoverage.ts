/**
 * Deterministic extraction coverage scores (0–1) for public surface + optional website.
 */

import type { AccessStatus } from "./types";
import type { ProfileSurface } from "./types";
import type { PublicCommentMeta, PublicPostMeta } from "./types";
import type { CoverageBreakdown, WebsiteSurface } from "./types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeSurfaceCoverage(args: {
  accessStatus: AccessStatus;
  profileSurface: ProfileSurface;
  postSurface: PublicPostMeta[];
  commentSurface: PublicCommentMeta[];
  linkedWebsiteSurface: WebsiteSurface | null;
  hadWebsiteUrlAttempt: boolean;
}): { coverageScore: number; coverageBreakdown: CoverageBreakdown } {
  const notes: string[] = [];

  let profileCoverageScore = 0;
  if (args.accessStatus === "public") {
    profileCoverageScore += 0.35;
    notes.push("Profile: public HTML reachable.");
  } else if (args.accessStatus === "access_limited") {
    profileCoverageScore += 0.18;
    notes.push("Profile: partial / limited surface.");
  } else {
    notes.push(`Profile: ${args.accessStatus} — low profile coverage.`);
  }

  if (args.profileSurface.handle && args.profileSurface.handle.length > 0) profileCoverageScore += 0.12;
  if (args.profileSurface.bio && args.profileSurface.bio.length > 20) profileCoverageScore += 0.18;
  else if (args.profileSurface.bio && args.profileSurface.bio.length > 0) profileCoverageScore += 0.08;
  if (args.profileSurface.displayName && args.profileSurface.displayName.length > 2) profileCoverageScore += 0.08;
  if (args.profileSurface.followerCount != null || args.profileSurface.followingCount != null) {
    profileCoverageScore += 0.12;
  }
  if (args.profileSurface.linkInBio) profileCoverageScore += 0.08;
  profileCoverageScore = clamp01(profileCoverageScore);

  let postCoverageScore = 0;
  const nPosts = args.postSurface.length;
  if (nPosts === 0) {
    notes.push("Posts: no caption chunks extracted.");
  } else {
    postCoverageScore += clamp01(0.25 + Math.min(0.55, nPosts * 0.12));
    const avgLen =
      args.postSurface.reduce((s, p) => s + (p.captionSnippet?.length ?? 0), 0) / Math.max(1, nPosts);
    if (avgLen > 80) postCoverageScore += 0.15;
    else if (avgLen > 40) postCoverageScore += 0.08;
    notes.push(`Posts: ${nPosts} surface chunk(s), avg caption length ~${Math.round(avgLen)}.`);
  }
  postCoverageScore = clamp01(postCoverageScore);

  let commentCoverageScore = 0;
  const nComments = args.commentSurface.length;
  if (nComments === 0) {
    notes.push("Comments: none visible in HTML.");
  } else {
    commentCoverageScore = clamp01(0.2 + Math.min(0.65, nComments * 0.06));
    notes.push(`Comments: ${nComments} snippet(s) from visible text.`);
  }

  let websiteCoverageScore = 0;
  if (!args.hadWebsiteUrlAttempt) {
    notes.push("Website: no URL from lead/bio — website coverage not scored.");
  } else if (!args.linkedWebsiteSurface?.ok) {
    notes.push("Website: URL present but fetch failed or empty.");
    websiteCoverageScore = 0.12;
  } else {
    const s = args.linkedWebsiteSurface;
    websiteCoverageScore += 0.2;
    if (s.title && s.title.length > 3) websiteCoverageScore += 0.15;
    if (s.description && s.description.length > 15) websiteCoverageScore += 0.1;
    if (s.clearCtaPresent) websiteCoverageScore += 0.15;
    if (s.bookingPathPresent) websiteCoverageScore += 0.15;
    if (s.leadCapturePresent) websiteCoverageScore += 0.1;
    if (s.reviewSignalPresent) websiteCoverageScore += 0.08;
    if (s.contactMethodSummary && s.contactMethodSummary.length > 8) websiteCoverageScore += 0.07;
    websiteCoverageScore = clamp01(websiteCoverageScore);
    notes.push("Website: fetched OK — scoring visible conversion signals.");
  }

  const wProfile = 0.28;
  const wPost = 0.22;
  const wComment = 0.15;
  const wWeb = args.hadWebsiteUrlAttempt ? 0.35 : 0.35;
  const overallCoverageScore = clamp01(
    profileCoverageScore * wProfile +
      postCoverageScore * wPost +
      commentCoverageScore * wComment +
      websiteCoverageScore * wWeb
  );

  const coverageBreakdown: CoverageBreakdown = {
    profileCoverageScore,
    postCoverageScore,
    commentCoverageScore,
    websiteCoverageScore,
    overallCoverageScore,
    notes,
  };

  return { coverageScore: overallCoverageScore, coverageBreakdown };
}
