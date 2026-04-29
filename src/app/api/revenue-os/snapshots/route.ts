import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revenueOsMonthlySnapshots } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "userId is required" },
        { status: 400 }
      );
    }

    const clientId = searchParams.get("clientId")?.trim() || "";
    const trustId = searchParams.get("trustId")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 12, 24);

    const db = await getDb();
    const conditions = [
      eq(revenueOsMonthlySnapshots.userId, userId),
      eq(revenueOsMonthlySnapshots.clientId, clientId),
      eq(revenueOsMonthlySnapshots.trustId, trustId),
    ];
    const rows = await db
      .select()
      .from(revenueOsMonthlySnapshots)
      .where(and(...conditions))
      .orderBy(desc(revenueOsMonthlySnapshots.month))
      .limit(limit);

    const snapshots = rows.map((r) => ({
      id: r.id,
      month: r.month,
      traffic: r.traffic,
      conversionRatePct: Number(r.conversionRatePct),
      avgOrderValue: Number(r.avgOrderValue),
      revenue: Number(r.revenue),
      cac: Number(r.cac),
      ltv: Number(r.ltv),
    }));

    return NextResponse.json({ snapshots });
  } catch (e) {
    console.error("[revenue-os/snapshots]", e);
    return NextResponse.json(
      { message: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}
