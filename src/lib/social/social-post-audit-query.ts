/**
 * DB access for Revenue OS social post activity timelines (`campaign_audit_events`).
 * Single place for action allow-lists, limits, and ordering — keeps routes thin.
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { campaignAuditEvents } from "@/lib/db/schema";
import { PUBLISH_APPROVAL_AUDIT_ACTIONS } from "@/lib/revenue-os/publish-approval-audit";
import { SOCIAL_POST_EDIT_AUDIT_ACTIONS } from "@/lib/social/social-post-patch-audit";

/** Canonical allow-list: publish-approval lifecycle, social PATCH edits, worker + manual publish. */
export const SOCIAL_POST_TIMELINE_AUDIT_ACTIONS: readonly string[] = [
  ...PUBLISH_APPROVAL_AUDIT_ACTIONS,
  ...SOCIAL_POST_EDIT_AUDIT_ACTIONS,
  "scheduled_publish_attempted",
  "scheduled_publish_succeeded",
  "scheduled_publish_failed",
  "scheduled_publish_retry_scheduled",
  "publish",
  "fail",
  "governed_post_analytics_refresh_failed",
  "external_review_link_minted",
  "external_review_link_revoked",
  "external_review_link_email_sent",
  "external_review_links_bulk_revoked",
];

/** Default row cap per timeline fetch (newest-first slice). */
export const DEFAULT_SOCIAL_POST_TIMELINE_LIMIT = 100;

/** Hard upper bound for `limit` (caller-supplied or default). */
export const MAX_SOCIAL_POST_TIMELINE_LIMIT = 100;

export type SocialPostTimelineAuditRow = {
  id: string;
  action: string;
  platform: string | null;
  details: unknown;
  createdAt: Date | string;
};

export type SocialPostTimelineDb = Awaited<ReturnType<typeof getDb>>;

export function clampSocialPostTimelineLimit(limit?: number): number {
  const n = limit ?? DEFAULT_SOCIAL_POST_TIMELINE_LIMIT;
  const floor = Math.max(1, Math.floor(Number(n)));
  return Math.min(floor, MAX_SOCIAL_POST_TIMELINE_LIMIT);
}

export function isSocialPostTimelineAuditAction(action: string): boolean {
  return SOCIAL_POST_TIMELINE_AUDIT_ACTIONS.includes(action);
}

/**
 * Fetch audit rows for the social post detail timeline.
 * - Filter: `post_id` + allowed actions only.
 * - Order: `created_at` DESC (newest first) — matches `SOCIAL_ACTIVITY_TIMELINE_ORDER` in observability.
 * - Columns: id, action, platform, details, created_at (narrow projection).
 */
export async function listSocialPostTimelineAuditRows(
  db: SocialPostTimelineDb,
  args: { postId: string; limit?: number }
): Promise<SocialPostTimelineAuditRow[]> {
  const lim = clampSocialPostTimelineLimit(args.limit);
  return db
    .select({
      id: campaignAuditEvents.id,
      action: campaignAuditEvents.action,
      platform: campaignAuditEvents.platform,
      details: campaignAuditEvents.details,
      createdAt: campaignAuditEvents.createdAt,
    })
    .from(campaignAuditEvents)
    .where(
      and(eq(campaignAuditEvents.postId, args.postId), inArray(campaignAuditEvents.action, [...SOCIAL_POST_TIMELINE_AUDIT_ACTIONS]))
    )
    .orderBy(desc(campaignAuditEvents.createdAt))
    .limit(lim);
}
