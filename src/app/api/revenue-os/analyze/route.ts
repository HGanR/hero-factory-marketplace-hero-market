import { NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import crypto from "crypto";
import { RevenueOsAnalyzeRequestSchema } from "@/lib/validators/revenue-os";
import { getDb } from "@/lib/db";
import { ensureRevenueOsAnalyzeTables } from "@/lib/db/revenue-os-tables-ensure";
import { revenueProfiles, revenueOsRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function sha256(input: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function POST(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/analyze", req);
    const body = await req.json();
    const parsed = RevenueOsAnalyzeRequestSchema.parse(body);

    const profile = parsed.profile;
    const overrides = parsed.scenarioOverrides ?? {};

    const traffic = overrides.monthlyTraffic ?? profile.monthlyTraffic;
    const convPct = overrides.conversionRatePct ?? profile.conversionRatePct;
    const aov = overrides.avgOrderValue ?? profile.avgOrderValue;
    const cac = overrides.cac ?? profile.cac;

    const modeledRevenue = traffic * (convPct / 100) * aov;

    const target = profile.targetMonthlyRevenue;
    const gap = Math.max(0, target - modeledRevenue);

    const impliedOrdersNeeded = aov > 0 ? gap / aov : 0;

    const convTarget = Math.min(Math.max(convPct, convPct + 1.0), 25);
    const aovTarget = aov * 1.15;
    const trafficTarget = Math.ceil(traffic * 1.25);
    const cacTarget = Math.max(0, cac * 0.85);

    const targetRevenueModel = trafficTarget * (convTarget / 100) * aovTarget;

    const plan = {
      offerEngineering: [
        "Create 3-step pricing ladder (Core / Premium / Ascension) with explicit outcome guarantees (process-based, not results).",
        "Add 2 high-margin add-ons (implementation, compliance pack, expedited delivery).",
        "Bundle 'fast-start' onboarding to reduce time-to-value and raise willingness-to-pay.",
      ],
      funnel: [
        "Deploy a single-offer landing page with proof stack + objection blocks.",
        "Add a 7-touch email + SMS sequence tied to intent (apply / book / abandoned).",
        "Add calendar booking + pre-qualification (disqualify low-fit leads early).",
      ],
      sales: [
        "Standardize discovery: pain → cost of inaction → timeline → authority → budget.",
        "Add objection playbook: 'need to think' / 'price' / 'timing' with scripted reframes.",
        "Record + score calls; enforce a minimum close-rate target and iterate weekly.",
      ],
      capitalAllocation: [
        "Allocate spend to the best-performing channel only until CAC stabilizes.",
        "Set daily spend caps and scale 15% weekly when CAC < (0.33 * AOV) for B2C or < (0.25 * first-month gross profit) for B2B.",
        "Track LTV by cohort; do not scale paid acquisition without retention metrics.",
      ],
      optimization: [
        "Run weekly A/B tests on headline, price framing, and primary CTA.",
        "Add post-purchase upsell to raise AOV without increasing CAC.",
        "Install churn triggers and winback flows if subscription/retainer model exists.",
      ],
    };

    const inputSnapshot = {
      ...profile,
      scenarioOverrides: overrides,
      modeled: { traffic, conversionRatePct: convPct, avgOrderValue: aov, cac },
    };

    const inputHash = sha256(inputSnapshot);

    await ensureRevenueOsAnalyzeTables();
    const db = await getDb();

    const existing = await db
      .select({ id: revenueProfiles.id })
      .from(revenueProfiles)
      .where(eq(revenueProfiles.userId, profile.userId))
      .limit(1);

    const profileId = existing.length ? existing[0].id : crypto.randomUUID();

    if (!existing.length) {
      await db.insert(revenueProfiles).values({
        id: profileId,
        userId: profile.userId,
        walletAddress: profile.walletAddress ?? null,
        businessName: profile.businessName ?? null,
        businessType: profile.businessType ?? null,
        market: profile.market ?? null,
        currentMonthlyRevenue: String(profile.currentMonthlyRevenue),
        targetMonthlyRevenue: String(profile.targetMonthlyRevenue),
        avgOrderValue: String(profile.avgOrderValue),
        grossMarginPct: String(profile.grossMarginPct),
        monthlyTraffic: profile.monthlyTraffic,
        conversionRatePct: String(profile.conversionRatePct),
        cac: String(profile.cac),
        ltv: String(profile.ltv),
        constraints: profile.constraints ?? null,
        notes: profile.notes ?? null,
      });
    } else {
      await db
        .update(revenueProfiles)
        .set({
          walletAddress: profile.walletAddress ?? null,
          businessName: profile.businessName ?? null,
          businessType: profile.businessType ?? null,
          market: profile.market ?? null,
          currentMonthlyRevenue: String(profile.currentMonthlyRevenue),
          targetMonthlyRevenue: String(profile.targetMonthlyRevenue),
          avgOrderValue: String(profile.avgOrderValue),
          grossMarginPct: String(profile.grossMarginPct),
          monthlyTraffic: profile.monthlyTraffic,
          conversionRatePct: String(profile.conversionRatePct),
          cac: String(profile.cac),
          ltv: String(profile.ltv),
          constraints: profile.constraints ?? null,
          notes: profile.notes ?? null,
        })
        .where(eq(revenueProfiles.id, profileId));
    }

    const output = {
      kpis: {
        currentMonthlyRevenueModel: round2(modeledRevenue),
        targetMonthlyRevenue: round2(target),
        revenueGap: round2(gap),
        impliedOrdersNeeded: round2(impliedOrdersNeeded),
      },
      levers: {
        traffic: { current: traffic, target: trafficTarget, delta: trafficTarget - traffic },
        conversionRatePct: {
          current: round2(convPct),
          target: round2(convTarget),
          delta: round2(convTarget - convPct),
        },
        avgOrderValue: {
          current: round2(aov),
          target: round2(aovTarget),
          delta: round2(aovTarget - aov),
        },
        cac: {
          current: round2(cac),
          target: round2(cacTarget),
          delta: round2(cacTarget - cac),
        },
      },
      plan,
      projections: {
        base: { traffic, conversionRatePct: convPct, avgOrderValue: aov, revenue: round2(modeledRevenue) },
        target: {
          traffic: trafficTarget,
          conversionRatePct: convTarget,
          avgOrderValue: round2(aovTarget),
          revenue: round2(targetRevenueModel),
        },
      },
      meta: {
        inputHash,
        createdAt: new Date().toISOString(),
        profileId,
      },
    };

    await db.insert(revenueOsRuns).values({
      id: crypto.randomUUID(),
      userId: profile.userId,
      profileId,
      input: inputSnapshot as object,
      output: output as object,
      inputHash,
    });

    return NextResponse.json(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "INVALID_REQUEST", message },
      { status: 400 }
    );
  }
}
