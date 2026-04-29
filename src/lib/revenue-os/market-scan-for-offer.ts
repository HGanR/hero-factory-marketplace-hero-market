import type { NormalizedMarketScan } from "@/lib/revenue-os/market-scan-normalize";

export type MarketIntelligenceHintsForOffer = {
  marketScanId: string;
  industry?: string;
  demandGapSummaries: string[];
  competitorHighlights: string[];
  pricingNote: string | null;
};

function asV2(payload: unknown): NormalizedMarketScan | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.v !== 2) return null;
  return payload as NormalizedMarketScan;
}

/**
 * Build optional offer-engineering hints from a persisted market_scans.payload (v2 normalized).
 */
export function buildMarketIntelligenceHintsForOffer(
  marketScanId: string,
  payload: unknown
): MarketIntelligenceHintsForOffer | null {
  const n = asV2(payload);
  if (!n) return null;

  const demandGapSummaries = (n.demandGaps ?? [])
    .map((d) => (typeof d.summary === "string" ? d.summary.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);

  const competitorHighlights = (n.competitors ?? [])
    .slice(0, 5)
    .map((c) => {
      const m = typeof c.metric === "string" ? c.metric : "metric";
      const v = c.value;
      const u = typeof c.unit === "string" ? c.unit : "";
      return `${m}: ${v} ${u}`.trim();
    });

  const parts: string[] = [];
  if (n.pricing?.cacUsd?.median != null) {
    parts.push(`Benchmark CAC ~$${n.pricing.cacUsd.median}`);
  }
  if (n.pricing?.aovUsd?.median != null) {
    parts.push(`Benchmark AOV ~$${n.pricing.aovUsd.median}`);
  }
  const pricingNote = parts.length > 0 ? parts.join("; ") : null;

  return {
    marketScanId,
    industry: n.industry,
    demandGapSummaries,
    competitorHighlights,
    pricingNote,
  };
}
