import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoTransactions, userWallets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Crypto Withdraw API
 * POST /api/crypto/withdraw
 *
 * Initiates a withdrawal request
 */

export async function POST(req: NextRequest) {
  // Admin-only endpoint - wallet operations require admin privileges
  const isAdmin = req.headers.get("cookie")?.includes("adminLoggedIn=true") ||
                  req.headers.get("x-admin-auth") === "true";
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required for withdrawal operations." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      userAddress,
      currency,
      amount,
      toAddress,
    } = body;

    // Validation
    if (!userAddress || !currency || !amount || !toAddress) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["userAddress", "currency", "amount", "toAddress"],
        },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if user has sufficient balance
    const wallet = await db
      .select()
      .from(userWallets)
      .where(and(
        eq(userWallets.userAddress, userAddress),
        eq(userWallets.currency, currency)
      ))
      .limit(1);

    if (!wallet.length || Number(wallet[0].balance) < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Calculate fee (0.1% for withdrawals)
    const fee = amount * 0.001;

    // Generate transaction ID
    const transactionId = `WDR${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Start transaction
    await db.transaction(async (tx) => {
      // Lock the amount in wallet
      const newLockedBalance = Number(wallet[0].lockedBalance) + amount + fee;
      await tx
        .update(userWallets)
        .set({
          lockedBalance: newLockedBalance.toString(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(userWallets.userAddress, userAddress),
          eq(userWallets.currency, currency)
        ));

      // Create withdrawal transaction record
      await tx.insert(cryptoTransactions).values({
        id: uuidv4(),
        transactionId,
        userAddress,
        transactionType: "withdraw",
        currency,
        amount: `-${amount.toString()}`,
        fee: fee.toString(),
        status: "pending",
        toAddress,
        chain: getChainForCurrency(currency),
      });
    });

    return NextResponse.json({
      success: true,
      message: "Withdrawal request created successfully",
      transactionId,
      status: "pending",
      fee,
    });
  } catch (error) {
    console.error("Error creating withdrawal:", error);
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