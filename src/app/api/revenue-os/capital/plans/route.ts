import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { capitalPlans } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

function dec(n: unknown): number {
  if (n == null) return 0;
  if (typeof n === "number") return n;
  return Number(n);
}

/**
 * GET /api/revenue-os/capital/plans?userId=&clientId=&trustId=&limit=
 * Recent persisted capital plans for the workspace.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/capital/plans", req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    const rows = await db
      .select({
        id: capitalPlans.id,
        profileId: capitalPlans.profileId,
        snapshotMonth: capitalPlans.snapshotMonth,
        adSpend: capitalPlans.adSpend,
        channelMix: capitalPlans.channelMix,
        cac: capitalPlans.cac,
        ltv: capitalPlans.ltv,
        margins: capitalPlans.margins,
        payload: capitalPlans.payload,
        createdAt: capitalPlans.createdAt,
      })
      .from(capitalPlans)
      .where(
        and(
          eq(capitalPlans.userId, parsed.userId),
          eq(capitalPlans.clientId, clientId),
          eq(capitalPlans.trustId, trustId)
        )
      )
      .orderBy(desc(capitalPlans.createdAt))
      .limit(parsed.limit);

    const plans = rows.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      snapshotMonth: r.snapshotMonth,
      adSpend: dec(r.adSpend),
      channelMix: r.channelMix,
      cac: dec(r.cac),
      ltv: dec(r.ltv),
      margins: r.margins != null ? dec(r.margins) : null,
      payload: r.payload,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ plans });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/capital/plans]", e);
    return NextResponse.json({ error: "Failed to list plans" }, { status: 500 });
  }
}
