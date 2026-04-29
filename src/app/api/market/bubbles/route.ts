import { NextResponse } from "next/server";
import { SYMBOL_TO_COINGECKO_ID } from "@/lib/market/symbolMap";
import { redisCache, RedisCache } from "@/lib/cache/redis";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsRaw = searchParams.get("symbols") ?? "";
  const timeframe = searchParams.get("timeframe") || "24h"; // 1h, 24h, 7d
  const symbols = symbolsRaw
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const cacheKey = RedisCache.getMarketDataKey(symbols, timeframe);

  // Check Redis cache first (only if Redis is configured)
  let cachedEntry = null;
  try {
    cachedEntry = await redisCache.get(cacheKey);
  } catch (error) {
    console.warn('Redis not configured, using in-memory fallback');
  }
  const now = Date.now();

  if (cachedEntry && (now - cachedEntry.timestamp) < 30000) { // 30 seconds
    return NextResponse.json({
      ok: true,
      coins: cachedEntry.data,
      cached: true,
      cacheAge: now - cachedEntry.timestamp
    });
  }

  const ids = symbols
    .map(sym => SYMBOL_TO_COINGECKO_ID[sym])
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, coins: [] });
  }

  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("sparkline", "false");

  // Set timeframe parameter based on request
  const timeframeMap: Record<string, string> = {
    "1h": "1h",
    "24h": "24h",
    "7d": "7d"
  };
  const apiTimeframe = timeframeMap[timeframe] || "24h";
  url.searchParams.set("price_change_percentage", apiTimeframe);

  // Add API key as query parameter (not header) as per CoinGecko docs
  const key = process.env.COINGECKO_DEMO_API_KEY;
  if (key) url.searchParams.set("x_cg_demo_api_key", key);

  const headers: Record<string, string> = { accept: "application/json" };

  const r = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!r.ok) {
    // Return cached data if available, even if stale, during API failures
    if (cachedEntry) {
      return NextResponse.json({
        ok: true,
        coins: cachedEntry.data,
        cached: true,
        cacheAge: now - cachedEntry.timestamp,
        stale: true
      });
    }
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const data = await r.json();

  // Normalize + reattach symbols
  const idToSymbol = Object.fromEntries(
    Object.entries(SYMBOL_TO_COINGECKO_ID).map(([sym, id]) => [id, sym])
  );

  const coins = data.map((c: any) => {
    // Get the appropriate change percentage based on timeframe
    const changePercentage = (() => {
      switch (timeframe) {
        case "1h": return c.price_change_percentage_1h_in_currency ?? 0;
        case "7d": return c.price_change_percentage_7d_in_currency ?? 0;
        case "24h":
        default: return c.price_change_percentage_24h_in_currency ?? 0;
      }
    })();

    return {
      id: c.id,
      symbol: idToSymbol[c.id] ?? (c.symbol?.toUpperCase() ?? ""),
      name: c.name,
      price: c.current_price,
      change24h: changePercentage,
      timeframe,
      marketCap: c.market_cap ?? 0,
      volume: c.total_volume ?? 0,
      image: c.image,
    };
  });

  // Update Redis cache (if available)
  try {
    await redisCache.set(cacheKey, {
      data: coins,
      timestamp: now,
      symbols: symbols.sort().join(','),
      timeframe
    });
  } catch (error) {
    console.warn('Redis cache update failed, continuing without caching');
  }

  return NextResponse.json({
    ok: true,
    coins,
    cached: false
  });
}