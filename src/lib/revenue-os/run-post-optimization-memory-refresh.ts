/**
 * Rebuild post optimization memory from recent deployment feedback (bounded).
 */

import { and, eq, inArray } from "drizzle-orm";
import { campaignPosts, campaigns } from "@/lib/db/schema";
import type { PostOptimizationMemoryRefreshApiResponse } from "@/lib/revenue-os/optimization-memory-client-fetch";
import {
  buildOptimizationMemoryFromFeedback,
  type CampaignPostLite,
} from "@/lib/revenue-os/build-post-optimization-memory";
import { listDeploymentFeedbackForUser } from "@/lib/revenue-os/deployment-feedback-db";
import { saveOptimizationMemoryEntriesForUser } from "@/lib/revenue-os/post-optimization-memory-db";

export type RunPostOptimizationMemoryRefreshParams = {
  userId: string;
  clientId?: string;
  feedbackLimit: number;
};

export type PostOptimizationMemoryRefreshSummary = Omit<PostOptimizationMemoryRefreshApiResponse, "ok">;

function normalizeUtm(raw: Record<string, unknown> | null | undefined): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return Object.keys(out).length ? out : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runPostOptimizationMemoryRefreshForUser(
  db: any,
  params: RunPostOptimizationMemoryRefreshParams
): Promise<PostOptimizationMemoryRefreshSummary> {
  const userId = String(params.userId);
  const clientId = params.clientId?.trim() || undefined;
  const limit = Math.min(Math.max(params.feedbackLimit ?? 120, 1), 200);

  const feedbackRows = await listDeploymentFeedbackForUser(db, userId, { clientId, limit });
  const postIds = [...new Set(feedbackRows.map((r) => r.campaignPostId).filter(Boolean))];

  const postsById: Record<string, CampaignPostLite> = {};
  if (postIds.length > 0) {
    const rows = await db
      .select({
        id: campaignPosts.id,
        campaignId: campaignPosts.campaignId,
        platform: campaignPosts.platform,
        caption: campaignPosts.caption,
        linkUrl: campaignPosts.linkUrl,
        utmParams: campaignPosts.utmParams,
      })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
      .where(and(eq(campaigns.userId, userId), inArray(campaignPosts.id, postIds)));

    for (const r of rows as Array<{
      id: string;
      campaignId: string;
      platform: string;
      caption: string | null;
      linkUrl: string | null;
      utmParams: Record<string, unknown> | null;
    }>) {
      postsById[r.id] = {
        id: r.id,
        campaignId: r.campaignId,
        platform: r.platform,
        caption: r.caption ?? null,
        linkUrl: r.linkUrl ?? null,
        utmParams: normalizeUtm(r.utmParams),
      };
    }
  }

  const entries = buildOptimizationMemoryFromFeedback({
    userId,
    feedbackRows,
    postsById,
  });

  const cid = clientId ?? "";
  await saveOptimizationMemoryEntriesForUser(db, userId, entries, cid);

  const strongPatternsFound = entries.filter((e) => e.outcomeKind === "positive" || e.outcomeKind === "mixed").length;
  const weakPatternsFound = entries.filter((e) => e.outcomeKind === "negative").length;
  const insufficientDataCount = entries.filter((e) => e.outcomeKind === "insufficient_data").length;

  return {
    scannedPosts: postIds.length,
    memoryEntriesWritten: entries.length,
    strongPatternsFound,
    weakPatternsFound,
    insufficientDataCount,
  };
}
