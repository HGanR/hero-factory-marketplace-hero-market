/**
 * Batch runner: metric sync for published posts → deployment feedback (performance_metrics rows).
 */

import { eq, and, desc, isNotNull, ne } from "drizzle-orm";
import { campaignPosts, campaigns } from "@/lib/db/schema";
import { syncPlatformPostPerformanceForPost } from "@/lib/social/sync-platform-post-performance";
import { attachPerformanceFeedbackToCampaignPost } from "@/lib/revenue-os/deployment-feedback-db";

export type RunPlatformPerformanceSyncSummary = {
  scanned: number;
  synced: number;
  unsupported: number;
  failed: number;
  skipped: number;
};

/**
 * Load recent POSTED posts (optional user filter), sync metrics, persist performance feedback rows.
 */
export async function runPlatformPerformanceSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts?: { limit?: number; userId?: string }
): Promise<RunPlatformPerformanceSyncSummary> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 200);
  const uid = opts?.userId?.trim();

  const conds = [
    eq(campaignPosts.status, "POSTED"),
    isNotNull(campaignPosts.platformPostId),
    ne(campaignPosts.platformPostId, ""),
  ];
  if (uid) conds.push(eq(campaigns.userId, uid));

  const rows = await db
    .select({ postId: campaignPosts.id })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(and(...conds))
    .orderBy(desc(campaignPosts.postedAt))
    .limit(limit);

  const summary: RunPlatformPerformanceSyncSummary = {
    scanned: rows.length,
    synced: 0,
    unsupported: 0,
    failed: 0,
    skipped: 0,
  };

  for (const r of rows) {
    try {
      const res = await syncPlatformPostPerformanceForPost(db, r.postId);
      if (res.status === "synced") {
        await attachPerformanceFeedbackToCampaignPost(db, res.userId, res.normalized);
        summary.synced += 1;
      } else if (res.status === "unsupported") summary.unsupported += 1;
      else if (res.status === "failed") summary.failed += 1;
      else summary.skipped += 1;
    } catch (e) {
      summary.failed += 1;
      console.error("[runPlatformPerformanceSync] post", r.postId, e);
    }
  }

  return summary;
}
