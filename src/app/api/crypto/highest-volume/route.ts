import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currencyPrices } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/**
 * Get Highest Volume Currencies API
 * GET /api/crypto/highest-volume?limit=<limit>
 *
 * Returns the cryptocurrencies with the highest trading volume
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "25";

    const db = await getDb();
    const limitNum = parseInt(limit);

    // Get currencies ordered by volume (mock data for now since we don't have real volume data)
    // In a real implementation, you'd fetch from CoinGecko, CoinMarketCap, etc.
    const currencies = await db
      .select()
      .from(currencyPrices)
      .orderBy(desc(currencyPrices.volume24h))
      .limit(limitNum);

    // Mock chart data for demonstration
    const currenciesWithCharts = currencies.map(currency => ({
      currency: currency.currency,
      name: getCurrencyName(currency.currency),
      priceUSD: Number(currency.priceUSD),
      priceChange24h: Number(currency.priceChange24h || 0),
      volume24h: Number(currency.volume24h || 0),
      marketCap: Number(currency.marketCap || 0),
      chartData: generateMockChartData(currency.currency),
    }));

    return NextResponse.json({
      success: true,
      limit: limitNum,
      total: currenciesWithCharts.length,
      currencies: currenciesWithCharts,
    });
  } catch (error) {
    console.error("Error fetching highest volume:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getCurrencyName(currency: string): string {
  const names: { [key: string]: string } = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    USDT: "Tether",
    SOL: "Solana",
    XRP: "Ripple",
    ADA: "Cardano",
    DOT: "Polkadot",
    LINK: "Chainlink",
    LTC: "Litecoin",
    BCH: "Bitcoin Cash",
  };
  return names[currency] || currency;
}

function generateMockChartData(currency: string): Array<{ time: string; value: number }> {
  const basePrices: { [key: string]: number } = {
    BTC: 645256,
    ETH: 3425,
    USDT: 1.00,
    SOL: 145.75,
    XRP: 0.52,
  };

  const basePrice = basePrices[currency] || 100;
  const data = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const time = new Date(now);
    time.setHours(time.getHours() - (5 - i) * 4);

    // Generate somewhat realistic price movement
    const variation = (Math.random() - 0.5) * 0.05; // ±5% variation
    const value = basePrice * (1 + variation * (i / 5)); // Trend toward current price

    data.push({
      time: time.toTimeString().slice(0, 5), // HH:MM format
      value: Math.round(value * 100) / 100,
    });
  }

  return data;
}