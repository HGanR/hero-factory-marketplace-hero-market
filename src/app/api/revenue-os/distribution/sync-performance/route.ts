import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { syncPublishedQueuePerformance } from "@/lib/revenue-os/post-publication-sync";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const MetricsSchema = z.object({
  views: z.number().int().min(0).optional().nullable(),
  clicks: z.number().int().min(0).optional().nullable(),
  comments: z.number().int().min(0).optional().nullable(),
  saves: z.number().int().min(0).optional().nullable(),
  shares: z.number().int().min(0).optional().nullable(),
  conversions: z.number().int().min(0).optional().nullable(),
  leads: z.number().int().min(0).optional().nullable(),
  impressions: z.number().int().min(0).optional().nullable(),
  negativeSentimentRatio: z.number().min(0).max(1).optional().nullable(),
  qualitativeNotes: z.string().max(8000).optional().nullable(),
});

const BodySchema = z
  .object({
    clientId: z.string().max(36).optional().default(""),
    trustId: z.string().max(36).optional().default(""),
    queueId: z.string().max(36).optional(),
    externalPostRef: z.string().max(512).optional(),
    metrics: MetricsSchema,
    measuredAt: z.union([z.string(), z.coerce.date()]).optional().nullable(),
  })
  .refine((b) => Boolean(b.queueId?.trim()) || Boolean(b.externalPostRef?.trim()), {
    message: "queueId or externalPostRef required",
  });

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/distribution/sync-performance", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const measuredAt =
      parsed.measuredAt != null
        ? typeof parsed.measuredAt === "string"
          ? new Date(parsed.measuredAt)
          : parsed.measuredAt
        : undefined;
    const r = await syncPublishedQueuePerformance({
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      queueId: parsed.queueId?.trim(),
      externalPostRef: parsed.externalPostRef?.trim(),
      metrics: parsed.metrics,
      measuredAt: measuredAt && !Number.isNaN(measuredAt.getTime()) ? measuredAt : undefined,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, reason: r.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, queueId: r.queueId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
