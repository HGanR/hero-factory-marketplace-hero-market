import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runFeedbackIngestion } from "@/lib/revenue-os/feedback-ingestion";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().optional().default(""),
  trustId: z.string().optional().default(""),
  entries: z
    .array(
      z.object({
        source: z.string().optional(),
        campaignId: z.string().optional(),
        platform: z.string().optional(),
        sentiment: z.string().optional(),
        scoreDelta: z.number().optional(),
        notes: z.string().optional(),
        rawPayload: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(50),
});

/**
 * POST /api/revenue-os/market-intelligence/feedback
 * Ingests feedback rows for Bentley adaptive strategy (content_feedback_log).
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/market-intelligence/feedback", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.parse(body);
    const { inserted } = await runFeedbackIngestion({
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      entries: parsed.entries,
    });
    return NextResponse.json({ ok: true, inserted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
