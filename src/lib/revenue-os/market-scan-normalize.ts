/**
 * Normalized Market Intelligence scan shape — all competitor/pricing rows require citationUrl.
 */

export type CitedCompetitorRow = {
  source: string;
  metric: string;
  value: number;
  unit: string;
  citationUrl: string;
  year?: number;
  confidence?: string | null;
};

export type PricingBand = {
  conversionRatePct: {
    median: number;
    unit: string;
    citationUrl: string;
    sourceName: string;
  } | null;
  cacUsd: {
    median: number;
    unit: string;
    citationUrl: string;
    sourceName: string;
  } | null;
  aovUsd: {
    median: number;
    unit: string;
    citationUrl: string;
    sourceName: string;
  } | null;
};

export type RegulatoryNote = {
  note: string;
  citationUrl: string;
  sourceName?: string;
};

export type NormalizedMarketScan = {
  /** v2 normalized envelope */
  v: 2;
  industry: string;
  geo: string | null;
  offerType: string | null;
  competitors: CitedCompetitorRow[];
  pricing: PricingBand;
  /** Only cited or empty — no uncited demand claims */
  demandGaps: Array<{ summary: string; citationUrl: string }>;
  regulatory: RegulatoryNote[];
  citations: Array<{ source: string; url: string }>;
};

function isNonEmptyUrl(u: string | null | undefined): u is string {
  return typeof u === "string" && u.trim().length > 4 && /^https?:\/\//i.test(u.trim());
}

/** Drop any competitor row missing a valid citation URL. */
export function filterCitedCompetitors<T extends { citationUrl?: string | null }>(
  rows: T[]
): (T & { citationUrl: string })[] {
  return rows.filter((r): r is T & { citationUrl: string } => isNonEmptyUrl(r.citationUrl));
}

/** Build pricing bands only from cited benchmark rows; null field if missing citation. */
export function buildPricingFromBenchmarks(
  conversionBench: { value: unknown; unit: string; citationUrl: string; sourceName: string } | undefined,
  cacBench: { value: unknown; unit: string; citationUrl: string; sourceName: string } | undefined,
  aovBench: { value: unknown; unit: string; citationUrl: string; sourceName: string } | undefined
): PricingBand {
  const conv =
    conversionBench && isNonEmptyUrl(conversionBench.citationUrl)
      ? {
          median: Number(conversionBench.value),
          unit: conversionBench.unit,
          citationUrl: conversionBench.citationUrl.trim(),
          sourceName: conversionBench.sourceName,
        }
      : null;
  const cac =
    cacBench && isNonEmptyUrl(cacBench.citationUrl)
      ? {
          median: Number(cacBench.value),
          unit: cacBench.unit,
          citationUrl: cacBench.citationUrl.trim(),
          sourceName: cacBench.sourceName,
        }
      : null;
  const aov =
    aovBench && isNonEmptyUrl(aovBench.citationUrl)
      ? {
          median: Number(aovBench.value),
          unit: aovBench.unit,
          citationUrl: aovBench.citationUrl.trim(),
          sourceName: aovBench.sourceName,
        }
      : null;
  return {
    conversionRatePct: conv,
    cacUsd: cac,
    aovUsd: aov,
  };
}

/**
 * Demand gaps: only structured rows that cite a benchmark URL (e.g. conversion vs traffic gap narrative).
 * If no safe cited gap, returns empty array (no ad-hoc uncited claims).
 */
export function deriveDemandGaps(
  industryLabel: string,
  pricing: PricingBand
): Array<{ summary: string; citationUrl: string }> {
  const out: Array<{ summary: string; citationUrl: string }> = [];
  const c = pricing.conversionRatePct;
  if (c && isNonEmptyUrl(c.citationUrl)) {
    out.push({
      summary: `Benchmark conversion context for ${industryLabel} — compare your funnel to cited median.`,
      citationUrl: c.citationUrl,
    });
  }
  return out;
}

/** Regulatory: placeholder — only include rows when we have benchmark sources tagged regulatory in DB later. */
export function deriveRegulatoryFromBenchmarks(
  benchmarks: Array<{ metric: string; sourceName: string; citationUrl: string }>
): RegulatoryNote[] {
  const reg = benchmarks.filter(
    (b) =>
      isNonEmptyUrl(b.citationUrl) &&
      (/\bregulat|compliance|gdpr|ftc\b/i.test(b.metric) || /\bregulat|compliance\b/i.test(b.sourceName))
  );
  return reg.slice(0, 5).map((b) => ({
    note: `Regulatory / compliance context (${b.metric}) — verify with primary source.`,
    citationUrl: b.citationUrl.trim(),
    sourceName: b.sourceName,
  }));
}
