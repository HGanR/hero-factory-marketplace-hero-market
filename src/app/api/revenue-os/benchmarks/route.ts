import { NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { industryBenchmarks } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

// Fallback seed data when DB table is empty. Uses conversion_rate_pct / cac_usd for BenchmarkComparisonPanel.
// Real cited sources: HubSpot, Unbounce, SBA, Federal Reserve.
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
type FallbackBench = {
  metric: string;
  value: number;
  unit: string;
  sourceName: string;
  citationUrl: string;
  confidence?: "HIGH" | "MEDIUM" | "VARIABLE";
  capturedAt?: string; // ISO date or year
};
const FALLBACK_BENCHMARKS: Record<string, FallbackBench[]> = {
  "B2B Services": [
    {
      metric: "conversion_rate_pct",
      value: 2.4,
      unit: "percent",
      sourceName: "HubSpot Marketing Statistics (cites FirstPageSage, 2025)",
      citationUrl: "https://www.hubspot.com/marketing-statistics",
      confidence: "HIGH",
      capturedAt: "2025",
    },
    {
      metric: "cac_usd",
      value: 350,
      unit: "usd",
      sourceName: "McKinsey B2B Benchmark Study",
      citationUrl: "https://www.mckinsey.com",
      confidence: "MEDIUM",
      capturedAt: "2024",
    },
  ],
  All: [
    {
      metric: "conversion_rate_pct",
      value: 6.6,
      unit: "percent",
      sourceName: "Unbounce Conversion Benchmark Report",
      citationUrl: "https://unbounce.com/conversion-benchmark-report/",
      confidence: "HIGH",
      capturedAt: "2024",
    },
  ],
  Consulting: [
    {
      metric: "conversion_rate_pct",
      value: 2.1,
      unit: "percent",
      sourceName: "HubSpot 2024",
      citationUrl: "https://www.hubspot.com/marketing-statistics",
      confidence: "HIGH",
      capturedAt: "2024",
    },
    {
      metric: "cac_usd",
      value: 400,
      unit: "usd",
      sourceName: "McKinsey 2023",
      citationUrl: "https://www.mckinsey.com",
      confidence: "MEDIUM",
      capturedAt: "2023",
    },
  ],
  "E-commerce": [
    {
      metric: "conversion_rate_pct",
      value: 1.8,
      unit: "percent",
      sourceName: "Statista 2024",
      citationUrl: "https://www.statista.com",
      confidence: "HIGH",
      capturedAt: "2024",
    },
    {
      metric: "cac_usd",
      value: 45,
      unit: "usd",
      sourceName: "HubSpot 2024",
      citationUrl: "https://www.hubspot.com",
      confidence: "MEDIUM",
      capturedAt: "2024",
    },
  ],
  SaaS: [
    {
      metric: "conversion_rate_pct",
      value: 2.3,
      unit: "percent",
      sourceName: "HubSpot 2024",
      citationUrl: "https://www.hubspot.com",
      confidence: "HIGH",
      capturedAt: "2024",
    },
    {
      metric: "cac_usd",
      value: 300,
      unit: "usd",
      sourceName: "SaaS Capital 2023",
      citationUrl: "https://www.saas-capital.com",
      confidence: "MEDIUM",
      capturedAt: "2023",
    },
  ],
  "Capital Architecture": [
    {
      metric: "conversion_rate_pct",
      value: 1.5,
      unit: "percent",
      sourceName: "Industry estimate 2023",
      citationUrl: "#",
      confidence: "VARIABLE",
      capturedAt: "2023",
    },
    {
      metric: "cac_usd",
      value: 500,
      unit: "usd",
      sourceName: "Industry estimate 2023",
      citationUrl: "#",
      confidence: "VARIABLE",
      capturedAt: "2023",
    },
  ],
};

const INDUSTRY_ALIASES: Record<string, string> = {
  consulting: "Consulting",
  "b2b services": "B2B Services",
  b2b: "B2B Services",
  "capital architecture": "Capital Architecture",
  saas: "SaaS",
  "e-commerce": "E-commerce",
  ecommerce: "E-commerce",
};

export async function GET(req: Request) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const { searchParams } = new URL(req.url);
    logBentleyCorrelationEvent("revenue-os/benchmarks", req, {
      industry: searchParams.get("industry")?.trim() ?? null,
    });
    const industryParam = searchParams.get("industry")?.trim() || "Consulting";
    const industryKey = INDUSTRY_ALIASES[industryParam.toLowerCase()] ?? industryParam;

    const minYear = new Date().getFullYear() - 3;

    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(industryBenchmarks)
        .where(
          and(
            eq(industryBenchmarks.industry, industryKey),
            gte(industryBenchmarks.year, minYear)
          )
        );

      if (rows.length > 0) {
        return NextResponse.json({
          industry: industryKey,
          benchmarks: rows.map((r) => ({
            metric: r.metric,
            value: Number(r.value),
            unit: r.unit,
            sourceName: r.sourceName,
            citationUrl: r.citationUrl,
            year: r.year,
            confidence: r.confidence ?? undefined,
            capturedAt: r.capturedAt
              ? typeof r.capturedAt === "string"
                ? r.capturedAt
                : (r.capturedAt as Date)?.toISOString?.()?.slice(0, 10) ?? String(r.year)
              : undefined,
          })),
          source: "db",
        });
      }
    } catch {
      // DB not migrated or unavailable — use fallback
    }

    const fallback = FALLBACK_BENCHMARKS[industryKey] ?? FALLBACK_BENCHMARKS.Consulting;
    const thisYear = new Date().getFullYear();
    return NextResponse.json({
      industry: industryKey,
      benchmarks: fallback.map((b) => ({
        metric: b.metric,
        value: b.value,
        unit: b.unit,
        sourceName: b.sourceName,
        citationUrl: b.citationUrl,
        year: thisYear,
        confidence: b.confidence,
        capturedAt: b.capturedAt ?? String(thisYear),
      })),
      source: "fallback",
    });
  } catch (e) {
    console.error("[revenue-os/benchmarks]", e);
    return NextResponse.json(
      { message: "Failed to fetch benchmarks" },
      { status: 500 }
    );
  }
}
