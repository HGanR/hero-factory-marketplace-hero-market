import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { syncBentleyCampaignPostsAndSchedule } from "@/lib/revenue-os/bentley-sync-launch-server";
import type { ScheduleStrategy } from "@/lib/revenue-os/bentley-sync-launch-plan";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { z } from "zod";

const BodySchema = z.object({
  campaignId: z.string().uuid(),
  scheduleStrategy: z.enum(["immediate", "staggered"]).default("immediate"),
  staggerMinutes: z.number().int().min(1).max(1440).optional(),
});

/**
 * POST /api/revenue-os/bentley/sync-launch
 * Idempotent: creates missing campaign_posts from `bentley_generation_json`, applies schedule + approval UTM.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.parse(body);
    const db = await getDb();

    const result = await syncBentleyCampaignPostsAndSchedule(db, {
      userId: String(userId),
      campaignId: parsed.campaignId,
      scheduleStrategy: parsed.scheduleStrategy as ScheduleStrategy,
      staggerMinutes: parsed.staggerMinutes,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid payload", issues: e.flatten() },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[revenue-os/bentley/sync-launch]", msg);
    return NextResponse.json({ error: "SYNC_FAILED", message: msg }, { status: 500 });
  }
}
