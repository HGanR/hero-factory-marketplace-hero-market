/**
 * Market Intelligence Sweep Engine — client entry (`runMarketSweep`).
 */

import { bentleyJsonPostHeaders } from "@/lib/revenue-os/bentley-request-correlation";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";

export type RunMarketSweepParams = {
  industry: string;
  targetAudience: string;
  /** Content / posting platforms from intake (e.g. Instagram, TikTok). Sweep always includes TikTok, YouTube, Reddit analysis. */
  platforms: string[];
  clientId?: string;
  trustId?: string;
};

/**
 * Runs the Market Intelligence Sweep (modeled TikTok / YouTube / Reddit signals) and returns structured JSON.
 */
export async function runMarketSweep(params: RunMarketSweepParams): Promise<MarketSweepResult> {
  const res = await fetch("/api/revenue-os/market-sweep", {
    method: "POST",
    headers: bentleyJsonPostHeaders(),
    body: JSON.stringify({
      industry: params.industry.trim(),
      targetAudience: params.targetAudience.trim() || "general audience",
      platforms: Array.isArray(params.platforms) ? params.platforms : [],
      ...(params.clientId && { clientId: params.clientId }),
      ...(params.trustId && { trustId: params.trustId }),
    }),
  });
  const data = (await res.json()) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Market sweep failed");
  }
  const { connectedIntegrations: _c, sweepMeta: _sm, ...rest } = data;
  return rest as MarketSweepResult;
}
