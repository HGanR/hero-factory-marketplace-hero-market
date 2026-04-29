import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoTransactions, currencyPrices } from "@/lib/db/schema";
import { eq, gte, desc } from "drizzle-orm";

/**
 * Get Crypto Transactions API
 * GET /api/crypto/transactions?userAddress=<address>&days=<days>&month=<month>&year=<year>
 *
 * Returns the user's transaction history with optional filters
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress");
    const days = searchParams.get("days") || "30";

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing userAddress parameter" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const daysNum = parseInt(days);

    // Calculate date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get transactions with price information
    const transactions = await db
      .select({
        id: cryptoTransactions.id,
        transactionId: cryptoTransactions.transactionId,
        userAddress: cryptoTransactions.userAddress,
        transactionType: cryptoTransactions.transactionType,
        currency: cryptoTransactions.currency,
        amount: cryptoTransactions.amount,
        fee: cryptoTransactions.fee,
        status: cryptoTransactions.status,
        txHash: cryptoTransactions.txHash,
        fromAddress: cryptoTransactions.fromAddress,
        toAddress: cryptoTransactions.toAddress,
        chain: cryptoTransactions.chain,
        createdAt: cryptoTransactions.createdAt,
        completedAt: cryptoTransactions.completedAt,
        priceUSD: currencyPrices.priceUSD,
      })
      .from(cryptoTransactions)
      .leftJoin(currencyPrices, eq(cryptoTransactions.currency, currencyPrices.currency))
      .where(eq(cryptoTransactions.userAddress, userAddress))
      .orderBy(desc(cryptoTransactions.createdAt));

    // Format transactions for frontend
    const formattedTransactions = transactions.map(tx => {
      const coin = tx.currency;
      const coinIcon = getCoinIcon(coin);

      return {
        id: tx.transactionId,
        coin,
        coinIcon,
        transaction: tx.transactionType.charAt(0).toUpperCase() + tx.transactionType.slice(1),
        type: tx.transactionType,
        amount: Number(tx.amount),
        currency: tx.currency,
        date: tx.createdAt?.toISOString() || new Date().toISOString(),
        status: tx.status,
        fees: Number(tx.fee),
        feesCurrency: tx.currency,
        txHash: tx.txHash,
      };
    });

    return NextResponse.json({
      success: true,
      userAddress,
      filters: {
        days: daysNum,
      },
      transactions: formattedTransactions,
      total: formattedTransactions.length,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getCoinIcon(coin: string): string {
  const icons: { [key: string]: string } = {
    BTC: "₿",
    ETH: "Ξ",
    USDT: "₮",
    SOL: "◎",
    XRP: "✕",
  };
  return icons[coin] || coin.charAt(0);
}