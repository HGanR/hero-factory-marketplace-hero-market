import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { scheduleContent360CampaignPost } from "@/lib/revenue-os/content360-schedule-server";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { gateContent360Scheduling } from "@/lib/social/providers/content360/content360-env";

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
    campaignId: z.string().min(1).max(36),
    campaignPostId: z.string().min(1).max(36),
    connectionId: z.string().min(1).max(36),
    scheduledAt: z.string().datetime(),
    timezone: z.string().min(1).max(64),
    targetPlatform: z.string().min(1).max(48),
    caption: z.string().max(20_000).optional().nullable(),
    hashtags: z.string().max(1000).optional().nullable(),
    assetId: z.string().min(1).max(36).optional().nullable(),
    providerPayloadJson: z.record(z.string(), z.unknown()).optional().nullable(),
    forceReschedule: z.boolean().optional(),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/schedule
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
  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
  }

  const out = await scheduleContent360CampaignPost(db, {
    userId,
    clientId: owned.clientId,
    campaignId: parsed.data.campaignId,
    campaignPostId: parsed.data.campaignPostId,
    connectionId: parsed.data.connectionId,
    scheduledAt,
    timezone: parsed.data.timezone.trim(),
    targetPlatform: parsed.data.targetPlatform.trim(),
    caption: parsed.data.caption,
    hashtags: parsed.data.hashtags,
    assetId: parsed.data.assetId,
    providerPayloadJson: parsed.data.providerPayloadJson ?? null,
    forceReschedule: parsed.data.forceReschedule === true,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    jobId: out.jobId,
    providerResponseJson: out.providerResponseJson,
    deduplicated: out.deduplicated === true,
  });
}
