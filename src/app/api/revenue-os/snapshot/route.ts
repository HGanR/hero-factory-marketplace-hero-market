import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revenueOsMonthlySnapshots } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const SnapshotSchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  traffic: z.number().int().min(0),
  conversionRatePct: z.number().min(0).max(100),
  avgOrderValue: z.number().min(0),
  revenue: z.number().min(0),
  cac: z.number().min(0),
  ltv: z.number().min(0),
});

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const body = await req.json();
    const parsed = SnapshotSchema.parse(body);

    const id = crypto.randomUUID();

    const db = await getDb();

    // Upsert: if user+month exists, update; else insert
    const clientId = parsed.clientId?.trim() || "";
    const trustId = parsed.trustId?.trim() || "";

    const existing = await db
      .select()
      .from(revenueOsMonthlySnapshots)
      .where(
        and(
          eq(revenueOsMonthlySnapshots.userId, parsed.userId),
          eq(revenueOsMonthlySnapshots.clientId, clientId),
          eq(revenueOsMonthlySnapshots.trustId, trustId),
          eq(revenueOsMonthlySnapshots.month, parsed.month)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(revenueOsMonthlySnapshots)
        .set({
          traffic: parsed.traffic,
          conversionRatePct: String(parsed.conversionRatePct),
          avgOrderValue: String(parsed.avgOrderValue),
          revenue: String(parsed.revenue),
          cac: String(parsed.cac),
          ltv: String(parsed.ltv),
        })
        .where(eq(revenueOsMonthlySnapshots.id, existing[0].id));

      return NextResponse.json({
        ok: true,
        id: existing[0].id,
        action: "updated",
      });
    }

    await db.insert(revenueOsMonthlySnapshots).values({
      id,
      userId: parsed.userId,
      clientId,
      trustId,
      month: parsed.month,
      traffic: parsed.traffic,
      conversionRatePct: String(parsed.conversionRatePct),
      avgOrderValue: String(parsed.avgOrderValue),
      revenue: String(parsed.revenue),
      cac: String(parsed.cac),
      ltv: String(parsed.ltv),
    });

    return NextResponse.json({
      ok: true,
      id,
      action: "created",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid snapshot data", errors: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/snapshot]", e);
    return NextResponse.json(
      { message: "Failed to save snapshot" },
      { status: 500 }
    );
  }
}
