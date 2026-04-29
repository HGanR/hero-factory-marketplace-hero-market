/**
 * Signal Connector Layer — pluggable real-world market signal sources (Reddit, YouTube, …).
 */

export type MarketSignalSourceId = "reddit" | "youtube";

export type RealMarketSignal = {
  source: MarketSignalSourceId;
  /** Short headline or thread title */
  title: string;
  snippet?: string;
  url?: string;
  /** Optional raw payload for debugging / audit */
  raw?: Record<string, unknown>;
};

export type MarketSignalFetchParams = {
  industry: string;
  targetAudience: string;
  platforms: string[];
};

/**
 * Implementations fetch public signals (search, trending snippets) for hybrid Bentley intelligence.
 */
export interface MarketSignalSource {
  readonly id: MarketSignalSourceId;
  /** Whether this source can run in the current environment (e.g. API key present). */
  isConfigured(): boolean;
  fetchSignals(params: MarketSignalFetchParams): Promise<RealMarketSignal[]>;
}

export type RealSignalBundle = {
  signals: RealMarketSignal[];
  bySource: Partial<Record<MarketSignalSourceId, number>>;
  errors: string[];
};
