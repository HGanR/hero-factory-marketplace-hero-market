import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { z } from "zod";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { capitalPlans } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Module 4: Capital Allocation Optimizer
 * POST /api/revenue-os/capital/plan
 * Persists to capital_plans when userId is provided (links optional profile / snapshot month).
 */

const PlanSchema = z.object({
  adSpend: z.number().min(0),
  channelMix: z
    .record(z.string(), z.number())
    .optional()
    .default({ paid: 60, organic: 25, referral: 15 }),
  cac: z.number().min(0),
  ltv: z.number().min(0),
  margins: z.number().min(0).max(1).optional().default(0.6),
  aov: z.number().optional(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  profileId: z.string().optional(),
  snapshotMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/capital/plan", req);
    const body = await req.json().catch(() => ({}));
    const parsed = PlanSchema.parse(body);

    const { adSpend, channelMix, cac, ltv, margins } = parsed;
    const aov = parsed.aov ?? 0;
    const ltvCacRatio = cac > 0 ? ltv / cac : 0;

    const mixEntries = Object.entries(channelMix) as [string, number][];
    const totalMix = mixEntries.reduce((sum, [, pct]) => sum + pct, 0) || 100;
    const budgetAllocation = mixEntries.map(([channel, pct]) => ({
      channel,
      pct,
      spend: Math.round(adSpend * (pct / totalMix)),
    }));

    const cacAovRatio = aov > 0 ? cac / aov : 0;
    const canScale = ltvCacRatio >= 3 && (aov === 0 || cacAovRatio <= 0.33);
    const scalingGates = {
      canScale,
      ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
      minLtvCacForScale: 3,
      cacAovRatio: Math.round(cacAovRatio * 100) / 100,
      maxCacAovForB2C: 0.33,
      recommendation: canScale
        ? "Scale 15% weekly; monitor retention."
        : "Hold spend until LTV/CAC ≥ 3 and CAC/AOV ≤ 0.33.",
    };

    const guardrails = [
      {
        rule: "Daily spend cap",
        value: `Max ${Math.round(adSpend / 30)}/day until CAC stabilizes`,
      },
      {
        rule: "LTV/CAC minimum",
        value: "≥ 3 before scaling paid acquisition",
      },
      {
        rule: "CAC/AOV (B2C)",
        value: "≤ 0.33 for sustainable unit economics",
      },
      {
        rule: "Margin check",
        value: `Gross margin ${(margins * 100).toFixed(0)}% — ensure LTV accounts for delivery cost`,
      },
    ];

    const payload = {
      budgetAllocation,
      scalingGates,
      guardrails,
      summary: {
        totalAdSpend: adSpend,
        ltvCacRatio,
        canScale: scalingGates.canScale,
      },
    };

    const out: Record<string, unknown> = {
      budgetAllocation,
      scalingGates,
      guardrails,
      summary: payload.summary,
    };

    const persistUserId = parsed.userId?.trim();
    if (persistUserId) {
      try {
        await ensureRevenueOsLiveModuleTables();
        const db = await getDb();
        const planId = crypto.randomUUID();
        await db.insert(capitalPlans).values({
          id: planId,
          userId: persistUserId,
          clientId: parsed.clientId?.trim() ?? "",
          trustId: parsed.trustId?.trim() ?? "",
          profileId: parsed.profileId?.trim() ?? null,
          snapshotMonth: parsed.snapshotMonth ?? null,
          adSpend: String(adSpend),
          channelMix: channelMix as Record<string, unknown>,
          cac: String(cac),
          ltv: String(ltv),
          margins: String(margins),
          payload: payload as Record<string, unknown>,
        });
        out.planId = planId;
      } catch (e) {
        console.warn("[revenue-os/capital/plan] persist skipped", e);
      }
    }

    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/capital/plan]", e);
    return NextResponse.json(
      { error: "Capital plan failed" },
      { status: 500 }
    );
  }
}
