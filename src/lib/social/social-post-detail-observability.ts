/**
 * Server-only bundle for GET/PATCH `/api/social/posts/[id]` observability payloads.
 */

import type { campaignPosts } from "@/lib/db/schema";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { buildPublishingPlannerItems } from "@/lib/social/publishing-planner";
import {
  buildSocialPostActivityTimeline,
  buildSocialPostApprovalDetail,
  buildSocialPostPublishDetail,
  type CampaignAuditEventLite,
  type SocialActivityTimelineEntry,
  type SocialPostApprovalDetail,
  type SocialPostPublishDetail,
} from "@/lib/social/social-publish-observability";

export type SocialPostDetailObservability = {
  plannerItem: ReturnType<typeof buildPublishingPlannerItems>[number];
  approvalDetail: SocialPostApprovalDetail;
  publishDetail: SocialPostPublishDetail;
  activityTimeline: SocialActivityTimelineEntry[];
};

export function buildSocialPostDetailObservability(args: {
  post: typeof campaignPosts.$inferSelect;
  socialAccountDisplayById: Record<string, string>;
  auditRows: CampaignAuditEventLite[];
  linkedAssetCreativeType?: string | null;
}): SocialPostDetailObservability {
  const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();
  const aid = args.post.assetId?.trim() || null;
  const creativeTypeByAssetId = aid ? { [aid]: args.linkedAssetCreativeType ?? null } : undefined;
  const plannerItem = buildPublishingPlannerItems({
    rows: [args.post],
    socialAccountDisplayById: args.socialAccountDisplayById,
    creativeTypeByAssetId,
  })[0];
  const approvalDetail = buildSocialPostApprovalDetail({
    post: args.post,
    workerRequiresApproval,
  });
  const publishDetail = buildSocialPostPublishDetail({
    post: args.post,
    workerRequiresApproval,
    linkedAssetCreativeType: args.linkedAssetCreativeType,
  });
  const activityTimeline = buildSocialPostActivityTimeline({
    post: args.post,
    auditRows: args.auditRows,
  });
  return { plannerItem, approvalDetail, publishDetail, activityTimeline };
}
