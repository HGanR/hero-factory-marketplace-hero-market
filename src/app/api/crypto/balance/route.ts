import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { userWallets, currencyPrices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get Wallet Balance API
 * GET /api/crypto/balance?userAddress=<address>
 *
 * Returns the user's wallet balances across all currencies
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userAddress = searchParams.get("userAddress");

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing userAddress parameter" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Get all wallets for the user with price information
    const wallets = await db
      .select({
        id: userWallets.id,
        userAddress: userWallets.userAddress,
        currency: userWallets.currency,
        balance: userWallets.balance,
        lockedBalance: userWallets.lockedBalance,
        walletAddress: userWallets.walletAddress,
        chain: userWallets.chain,
        isActive: userWallets.isActive,
        priceUSD: currencyPrices.priceUSD,
        priceChange24h: currencyPrices.priceChange24h,
      })
      .from(userWallets)
      .leftJoin(currencyPrices, eq(userWallets.currency, currencyPrices.currency))
      .where(eq(userWallets.userAddress, userAddress));

    // Calculate totals
    const exchangeBalance = { usd: 0, amount: 0, percentage: 0 };
    const assetsBalance = { usd: 0, amount: 0 };
    const walletsWithUSD = wallets.map(wallet => ({
      ...wallet,
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
      balanceUSD: Number(wallet.balance) * Number(wallet.priceUSD || 0),
      priceUSD: Number(wallet.priceUSD || 0),
      priceChange24h: Number(wallet.priceChange24h || 0),
    }));

    // Calculate exchange balance (simplified - all balances)
    exchangeBalance.usd = walletsWithUSD.reduce((sum, w) => sum + w.balanceUSD, 0);
    exchangeBalance.amount = walletsWithUSD.reduce((sum, w) => sum + w.balance, 0);
    exchangeBalance.percentage = exchangeBalance.amount > 0 ? (exchangeBalance.usd / exchangeBalance.amount) * 100 : 0;

    // Assets balance (same as exchange for now)
    assetsBalance.usd = exchangeBalance.usd;
    assetsBalance.amount = exchangeBalance.amount;

    return NextResponse.json({
      success: true,
      userAddress,
      balances: {
        exchangeBalance,
        assetsBalance,
        wallets: walletsWithUSD,
      },
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}