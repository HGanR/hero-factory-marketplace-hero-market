import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { marketScans } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
});

/**
 * GET /api/revenue-os/market/scans/:id?userId=&clientId=
 * Full persisted scan payload for a workspace.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/market/scans/[id]", req);
    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing scan id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
    });
    const clientId = parsed.clientId?.trim() ?? "";

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();

    const [row] = await db
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
        and(
          eq(marketScans.id, id),
          eq(marketScans.userId, parsed.userId),
          eq(marketScans.clientId, clientId)
        )
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json({
      scan: {
        id: row.id,
        industry: row.industry,
        geo: row.geo,
        offerType: row.offerType,
        createdAt: row.createdAt,
        normalized: row.payload,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/market/scans/[id]]", e);
    return NextResponse.json({ error: "Failed to load scan" }, { status: 500 });
  }
}
