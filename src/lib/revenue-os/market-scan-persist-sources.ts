/**
 * Normalize citation URLs and upsert into `market_sources` after a persisted market scan.
 */

import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { marketSources } from "@/lib/db/schema";
import type { NormalizedMarketScan } from "@/lib/revenue-os/market-scan-normalize";

type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

export type CitationSourceRow = {
  name: string;
  url: string;
  sourceType: "competitor" | "benchmark" | "demand_gap" | "regulatory";
};

function isValidHttpUrl(u: string): boolean {
  return u.trim().length > 4 && /^https?:\/\//i.test(u.trim());
}

/** Trim for storage and matching. */
export function canonicalCitationUrl(url: string): string {
  return url.trim();
}

export function collectCitationSourcesFromNormalized(
  scan: NormalizedMarketScan
): CitationSourceRow[] {
  const byUrl = new Map<string, CitationSourceRow>();

  function add(
    name: string,
    url: string,
    sourceType: CitationSourceRow["sourceType"]
  ) {
    const u = canonicalCitationUrl(url);
    if (!isValidHttpUrl(u)) return;
    const key = u.toLowerCase();
    if (!byUrl.has(key)) {
      byUrl.set(key, {
        name: name.slice(0, 200),
        url: u,
        sourceType,
      });
    }
  }

  for (const c of scan.competitors) {
    add(c.source, c.citationUrl, "competitor");
  }
  const p = scan.pricing;
  if (p.conversionRatePct) {
    add(p.conversionRatePct.sourceName, p.conversionRatePct.citationUrl, "benchmark");
  }
  if (p.cacUsd) {
    add(p.cacUsd.sourceName, p.cacUsd.citationUrl, "benchmark");
  }
  if (p.aovUsd) {
    add(p.aovUsd.sourceName, p.aovUsd.citationUrl, "benchmark");
  }
  for (const d of scan.demandGaps) {
    add("Demand gap", d.citationUrl, "demand_gap");
  }
  for (const r of scan.regulatory) {
    add(r.sourceName ?? "Regulatory", r.citationUrl, "regulatory");
  }
  for (const c of scan.citations) {
    add(c.source, c.url, "competitor");
  }

  return [...byUrl.values()];
}

export async function upsertMarketSourcesForScan(
  db: Db,
  scanId: string,
  industryKey: string,
  rows: CitationSourceRow[]
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const [existing] = await db
      .select({ id: marketSources.id })
      .from(marketSources)
      .where(sql`LOWER(${marketSources.url}) = ${row.url.toLowerCase()}`)
      .limit(1);

    if (existing) {
      await db
        .update(marketSources)
        .set({
          name: row.name,
          industry: industryKey,
          sourceType: row.sourceType,
          lastMarketScanId: scanId,
        })
        .where(eq(marketSources.id, existing.id));
    } else {
      await db.insert(marketSources).values({
        id: crypto.randomUUID(),
        name: row.name,
        url: row.url,
        industry: industryKey,
        sourceType: row.sourceType,
        lastMarketScanId: scanId,
      });
    }
    n++;
  }
  return n;
}
