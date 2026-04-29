/**
 * Standardized public-surface shape: profile / posts / comments / website + coverage.
 * All platform fetchers produce legacy PublicSocialSurface fields; pipeline applies coverage + website.
 */

import { computeSurfaceCoverage } from "./computeSurfaceCoverage";
import type { ProfileSurface, PublicSocialSurface, WebsiteSurface } from "./types";

export function extractProfileSurface(social: PublicSocialSurface): ProfileSurface {
  if (social.profileSurface) return social.profileSurface;
  return {
    handle: social.handle,
    displayName: social.displayName,
    bio: social.bio,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    linkInBio: social.linkInBio,
    profileUrlResolved: social.profileUrlResolved,
  };
}

export function getPostSurfaces(social: PublicSocialSurface) {
  return social.postSurface ?? social.posts;
}

export function getCommentSurfaces(social: PublicSocialSurface) {
  return social.commentSurface ?? social.comments;
}

/**
 * Attach normalized slices + linked website + coverage scores (deterministic).
 */
export function applySurfaceCoverage(
  social: PublicSocialSurface,
  linkedWebsiteSurface: WebsiteSurface | null,
  hadWebsiteUrlAttempt: boolean
): PublicSocialSurface {
  const profileSurface = extractProfileSurface(social);
  const postSurface = getPostSurfaces(social);
  const commentSurface = getCommentSurfaces(social);
  const { coverageScore, coverageBreakdown } = computeSurfaceCoverage({
    accessStatus: social.accessStatus,
    profileSurface,
    postSurface,
    commentSurface,
    linkedWebsiteSurface,
    hadWebsiteUrlAttempt,
  });

  return {
    ...social,
    posts: postSurface,
    comments: commentSurface,
    profileSurface,
    postSurface,
    commentSurface,
    linkedWebsiteSurface,
    coverageScore,
    coverageBreakdown,
  };
}
