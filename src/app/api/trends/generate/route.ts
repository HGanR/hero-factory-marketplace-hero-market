import { NextResponse } from "next/server";
import { z } from "zod";
import { TrendCardSchema } from "@/lib/trends/schema";
import { buildBundleFromTrends } from "@/lib/trends/promptBuilder";
import { getAuthedUserId } from "@/lib/api/auth";
import { resolveUnifiedGenerationContext } from "@/lib/revenue-os/resolveUnifiedGenerationContext";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  offerName: z.string().min(2),
  platform: z
    .enum(["tiktok", "youtube_shorts", "youtube_long"])
    .default("tiktok"),
  durationSec: z.number().int().min(10).max(900).default(30),
  voice: z
    .enum(["authoritative", "friendly", "aggressive"])
    .default("authoritative"),
  trends: z.array(TrendCardSchema).min(1),
  useBentleyIntelligence: z.boolean().optional(),
  bentleyHandoffId: z.string().min(8).max(64).optional(),
  bentleySliContentHandoff: z.any().optional(),
  skipConversionIntelligence: z.boolean().optional(),
});

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    const userId = await getAuthedUserId();
    const { context: unifiedCtx } = await resolveUnifiedGenerationContext({
      body: body as unknown as Record<string, unknown>,
      userId,
      userNotes: "",
      skipConversion: body.skipConversionIntelligence === true,
    });

    const bundle = buildBundleFromTrends({
      trends: body.trends,
      offerName: body.offerName,
      platform: body.platform,
      durationSec: body.durationSec,
      voice: body.voice,
      bentleyMarketIntelligence: unifiedCtx.bentleyMarketIntelligence,
      conversionIntelligence: unifiedCtx.conversionIntelligence,
    });

    return NextResponse.json(bundle);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const msg = err.issues[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json(
      { error: "GENERATION_FAILED", message },
      { status: 500 }
    );
  }
}
