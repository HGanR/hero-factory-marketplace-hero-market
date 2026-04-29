import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { authNonces } from "@/lib/db/schema";
import { ensureAuthNoncesTable } from "@/lib/auth/nonce-db";

const NONCE_EXPIRY_MINUTES = 10;

/**
 * GET /api/auth/nonce?wallet=0x...
 * Returns a fresh nonce for signed message verification.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.trim();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureAuthNoncesTable(db);

    const nonce = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    await db
      .insert(authNonces)
      .values({
        walletAddress: wallet,
        nonce,
        expiresAt,
      })
      .onDuplicateKeyUpdate({
        set: { nonce, expiresAt },
      });

    return NextResponse.json({ nonce, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    console.error("[auth/nonce]", err);
    return NextResponse.json({ error: "Failed to create nonce" }, { status: 500 });
  }
}
