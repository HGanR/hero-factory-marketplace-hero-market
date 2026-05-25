import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { scheduleContent360Batch } from "@/lib/revenue-os/content360-schedule-batch-server";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { gateContent360Scheduling } from "@/lib/social/providers/content360/content360-env";

const PostItemSchema = z
  .object({
    campaignPostId: z.string().min(1).max(36),
    assetId: z.string().min(1).max(36).optional().nullable(),
    targetPlatform: z.string().min(1).max(48),
    scheduledAt: z.string().datetime(),
    caption: z.string().max(20_000).optional().nullable(),
    hashtags: z.string().max(1000).optional().nullable(),
  })
  .strict();

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
    campaignId: z.string().min(1).max(36),
    connectionId: z.string().min(1).max(36),
    timezone: z.string().min(1).max(64),
    posts: z.array(PostItemSchema).min(1).max(200),
    forceReschedule: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/schedule-batch
 */
export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" }, { status: 400 });
  }

  const owned = await requireOwnedClientId(userId, parsed.data.clientId);
  if (!owned.ok) return owned.response;

  const schedGate = gateContent360Scheduling();
  if (!schedGate.ok) {
    return NextResponse.json({ error: schedGate.error, code: schedGate.code }, { status: schedGate.status });
  }

  await ensureClientHubTables();
  const db = await getDb();

  const out = await scheduleContent360Batch(db, {
    userId,
    clientId: owned.clientId,
    campaignId: parsed.data.campaignId,
    connectionId: parsed.data.connectionId,
    timezone: parsed.data.timezone.trim(),
    posts: parsed.data.posts,
    forceReschedule: parsed.data.forceReschedule === true,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    batchId: out.batchId,
    totalPosts: out.totalPosts,
    scheduledCount: out.scheduledCount,
    failedCount: out.failedCount,
    skippedDuplicates: out.skippedDuplicates,
    batchStatus: out.batchStatus,
    usedBatchEndpoint: out.usedBatchEndpoint,
    providerBatchId: out.providerBatchId,
    results: out.results,
  });
}
