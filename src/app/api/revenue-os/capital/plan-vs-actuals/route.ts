import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { capitalPlans, channelSpendSnapshots } from "@/lib/db/schema";
import {
  buildChannelComparisons,
  extractBudgetAllocation,
} from "@/lib/revenue-os/capital-plan-vs-actuals";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  planLimit: z.coerce.number().min(1).max(30).optional().default(8),
  spendLimit: z.coerce.number().min(1).max(100).optional().default(48),
});

function dec(n: unknown): number {
  if (n == null) return 0;
  if (typeof n === "number") return n;
  return Number(n);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * GET /api/revenue-os/capital/plan-vs-actuals
 * Recent plans, recent channel spend actuals, and merged comparison for dashboard UI.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/capital/plan-vs-actuals", req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
      month: url.searchParams.get("month") ?? undefined,
      planLimit: url.searchParams.get("planLimit") ?? undefined,
      spendLimit: url.searchParams.get("spendLimit") ?? undefined,
    });

    const month = parsed.month?.trim() || currentMonth();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();

    const basePlanFilter = and(
      eq(capitalPlans.userId, parsed.userId),
      eq(capitalPlans.clientId, clientId),
      eq(capitalPlans.trustId, trustId)
    );

    const forMonthRows = await db
      .select()
      .from(capitalPlans)
      .where(and(basePlanFilter, eq(capitalPlans.snapshotMonth, month)))
      .orderBy(desc(capitalPlans.createdAt))
      .limit(1);

    let activePlan = forMonthRows[0] ?? null;
    if (!activePlan) {
      const latestRows = await db
        .select()
        .from(capitalPlans)
        .where(basePlanFilter)
        .orderBy(desc(capitalPlans.createdAt))
        .limit(1);
      activePlan = latestRows[0] ?? null;
    }

    const recentPlans = await db
      .select({
        id: capitalPlans.id,
        profileId: capitalPlans.profileId,
        snapshotMonth: capitalPlans.snapshotMonth,
        adSpend: capitalPlans.adSpend,
        payload: capitalPlans.payload,
        createdAt: capitalPlans.createdAt,
      })
      .from(capitalPlans)
      .where(basePlanFilter)
      .orderBy(desc(capitalPlans.createdAt))
      .limit(parsed.planLimit);

    const spendRows = await db
      .select({
        id: channelSpendSnapshots.id,
        month: channelSpendSnapshots.month,
        channel: channelSpendSnapshots.channel,
        spend: channelSpendSnapshots.spend,
        revenueAttributed: channelSpendSnapshots.revenueAttributed,
        roas: channelSpendSnapshots.roas,
        createdAt: channelSpendSnapshots.createdAt,
      })
      .from(channelSpendSnapshots)
      .where(
        and(
          eq(channelSpendSnapshots.userId, parsed.userId),
          eq(channelSpendSnapshots.clientId, clientId),
          eq(channelSpendSnapshots.trustId, trustId)
        )
      )
      .orderBy(desc(channelSpendSnapshots.createdAt))
      .limit(parsed.spendLimit);

    const spendForMonth = spendRows.filter((s) => s.month === month);

    const payload = activePlan?.payload as Record<string, unknown> | undefined;
    const planned = extractBudgetAllocation(payload);

    const actuals = spendForMonth.map((s) => ({
      channel: s.channel,
      spend: dec(s.spend),
      revenueAttributed:
        s.revenueAttributed != null ? dec(s.revenueAttributed) : null,
      roas: s.roas != null ? dec(s.roas) : null,
    }));

    const comparison = buildChannelComparisons(planned, actuals);

    return NextResponse.json({
      month,
      activePlan: activePlan
        ? {
            id: activePlan.id,
            profileId: activePlan.profileId,
            snapshotMonth: activePlan.snapshotMonth,
            adSpend: dec(activePlan.adSpend),
            createdAt: activePlan.createdAt,
          }
        : null,
      recentPlans: recentPlans.map((p) => ({
        id: p.id,
        profileId: p.profileId,
        snapshotMonth: p.snapshotMonth,
        adSpend: dec(p.adSpend),
        createdAt: p.createdAt,
        budgetAllocation: extractBudgetAllocation(
          p.payload as Record<string, unknown>
        ),
      })),
      recentChannelSpend: spendRows.map((s) => ({
        id: s.id,
        month: s.month,
        channel: s.channel,
        spend: dec(s.spend),
        revenueAttributed:
          s.revenueAttributed != null ? dec(s.revenueAttributed) : null,
        roas: s.roas != null ? dec(s.roas) : null,
        createdAt: s.createdAt,
      })),
      comparison,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/capital/plan-vs-actuals]", e);
    return NextResponse.json(
      { error: "Failed to load plan vs actuals" },
      { status: 500 }
    );
  }
}
