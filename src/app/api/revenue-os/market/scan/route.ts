import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { industryBenchmarks, marketScans } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  buildPricingFromBenchmarks,
  deriveDemandGaps,
  deriveRegulatoryFromBenchmarks,
  filterCitedCompetitors,
  type NormalizedMarketScan,
} from "@/lib/revenue-os/market-scan-normalize";
import {
  collectCitationSourcesFromNormalized,
  upsertMarketSourcesForScan,
} from "@/lib/revenue-os/market-scan-persist-sources";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const INDUSTRY_ALIASES: Record<string, string> = {
  consulting: "Consulting",
  "b2b services": "B2B Services",
  b2b: "B2B Services",
  "capital architecture": "Capital Architecture",
  saas: "SaaS",
  "e-commerce": "E-commerce",
  ecommerce: "E-commerce",
};

/**
 * Module 1: Market Intelligence Engine
 * POST /api/revenue-os/market/scan
 * Persists to market_scans when userId provided; normalized shape enforces citations.
 */

const ScanSchema = z.object({
  industry: z.string().min(1),
  geo: z.string().optional(),
  offerType: z.string().optional(),
  userId: z.string().optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/market/scan", req);
    const body = await req.json().catch(() => ({}));
    const parsed = ScanSchema.parse(body);

    const industryKey =
      INDUSTRY_ALIASES[parsed.industry.toLowerCase()] ?? parsed.industry;
    const minYear = new Date().getFullYear() - 3;

    const db = await getDb();
    const benchmarks = await db
      .select()
      .from(industryBenchmarks)
      .where(
        and(
          eq(industryBenchmarks.industry, industryKey),
          gte(industryBenchmarks.year, minYear)
        )
      )
      .limit(50);

    const conversionBench = benchmarks.find(
      (b) =>
        b.metric === "conversion_rate_pct" || b.metric === "conversion"
    );
    const cacBench = benchmarks.find(
      (b) => b.metric === "cac_usd" || b.metric === "cac"
    );
    const aovBench = benchmarks.find(
      (b) => b.metric === "aov_usd" || b.metric === "avg_order_value"
    );

    const rawCompetitors = benchmarks
      .filter((b) => b.sourceName && b.citationUrl)
      .map((b) => ({
        source: b.sourceName,
        metric: b.metric,
        value: Number(b.value),
        unit: b.unit,
        citationUrl: b.citationUrl,
        year: b.year,
        confidence: b.confidence,
      }));

    const competitorSet = filterCitedCompetitors(rawCompetitors);

    const pricingNormalized = buildPricingFromBenchmarks(
      conversionBench
        ? {
            value: conversionBench.value,
            unit: conversionBench.unit,
            citationUrl: conversionBench.citationUrl,
            sourceName: conversionBench.sourceName,
          }
        : undefined,
      cacBench
        ? {
            value: cacBench.value,
            unit: cacBench.unit,
            citationUrl: cacBench.citationUrl,
            sourceName: cacBench.sourceName,
          }
        : undefined,
      aovBench
        ? {
            value: aovBench.value,
            unit: aovBench.unit,
            citationUrl: aovBench.citationUrl,
            sourceName: aovBench.sourceName,
          }
        : undefined
    );

    /** Mirrors normalized pricing (valid https citation_url only). */
    const pricingRanges = {
      conversionRatePct: pricingNormalized.conversionRatePct,
      cacUsd: pricingNormalized.cacUsd,
      aovUsd: pricingNormalized.aovUsd,
    };

    const positioningNotes = [
      {
        note: `Industry ${parsed.industry} conversion median from cited sources.`,
        citationUrl: conversionBench?.citationUrl ?? null,
      },
      {
        note: `CAC benchmarks inform spend allocation and scaling gates.`,
        citationUrl: cacBench?.citationUrl ?? null,
      },
    ].filter((n) => n.citationUrl);

    const regulatory = deriveRegulatoryFromBenchmarks(
      benchmarks.map((b) => ({
        metric: b.metric,
        sourceName: b.sourceName,
        citationUrl: b.citationUrl,
      }))
    );

    const demandGaps = deriveDemandGaps(industryKey, pricingNormalized);

    const normalized: NormalizedMarketScan = {
      v: 2,
      industry: parsed.industry,
      geo: parsed.geo ?? null,
      offerType: parsed.offerType ?? null,
      competitors: competitorSet,
      pricing: pricingNormalized,
      demandGaps,
      regulatory,
      citations: competitorSet.map((c) => ({ source: c.source, url: c.citationUrl })),
    };

    let scanId: string | null = null;
    const persistUserId = parsed.userId?.trim();
    if (persistUserId) {
      try {
        await ensureRevenueOsLiveModuleTables();
        const id = crypto.randomUUID();
        const clientId = parsed.clientId?.trim() ?? "";
        const trustId = parsed.trustId?.trim() ?? "";
        await db.insert(marketScans).values({
          id,
          userId: persistUserId,
          clientId,
          trustId,
          industry: industryKey,
          geo: parsed.geo?.trim() ?? null,
          offerType: parsed.offerType?.trim() ?? null,
          payload: normalized as unknown as Record<string, unknown>,
        });
        scanId = id;
        const sourceRows = collectCitationSourcesFromNormalized(normalized);
        if (sourceRows.length > 0) {
          try {
            await upsertMarketSourcesForScan(db, id, industryKey, sourceRows);
          } catch (srcErr) {
            console.warn("[revenue-os/market/scan] market_sources upsert skipped", srcErr);
          }
        }
      } catch (e) {
        console.warn("[revenue-os/market/scan] persist skipped", e);
      }
    }

    return NextResponse.json({
      industry: parsed.industry,
      geo: parsed.geo ?? null,
      offerType: parsed.offerType ?? null,
      competitorSet,
      pricingRanges,
      positioningNotes,
      citations: competitorSet.map((c) => ({
        source: c.source,
        url: c.citationUrl,
      })),
      normalized,
      ...(scanId ? { scanId } : {}),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/market/scan]", e);
    return NextResponse.json(
      { error: "Market scan failed" },
      { status: 500 }
    );
  }
}
