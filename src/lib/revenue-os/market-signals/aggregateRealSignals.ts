/**
 * Fetches Reddit + YouTube (when configured) and merges into a `RealSignalBundle`.
 */

import { redditConnector } from "@/lib/revenue-os/market-signals/redditConnector";
import { youtubeConnector } from "@/lib/revenue-os/market-signals/youtubeConnector";
import type { MarketSignalFetchParams, MarketSignalSourceId, RealSignalBundle } from "@/lib/revenue-os/market-signals/types";

const SOURCES = [redditConnector, youtubeConnector] as const;

export async function aggregateRealMarketSignals(params: MarketSignalFetchParams): Promise<RealSignalBundle> {
  const signals: RealSignalBundle["signals"] = [];
  const errors: string[] = [];
  const bySource: Partial<Record<MarketSignalSourceId, number>> = {};

  for (const src of SOURCES) {
    try {
      const rows = await src.fetchSignals(params);
      bySource[src.id] = rows.length;
      signals.push(...rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${src.id}: ${msg}`);
      bySource[src.id] = 0;
    }
  }

  return { signals, bySource, errors };
}
