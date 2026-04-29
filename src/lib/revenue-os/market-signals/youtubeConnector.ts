/**
 * YouTube Data API v3 search (videos). Set YOUTUBE_DATA_API_KEY in the environment.
 * Without a key, isConfigured() is false and fetchSignals returns [] (caller may record a disclaimer).
 */

import type { MarketSignalSource, RealMarketSignal } from "@/lib/revenue-os/market-signals/types";

function buildQuery(industry: string, targetAudience: string): string {
  const y = String(new Date().getFullYear());
  const q = [industry, targetAudience, "tips", y].map((s) => s.trim()).filter(Boolean).join(" ");
  return q.slice(0, 200) || "business tips";
}

export const youtubeConnector: MarketSignalSource = {
  id: "youtube",

  isConfigured(): boolean {
    return Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim());
  },

  async fetchSignals(params): Promise<RealMarketSignal[]> {
    const key = process.env.YOUTUBE_DATA_API_KEY?.trim();
    if (!key) return [];

    const q = buildQuery(params.industry, params.targetAudience);
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "8");
    url.searchParams.set("q", q);
    url.searchParams.set("key", key);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`YouTube search failed: ${res.status} ${t.slice(0, 120)}`);
    }
    const data = (await res.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string; description?: string; channelTitle?: string };
      }>;
    };
    const items = data.items ?? [];
    const out: RealMarketSignal[] = [];
    for (const it of items) {
      const title = String(it.snippet?.title ?? "").trim();
      if (!title) continue;
      const vid = it.id?.videoId;
      const desc = String(it.snippet?.description ?? "").trim().slice(0, 400);
      const ch = String(it.snippet?.channelTitle ?? "").trim();
      out.push({
        source: "youtube",
        title,
        snippet: [ch ? ch : "", desc].filter(Boolean).join(" — ").slice(0, 500) || undefined,
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : undefined,
        raw: { videoId: vid },
      });
    }
    return out;
  },
};
