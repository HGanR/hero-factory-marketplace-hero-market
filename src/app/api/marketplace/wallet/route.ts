// src/app/api/marketplace/wallet/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { walletAddress, hasTokenAccess } = await request.json();

    const db = await getDb();

    await db
      .update(marketplaceUsers)
      .set({ walletAddress, hasTokenAccess })
      .where(eq(marketplaceUsers.id, decoded.userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update wallet error:", error);
    return NextResponse.json(
      { error: "Failed to update wallet" },
      { status: 500 }
    );
  }
}

