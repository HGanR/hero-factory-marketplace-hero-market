/**
 * Reddit public JSON search (no OAuth). Requires a descriptive User-Agent per Reddit API guidelines.
 */

import type { MarketSignalSource, RealMarketSignal } from "@/lib/revenue-os/market-signals/types";

const UA =
  process.env.REDDIT_USER_AGENT?.trim() ||
  "HeroMarket/1.0 (Bentley market intelligence; +https://github.com/hero-market)";

function buildQuery(industry: string, targetAudience: string): string {
  const q = [industry, targetAudience].map((s) => s.trim()).filter(Boolean).join(" ");
  return q.slice(0, 300) || "business marketing";
}

export const redditConnector: MarketSignalSource = {
  id: "reddit",

  isConfigured(): boolean {
    return true;
  },

  async fetchSignals(params): Promise<RealMarketSignal[]> {
    const q = buildQuery(params.industry, params.targetAudience);
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=20&sort=relevance`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new Error(`Reddit search failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      data?: { children?: Array<{ data?: Record<string, unknown> }> };
    };
    const children = data?.data?.children ?? [];
    const out: RealMarketSignal[] = [];
    for (const c of children) {
      const d = c.data;
      if (!d) continue;
      const title = String(d.title ?? "").trim();
      if (!title) continue;
      const selftext = typeof d.selftext === "string" ? d.selftext.trim().slice(0, 400) : "";
      const permalink = typeof d.permalink === "string" ? d.permalink : "";
      const sub = typeof d.subreddit === "string" ? d.subreddit : "";
      const snippet = [sub ? `r/${sub}` : "", selftext].filter(Boolean).join(" — ").slice(0, 500);
      out.push({
        source: "reddit",
        title,
        snippet: snippet || undefined,
        url: permalink ? `https://www.reddit.com${permalink}` : undefined,
        raw: { subreddit: sub },
      });
    }
    return out;
  },
};
