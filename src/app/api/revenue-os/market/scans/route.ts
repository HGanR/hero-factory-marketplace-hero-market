import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { marketScans } from "@/lib/db/schema";
import type { NormalizedMarketScan } from "@/lib/revenue-os/market-scan-normalize";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
});

function previewFromPayload(payload: unknown): {
  competitorCount: number;
  demandGapCount: number;
  regulatoryCount: number;
  citationCount: number;
} {
  const p = payload as Partial<NormalizedMarketScan> | null;
  if (!p || typeof p !== "object") {
    return {
      competitorCount: 0,
      demandGapCount: 0,
      regulatoryCount: 0,
      citationCount: 0,
    };
  }
  return {
    competitorCount: Array.isArray(p.competitors) ? p.competitors.length : 0,
    demandGapCount: Array.isArray(p.demandGaps) ? p.demandGaps.length : 0,
    regulatoryCount: Array.isArray(p.regulatory) ? p.regulatory.length : 0,
    citationCount: Array.isArray(p.citations) ? p.citations.length : 0,
  };
}

/**
 * GET /api/revenue-os/market/scans?userId=&clientId=&limit=
 * Recent persisted scans for workspace (user + optional client).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/market/scans", req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";

    const rows = await db
      .select({
        id: marketScans.id,
        industry: marketScans.industry,
        geo: marketScans.geo,
        offerType: marketScans.offerType,
        payload: marketScans.payload,
        createdAt: marketScans.createdAt,
      })
      .from(marketScans)
      .where(
        and(eq(marketScans.userId, parsed.userId), eq(marketScans.clientId, clientId))
      )
      .orderBy(desc(marketScans.createdAt))
      .limit(parsed.limit);

    const scans = rows.map((r) => ({
      id: r.id,
      industry: r.industry,
      geo: r.geo,
      offerType: r.offerType,
      createdAt: r.createdAt,
      preview: previewFromPayload(r.payload),
    }));

    return NextResponse.json({ scans });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/market/scans]", e);
    return NextResponse.json({ error: "Failed to list scans" }, { status: 500 });
  }
}
