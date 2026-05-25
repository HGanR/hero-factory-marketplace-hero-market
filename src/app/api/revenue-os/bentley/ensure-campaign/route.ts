import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { parseCampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { ensureCampaignFromBentley } from "@/lib/revenue-os/ensure-campaign-from-bentley";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { z } from "zod";

const BodySchema = z.object({
  bentleyRunId: z.string().min(4).max(128),
  clientId: z.string().max(36).optional().default(""),
  businessName: z.string().max(200).optional(),
  platforms: z.array(z.string()).optional().default([]),
  postingPlatforms: z.array(z.string()).optional(),
  tone: z.string().max(120).optional(),
  imageStyle: z.string().max(120).optional(),
  campaign: z.unknown(),
});

/**
 * POST /api/revenue-os/bentley/ensure-campaign
 * Idempotent: creates or updates `campaigns` row keyed by `bentleyRunId`.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;

  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = BodySchema.parse(json);
    const campaign = parseCampaignResponse(parsed.campaign);

    const db = await getDb();
    const result = await ensureCampaignFromBentley(db, {
      userId: String(userId),
      clientId: parsed.clientId.trim(),
      bentleyRunId: parsed.bentleyRunId.trim(),
      campaign,
      platforms: parsed.platforms ?? [],
      postingPlatforms: parsed.postingPlatforms,
      businessName: parsed.businessName,
      tone: parsed.tone,
      imageStyle: parsed.imageStyle,
    });

    return NextResponse.json({
      id: result.id,
      created: result.created,
      bentleyRunId: parsed.bentleyRunId.trim(),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid payload", issues: e.flatten() },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[revenue-os/bentley/ensure-campaign]", msg);
    return NextResponse.json({ error: "ENSURE_FAILED", message: msg }, { status: 500 });
  }
}
