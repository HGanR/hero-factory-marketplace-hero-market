import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaigns, campaignPosts, socialAccounts } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { buildApprovalWorkerAnalytics } from "@/lib/revenue-os/build-approval-worker-analytics";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import type { RevenueOsLastWorkerRunSnapshot } from "@/lib/revenue-os/approval-worker-analytics-types";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function utmParamsAsRecord(u: unknown): Record<string, string> | null {
  if (!u || typeof u !== "object" || Array.isArray(u)) return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

/**
 * GET /api/campaigns/scheduled-queue?clientId=
 * Compact publish queue summary for dashboard + Bentley (user-scoped).
 * Optional: approvalSession=1 (matches session UI), workerLastRun= URL-encoded JSON snapshot,
 * recentPostedHours=1..168 (default 48).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = new URL(req.url).searchParams;
    const clientId = sp.get("clientId")?.trim() ?? "";
    const approvalSession = sp.get("approvalSession") === "1";
    const workerRequiresApproval = readScheduledPublishRequireApprovalEnv() || approvalSession;
    const recentH = Math.min(168, Math.max(1, parseInt(sp.get("recentPostedHours") ?? "48", 10) || 48));

    let lastWorkerRun: RevenueOsLastWorkerRunSnapshot | null = null;
    const wrRaw = sp.get("workerLastRun");
    if (wrRaw) {
      try {
        lastWorkerRun = JSON.parse(decodeURIComponent(wrRaw)) as RevenueOsLastWorkerRunSnapshot;
      } catch {
        /* ignore malformed */
      }
    }

    const db = await getDb();
    const campRows = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));

    const ids = campRows.map((c) => c.id);

    const accRows = await db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(and(eq(socialAccounts.userId, String(userId)), eq(socialAccounts.clientId, clientId)));

    const socialAccountsPayload = accRows.map((a) => ({
      platform: a.platform,
      platformCanonical: null as null,
    }));

    const posts =
      ids.length > 0
        ? await db.select().from(campaignPosts).where(inArray(campaignPosts.campaignId, ids))
        : [];

    let scheduledCount = 0;
    let retryScheduledCount = 0;
    let publishingCount = 0;
    let failedCount = 0;
    let postedCount = 0;
    const dueCandidates: { postId: string; platform: string; at: number }[] = [];
    const recentFailures: { postId: string; platform: string; message: string }[] = [];

    for (const p of posts) {
      const st = String(p.status).toUpperCase();
      if (st === "SCHEDULED") {
        scheduledCount += 1;
        const t = p.scheduledAt ? new Date(p.scheduledAt).getTime() : NaN;
        if (!Number.isNaN(t)) dueCandidates.push({ postId: p.id, platform: p.platform, at: t });
      } else if (st === "RETRY_SCHEDULED") {
        retryScheduledCount += 1;
        const meta = parseScheduledPublishMeta(p.scheduledPublishMeta);
        const t = meta.nextPublishAttemptAt ? new Date(meta.nextPublishAttemptAt).getTime() : NaN;
        if (!Number.isNaN(t)) dueCandidates.push({ postId: p.id, platform: p.platform, at: t });
      } else if (st === "PUBLISHING") publishingCount += 1;
      else if (st === "FAILED") {
        failedCount += 1;
        if (recentFailures.length < 8 && p.errorMessage) {
          recentFailures.push({
            postId: p.id,
            platform: p.platform,
            message: String(p.errorMessage).slice(0, 200),
          });
        }
      } else if (st === "POSTED") postedCount += 1;
    }

    dueCandidates.sort((a, b) => a.at - b.at);
    const next = dueCandidates[0] ?? null;

    const now = new Date();
    const analyticsPosts = posts.map((p) => ({
      id: p.id,
      platform: p.platform,
      status: p.status,
      scheduledAt: p.scheduledAt,
      scheduledPublishMeta: p.scheduledPublishMeta,
      utmParams: utmParamsAsRecord(p.utmParams),
      postedAt: p.postedAt,
      errorMessage: p.errorMessage,
    }));

    const aw = buildApprovalWorkerAnalytics({
      posts: analyticsPosts,
      now,
      workerRequiresApproval,
      socialAccounts: socialAccountsPayload,
      lastWorkerRun,
      recentlyPublishedWithinHours: recentH,
    });

    return NextResponse.json({
      scheduledCount,
      retryScheduledCount,
      publishingCount,
      failedCount,
      postedCount,
      nextDue: next
        ? {
            postId: next.postId,
            platform: next.platform,
            at: new Date(next.at).toISOString(),
          }
        : null,
      recentFailures,
      recentPublishedWindowHours: recentH,
      approvalWorker: {
        effectiveApprovalRequired: workerRequiresApproval,
        summary: aw.summary,
        insight: aw.insight,
        ...(lastWorkerRun ? { lastWorkerRun } : {}),
      },
    });
  } catch (e) {
    console.error("[campaigns/scheduled-queue]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
