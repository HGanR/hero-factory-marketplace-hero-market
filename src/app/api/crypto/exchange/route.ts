import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exchangeTransactions, cryptoTransactions, userWallets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Crypto Exchange API
 * POST /api/crypto/exchange
 *
 * Executes a crypto-to-crypto exchange
 */

export async function POST(req: NextRequest) {
  // Admin-only endpoint - wallet operations require admin privileges
  const isAdmin = req.headers.get("cookie")?.includes("adminLoggedIn=true") ||
                  req.headers.get("x-admin-auth") === "true";
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required for exchange operations." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      userAddress,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
    } = body;

    // Validation
    if (!userAddress || !fromCurrency || !toCurrency || !fromAmount || !toAmount) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["userAddress", "fromCurrency", "toCurrency", "fromAmount", "toAmount"],
        },
        { status: 400 }
      );
    }

    // Validate amounts
    if (fromAmount <= 0 || toAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amounts" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if user has sufficient balance
    const fromWallet = await db
      .select()
      .from(userWallets)
      .where(and(
        eq(userWallets.userAddress, userAddress),
        eq(userWallets.currency, fromCurrency)
      ))
      .limit(1);

    if (!fromWallet.length || Number(fromWallet[0].balance) < fromAmount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Calculate exchange rate and fee
    const exchangeRate = toAmount / fromAmount;
    const fee = fromAmount * 0.001; // 0.1% fee

    // Generate transaction ID
    const transactionId = `EXC${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const now = new Date();

    // Start transaction
    await db.transaction(async (tx) => {
      // Create exchange transaction record
      await tx.insert(exchangeTransactions).values({
        id: uuidv4(),
        userAddress,
        fromCurrency,
        toCurrency,
        fromAmount: fromAmount.toString(),
        toAmount: toAmount.toString(),
        exchangeRate: exchangeRate.toString(),
        fee: fee.toString(),
        status: "completed",
        transactionId,
        completedAt: now,
      });

      // Update from wallet (subtract amount + fee)
      const newFromBalance = Number(fromWallet[0].balance) - fromAmount - fee;
      await tx
        .update(userWallets)
        .set({
          balance: newFromBalance.toString(),
          updatedAt: now,
        })
        .where(and(
          eq(userWallets.userAddress, userAddress),
          eq(userWallets.currency, fromCurrency)
        ));

      // Update or create to wallet (add amount)
      const toWallet = await tx
        .select()
        .from(userWallets)
        .where(and(
          eq(userWallets.userAddress, userAddress),
          eq(userWallets.currency, toCurrency)
        ))
        .limit(1);

      if (toWallet.length) {
        const newToBalance = Number(toWallet[0].balance) + toAmount;
        await tx
          .update(userWallets)
          .set({
            balance: newToBalance.toString(),
            updatedAt: now,
          })
          .where(and(
            eq(userWallets.userAddress, userAddress),
            eq(userWallets.currency, toCurrency)
          ));
      } else {
        await tx.insert(userWallets).values({
          id: uuidv4(),
          userAddress,
          currency: toCurrency,
          balance: toAmount.toString(),
          chain: getChainForCurrency(toCurrency),
        });
      }

      // Create crypto transaction records
      await tx.insert(cryptoTransactions).values({
        id: uuidv4(),
        transactionId: `${transactionId}_FROM`,
        userAddress,
        transactionType: "exchange",
        currency: fromCurrency,
        amount: `-${(fromAmount + fee).toString()}`,
        fee: fee.toString(),
        status: "completed",
        completedAt: now,
      });

      await tx.insert(cryptoTransactions).values({
        id: uuidv4(),
        transactionId: `${transactionId}_TO`,
        userAddress,
        transactionType: "exchange",
        currency: toCurrency,
        amount: toAmount.toString(),
        status: "completed",
        completedAt: now,
      });
    });

    const exchangeResult = {
      id: transactionId,
      userAddress,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      exchangeRate,
      fee,
      status: "completed",
      createdAt: now.toISOString(),
      completedAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: "Exchange completed successfully",
      exchange: exchangeResult,
    });
  } catch (error) {
    console.error("Error executing exchange:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getChainForCurrency(currency: string): string {
  const chains: { [key: string]: string } = {
    BTC: "bitcoin",
    ETH: "ethereum",
    USDT: "ethereum",
    SOL: "solana",
    XRP: "xrpl",
  };
  return chains[currency] || "unknown";
}