import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, providerPublishJobs } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { toPublicProviderPublishJob } from "@/lib/revenue-os/content360-public";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { mergeRawScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/jobs/:id/retry
 * Re-queues a failed Content360 job and restores the campaign post to a schedulable state when safe.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await ctx.params;
  if (!jobId) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" }, { status: 400 });
  }

  const owned = await requireOwnedClientId(userId, parsed.data.clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();

  const rows = await db
    .select()
    .from(providerPublishJobs)
    .where(
      and(
        eq(providerPublishJobs.id, jobId),
        eq(providerPublishJobs.clientId, owned.clientId),
        eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID)
      )
    )
    .limit(1);
  const job = rows[0];
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const access = await getCampaignReviewerAccess(db, userId, job.campaignId);
  if (!access) {
    return NextResponse.json({ error: "Campaign access denied" }, { status: 403 });
  }

  const postRows = await db
    .select()
    .from(campaignPosts)
    .where(and(eq(campaignPosts.id, job.campaignPostId), eq(campaignPosts.campaignId, job.campaignId)))
    .limit(1);
  const post = postRows[0];

  await db.transaction(async (tx: any) => {
    await tx
      .update(providerPublishJobs)
      .set({
        status: "queued",
        errorMessage: null,
        lastAttemptAt: null,
        attempts: sql`${providerPublishJobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(providerPublishJobs.id, jobId));

    if (post && parseScheduledPublishMeta(post.scheduledPublishMeta).publishRoute === "content360") {
      const nextMeta = mergeRawScheduledPublishMeta(post.scheduledPublishMeta, {
        providerStatus: "manual_retry_queued",
        lastPublishError: undefined,
        lastPublishErrorCode: undefined,
        nextPublishAttemptAt: undefined,
      });
      await tx
        .update(campaignPosts)
        .set({
          status: "SCHEDULED",
          scheduledAt: job.scheduledAt,
          errorMessage: null,
          scheduledPublishMeta: nextMeta as never,
          updatedAt: new Date(),
        })
        .where(eq(campaignPosts.id, post.id));
    }
  });

  const fresh = await db.select().from(providerPublishJobs).where(eq(providerPublishJobs.id, jobId)).limit(1);
  return NextResponse.json({
    job: fresh[0] ? toPublicProviderPublishJob(fresh[0]) : null,
  });
}
