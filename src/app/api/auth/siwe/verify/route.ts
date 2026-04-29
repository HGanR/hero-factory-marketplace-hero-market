import { NextRequest, NextResponse } from "next/server";
import { recoverAddress, hashMessage } from "viem";
import { createToken } from "@/lib/auth";
import { sessionCookieBase } from "@/lib/auth-cookie-options";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { message, signature, nonce } = await request.json();

    if (!message || !signature || !nonce) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Basic SIWE message validation
    if (!message.includes(`Nonce: ${nonce}`)) {
      return NextResponse.json({ error: "Invalid nonce" }, { status: 400 });
    }

    // Extract address from message (basic parsing)
    const addressMatch = message.match(/([0-9a-fA-Fx]{42})/);
    if (!addressMatch) {
      return NextResponse.json({ error: "Invalid address in message" }, { status: 400 });
    }

    const address = addressMatch[0].toLowerCase();

    // Verify signature
    try {
      const messageHash = hashMessage(message);
      const recoveredAddress = await recoverAddress({
        hash: messageHash,
        signature: signature as `0x${string}`,
      });

      if (recoveredAddress.toLowerCase() !== address) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }

    // Find or create user
    const db = await getDb();
    let user = await db
      .select()
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.walletAddress, address))
      .limit(1);

    let userId: number;

    if (user.length === 0) {
      // Create new user
      const result = await db.insert(marketplaceUsers).values({
        email: `${address}@wallet.local`, // Placeholder email
        username: address.slice(2, 10), // First 8 chars of address
        walletAddress: address,
        isActive: true,
        isApproved: true,
        hasTokenAccess: true,
      });

      // Get the inserted user ID (this depends on your database setup)
      user = await db
        .select()
        .from(marketplaceUsers)
        .where(eq(marketplaceUsers.walletAddress, address))
        .limit(1);

      if (user.length === 0) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      userId = user[0].id;
    } else {
      userId = user[0].id;
    }

    // Create JWT token
    const token = createToken({ userId, address });

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        address,
      }
    });

    response.cookies.set("auth-token", token, {
      ...sessionCookieBase(),
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;

  } catch (error) {
    console.error('SIWE verification error:', error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}







