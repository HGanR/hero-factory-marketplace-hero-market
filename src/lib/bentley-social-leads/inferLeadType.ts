/**
 * Deterministic lead-type inference from public text (no media analysis).
 */

import type { InferredLeadType } from "./types";
import type { NormalizedLead } from "./types";
import type { PublicSocialSurface } from "./types";
import type { WebsiteSurface } from "./types";

export function inferLeadType(args: {
  lead: NormalizedLead;
  social: PublicSocialSurface;
  website: WebsiteSurface | null;
}): InferredLeadType {
  const blob = [
    args.lead.businessName,
    args.lead.notes ?? "",
    args.social.bio ?? "",
    args.social.displayName ?? "",
    args.website?.title ?? "",
    args.website?.description ?? "",
    ...args.social.posts.map((p) => p.captionSnippet),
    ...args.social.comments.map((c) => c.text).slice(0, 15),
  ]
    .join(" \n ")
    .toLowerCase();

  if (/\b(agency|agencies|marketing agency|creative agency|performance marketing|ppc|seo agency)\b/i.test(blob)) {
    return "agency";
  }
  if (/\b(youtube|tiktok|creator|influencer|subscribe|content creator|podcast)\b/i.test(blob)) {
    return "creator_brand";
  }
  if (/\b(clinic|medical|physician|patient|treatment|urgent care|dental office|hospital)\b/i.test(blob)) {
    return "clinic";
  }
  if (/\b(store|shop|boutique|retail|open daily|walk-?ins|inventory|sku)\b/i.test(blob)) {
    return "storefront";
  }
  if (/\b(contractor|roofing|hvac|plumb|electric|construction|remodel)\b/i.test(blob)) {
    return "contractor";
  }
  if (/\b(solo|just me|i am the owner|one person|independent|freelance)\b/i.test(blob)) {
    return "solo_operator";
  }
  if (/\b(local|near you|service area|we come to you|mobile|neighborhood)\b/i.test(blob)) {
    return "local_service_business";
  }

  return "local_service_business";
}
