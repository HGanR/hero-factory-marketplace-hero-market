import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { z } from "zod";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { appendCrossModuleAudit } from "@/lib/revenue-os/cross-module-audit";
import { buildMarketIntelligenceHintsForOffer } from "@/lib/revenue-os/market-scan-for-offer";
import { marketScans, offerPackages, offerVersions } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Module 2: Offer Engineering Core
 * POST /api/revenue-os/offers/generate
 * Persists to offer_packages + offer_versions (version increments per workspace package).
 */

const ProfileSchema = z.object({
  userId: z.string().min(1),
  businessName: z.string().optional(),
  businessType: z.string().optional(),
  currentMonthlyRevenue: z.number().optional(),
  targetMonthlyRevenue: z.number(),
  avgOrderValue: z.number(),
  conversionRatePct: z.number().optional(),
  cac: z.number().optional(),
  grossMarginPct: z.number().optional(),
});

const RequestSchema = z
  .object({
    profile: ProfileSchema,
    industry: z.string().optional(),
    clientId: z.string().optional(),
    trustId: z.string().optional(),
    profileId: z.string().optional(),
    /** Optional: when set, requires applyMarketScanToOffer true (no silent merge). */
    marketScanId: z.string().min(1).optional(),
    applyMarketScanToOffer: z.boolean().optional(),
  })
  .refine(
    (d) => !d.marketScanId || d.applyMarketScanToOffer === true,
    {
      message: "applyMarketScanToOffer must be true when marketScanId is set",
      path: ["applyMarketScanToOffer"],
    }
  );

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/offers/generate", req);
    const body = await req.json().catch(() => ({}));
    const {
      profile,
      industry,
      clientId,
      trustId,
      profileId,
      marketScanId,
      applyMarketScanToOffer,
    } = RequestSchema.parse(body);

    const aov = profile.avgOrderValue;
    const target = profile.targetMonthlyRevenue;
    const margin = (profile.grossMarginPct ?? 60) / 100;

    const corePrice = Math.round(aov * 0.7);
    const premiumPrice = Math.round(aov * 1.2);
    const ascensionPrice = Math.round(aov * 1.8);

    const offerLadder = {
      core: {
        name: "Core",
        price: corePrice,
        description: "Essential outcome delivery with process-based guarantee.",
        guarantee: "Process-based guarantee: we deliver X steps; if not completed, we extend at no cost.",
      },
      premium: {
        name: "Premium",
        price: premiumPrice,
        description: "Full scope with priority support and add-ons.",
        guarantee: "Same process guarantee plus 30-day support extension if needed.",
      },
      ascension: {
        name: "Ascension",
        price: ascensionPrice,
        description: "White-glove implementation with dedicated success manager.",
        guarantee: "Process guarantee, dedicated manager, and quarterly review included.",
      },
    };

    const pricingBands = [
      { band: "Core", min: corePrice * 0.9, max: corePrice * 1.1, suggested: corePrice },
      { band: "Premium", min: premiumPrice * 0.9, max: premiumPrice * 1.1, suggested: premiumPrice },
      { band: "Ascension", min: ascensionPrice * 0.9, max: ascensionPrice * 1.2, suggested: ascensionPrice },
    ];

    const upsells = [
      { name: "Implementation Pack", price: Math.round(aov * 0.15), marginNote: "High margin add-on" },
      { name: "Expedited Delivery", price: Math.round(aov * 0.1), marginNote: "Low effort, high margin" },
    ];

    const industryLabel = industry ?? profile.businessType ?? null;
    const responseBody: Record<string, unknown> = {
      offerLadder,
      pricingBands,
      upsells,
      industry: industryLabel,
      targetMonthlyRevenue: target,
      marginPct: margin * 100,
    };

    try {
      await ensureRevenueOsLiveModuleTables();
      const db = await getDb();
      const cid = clientId?.trim() ?? "";
      const tid = trustId?.trim() ?? "";

      if (marketScanId && applyMarketScanToOffer) {
        const scanRows = await db
          .select()
          .from(marketScans)
          .where(
            and(
              eq(marketScans.id, marketScanId),
              eq(marketScans.userId, profile.userId),
              eq(marketScans.clientId, cid),
              eq(marketScans.trustId, tid)
            )
          )
          .limit(1);
        if (scanRows.length === 0) {
          return NextResponse.json(
            {
              error: "Market scan not found for this workspace",
              marketScanId,
            },
            { status: 400 }
          );
        }
        const hints = buildMarketIntelligenceHintsForOffer(
          marketScanId,
          scanRows[0]!.payload
        );
        if (hints) {
          responseBody.marketIntelligenceHints = hints;
          const gap = hints.demandGapSummaries[0];
          if (gap && offerLadder.core.description) {
            offerLadder.core.description = `${offerLadder.core.description}\n\nMarket insight: ${gap}`;
          }
          if (hints.pricingNote && offerLadder.premium.description) {
            offerLadder.premium.description = `${offerLadder.premium.description}\n\n${hints.pricingNote}.`;
          }
          responseBody.offerLadder = offerLadder;
        } else {
          responseBody.marketScanMergeSkipped = "not_v2_normalized";
        }
        const audited = appendCrossModuleAudit(
          responseBody as Record<string, unknown>,
          {
            sourceModule: "market_intelligence",
            action: "market_scan_merged_into_offer_generation",
            actorUserId: profile.userId,
            ids: { marketScanId },
          }
        );
        Object.assign(responseBody, audited);
      }

      const existing = await db
        .select()
        .from(offerPackages)
        .where(
          and(
            eq(offerPackages.userId, profile.userId),
            eq(offerPackages.clientId, cid),
            eq(offerPackages.trustId, tid)
          )
        )
        .orderBy(desc(offerPackages.updatedAt))
        .limit(1);

      let packageId: string;
      if (existing.length > 0) {
        packageId = existing[0]!.id;
      } else {
        packageId = crypto.randomUUID();
        await db.insert(offerPackages).values({
          id: packageId,
          userId: profile.userId,
          clientId: cid,
          trustId: tid,
          profileId: profileId?.trim() ?? null,
          name: "Revenue ladder",
          industryKey: industryLabel?.slice(0, 120) ?? null,
        });
      }

      const verRows = await db
        .select()
        .from(offerVersions)
        .where(eq(offerVersions.packageId, packageId))
        .orderBy(desc(offerVersions.version))
        .limit(1);
      const nextVersion = (verRows[0]?.version ?? 0) + 1;

      const versionId = crypto.randomUUID();
      await db.insert(offerVersions).values({
        id: versionId,
        packageId,
        version: nextVersion,
        offerLadder,
        pricingBands,
        upsells,
        targetMonthlyRevenue: String(target),
        marginPct: String(margin * 100),
        rawPayload: responseBody as Record<string, unknown>,
      });

      responseBody.packageId = packageId;
      responseBody.versionId = versionId;
      responseBody.version = nextVersion;
    } catch (e) {
      console.warn("[revenue-os/offers/generate] persist skipped", e);
    }

    return NextResponse.json(responseBody);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/offers/generate]", e);
    return NextResponse.json(
      { error: "Offer generation failed" },
      { status: 500 }
    );
  }
}
