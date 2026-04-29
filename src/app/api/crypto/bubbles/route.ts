import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoBubbleSettings, currencyPrices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Default enabled crypto bubbles for fallback
const DEFAULT_ENABLED_BUBBLES = [
  { id: 'btc-default', currency: 'BTC', symbol: '₿', name: 'Bitcoin', displayOrder: 1, color: '#f7931a', icon: 'bitcoin', priceUSD: null, priceChange24h: null },
  { id: 'eth-default', currency: 'ETH', symbol: 'Ξ', name: 'Ethereum', displayOrder: 2, color: '#627eea', icon: 'ethereum', priceUSD: null, priceChange24h: null },
  { id: 'usdt-default', currency: 'USDT', symbol: '₮', name: 'Tether', displayOrder: 3, color: '#26a17b', icon: 'tether', priceUSD: null, priceChange24h: null },
  { id: 'bnb-default', currency: 'BNB', symbol: 'BNB', name: 'Binance Coin', displayOrder: 4, color: '#f3ba2f', icon: 'binance', priceUSD: null, priceChange24h: null },
  { id: 'sol-default', currency: 'SOL', symbol: '◎', name: 'Solana', displayOrder: 5, color: '#9945ff', icon: 'solana', priceUSD: null, priceChange24h: null },
];

// Public endpoint for getting enabled crypto bubbles with current prices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const db = await getDb();

    // Get enabled bubbles with current prices
    const bubbles = await db
      .select({
        id: cryptoBubbleSettings.id,
        currency: cryptoBubbleSettings.currency,
        symbol: cryptoBubbleSettings.symbol,
        name: cryptoBubbleSettings.name,
        displayOrder: cryptoBubbleSettings.displayOrder,
        color: cryptoBubbleSettings.color,
        icon: cryptoBubbleSettings.icon,
        priceUSD: currencyPrices.priceUSD,
        priceChange24h: currencyPrices.priceChange24h,
      })
      .from(cryptoBubbleSettings)
      .leftJoin(currencyPrices, eq(cryptoBubbleSettings.currency, currencyPrices.currency))
      .where(eq(cryptoBubbleSettings.isEnabled, true))
      .orderBy(cryptoBubbleSettings.displayOrder)
      .limit(limit);

    if (bubbles.length === 0) {
      // If database has no enabled bubbles, return defaults
      return NextResponse.json({
        success: true,
        bubbles: DEFAULT_ENABLED_BUBBLES.slice(0, limit),
        usingDefaults: true
      });
    }

    return NextResponse.json({
      success: true,
      bubbles: bubbles.map(bubble => ({
        ...bubble,
        priceUSD: bubble.priceUSD ? Number(bubble.priceUSD) : null,
        priceChange24h: bubble.priceChange24h ? Number(bubble.priceChange24h) : null,
      })),
    });
  } catch (error) {
    console.error("Database not available, using default bubbles:", error);

    // Return default enabled bubbles when database is not available
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    return NextResponse.json({
      success: true,
      bubbles: DEFAULT_ENABLED_BUBBLES.slice(0, limit),
      fallback: true
    });
  }
}