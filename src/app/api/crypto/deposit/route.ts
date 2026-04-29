import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cryptoTransactions, userWallets } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Crypto Deposit API
 * POST /api/crypto/deposit
 *
 * Initiates a deposit request
 */

export async function POST(req: NextRequest) {
  // Admin-only endpoint - wallet operations require admin privileges
  const isAdmin = req.headers.get("cookie")?.includes("adminLoggedIn=true") ||
                  req.headers.get("x-admin-auth") === "true";
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Access denied. Admin privileges required for deposit operations." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const {
      userAddress,
      currency,
      amount,
      fromAddress,
    } = body;

    // Validation
    if (!userAddress || !currency || !amount || !fromAddress) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["userAddress", "currency", "amount", "fromAddress"],
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

    // Generate transaction ID
    const transactionId = `DEP${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create deposit transaction record
    await db.insert(cryptoTransactions).values({
      id: uuidv4(),
      transactionId,
      userAddress,
      transactionType: "deposit",
      currency,
      amount: amount.toString(),
      status: "pending",
      fromAddress,
      chain: getChainForCurrency(currency),
    });

    return NextResponse.json({
      success: true,
      message: "Deposit request created successfully",
      transactionId,
      status: "pending",
    });
  } catch (error) {
    console.error("Error creating deposit:", error);
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