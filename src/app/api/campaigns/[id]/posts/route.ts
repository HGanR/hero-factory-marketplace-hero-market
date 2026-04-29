import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaigns, campaignPosts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { ZOD_OAUTH_POSTING_PLATFORM_ENUM } from "@/lib/social/platform-identity";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const CreatePostSchema = z.object({
  platform: z.enum(ZOD_OAUTH_POSTING_PLATFORM_ENUM),
  caption: z.string(),
  hashtags: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  utmParams: z.record(z.string(), z.string()).optional(),
  assetId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  /** Merged into `utmParams` for Bentley idempotency / provenance (optional, additive). */
  bentleyDraftKey: z.string().min(1).max(240).optional(),
  bentleySource: z.enum(["campaign_from_notes", "content_engine", "launch_mode"]).optional(),
  /** Merged into utmParams as bentley_content_role (content-batch routing; optional). */
  bentleyContentRole: z
    .enum(["attention", "engagement", "authority", "lead_capture", "distribution_support"])
    .optional(),
  /** Comma-separated platform hints — merged as bentley_platform_hints */
  bentleyPlatformHints: z.string().max(400).optional(),
  /** Optional calendar sequence hints (merged into utmParams). */
  bentleySequenceDayIndex: z.number().int().min(1).max(365).optional(),
  bentleySequenceRole: z
    .enum(["attention", "engagement", "authority", "lead_capture", "distribution_support"])
    .optional(),
  bentleySequenceReason: z.string().max(500).optional(),
  /** Suggested schedule from sequence planner (UTM only; optional). */
  bentleySuggestedScheduleAt: z.string().datetime().optional(),
  bentleyScheduleRole: z
    .enum(["attention", "engagement", "authority", "lead_capture", "distribution_support"])
    .optional(),
  bentleyScheduleConfidence: z.enum(["high", "medium", "low"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });
    }

    const db = await getDb();
    const campRows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, campaignId),
          eq(campaigns.userId, String(userId))
        )
      )
      .limit(1);

    if (campRows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreatePostSchema.parse(body);

    const postId = crypto.randomUUID();
    const scheduledAt = parsed.scheduledAt ? new Date(parsed.scheduledAt) : null;

    const utmMerged: Record<string, string> = { ...(parsed.utmParams ?? {}) };
    if (parsed.bentleyDraftKey) utmMerged.bentley_draft_key = parsed.bentleyDraftKey;
    if (parsed.bentleySource) utmMerged.bentley_source = parsed.bentleySource;
    if (parsed.bentleyContentRole) utmMerged.bentley_content_role = parsed.bentleyContentRole;
    if (parsed.bentleyPlatformHints?.trim()) utmMerged.bentley_platform_hints = parsed.bentleyPlatformHints.trim();
    if (parsed.bentleySequenceDayIndex != null) {
      utmMerged.bentley_sequence_day_index = String(parsed.bentleySequenceDayIndex);
    }
    if (parsed.bentleySequenceRole) utmMerged.bentley_sequence_role = parsed.bentleySequenceRole;
    if (parsed.bentleySequenceReason?.trim()) {
      utmMerged.bentley_sequence_reason = parsed.bentleySequenceReason.trim().slice(0, 500);
    }
    if (parsed.bentleySuggestedScheduleAt?.trim()) {
      utmMerged.bentley_suggested_schedule_at = parsed.bentleySuggestedScheduleAt.trim();
    }
    if (parsed.bentleyScheduleRole) utmMerged.bentley_schedule_role = parsed.bentleyScheduleRole;
    if (parsed.bentleyScheduleConfidence) {
      utmMerged.bentley_schedule_confidence = parsed.bentleyScheduleConfidence;
    }
    const utmParams = Object.keys(utmMerged).length ? utmMerged : parsed.utmParams ?? null;

    const scheduledPublishMeta = scheduledAt
      ? { scheduledPublishSource: "manual_schedule" as const }
      : null;

    await db.insert(campaignPosts).values({
      id: postId,
      campaignId,
      assetId: parsed.assetId?.trim() || null,
      platform: parsed.platform,
      scheduledAt,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      caption: parsed.caption,
      hashtags: parsed.hashtags?.trim() || null,
      linkUrl: parsed.linkUrl?.trim() || null,
      utmParams,
      scheduledPublishMeta,
    });

    return NextResponse.json({
      id: postId,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid post payload", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[campaigns/[id]/posts]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
