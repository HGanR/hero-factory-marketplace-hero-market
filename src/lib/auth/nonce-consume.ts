import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authNonces } from "@/lib/db/schema";
import { ensureAuthNoncesTable } from "./nonce-db";

/**
 * Verify nonce exists, not expired, then delete it (one-time use).
 */
export async function consumeNonce(walletAddress: string, nonce: string): Promise<boolean> {
  try {
    const db = await getDb();
    await ensureAuthNoncesTable(db);

    const [row] = await db
      .select()
      .from(authNonces)
      .where(and(eq(authNonces.walletAddress, walletAddress), eq(authNonces.nonce, nonce), gt(authNonces.expiresAt, new Date())))
      .limit(1);

    if (!row) return false;

    await db.delete(authNonces).where(eq(authNonces.walletAddress, walletAddress));
    return true;
  } catch {
    return false;
  }
}
