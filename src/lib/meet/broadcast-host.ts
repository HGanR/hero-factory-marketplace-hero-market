import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { BROADCAST_CODES } from "./broadcast-codes";

export type BroadcastHostDeny = {
  ok: false;
  status: number;
  error: string;
  code: typeof BROADCAST_CODES.userNotFound | typeof BROADCAST_CODES.hostMismatch;
};
export type BroadcastHostOk = { ok: true };
export type BroadcastHostResult = BroadcastHostOk | BroadcastHostDeny;

/**
 * Ensures the authed marketplace user may control /meet broadcast.
 * When `hostWallet` is provided and the account has a linked wallet, they must match (case-insensitive).
 */
export async function assertMeetBroadcastHost(
  userId: number,
  hostWallet?: string | null
): Promise<BroadcastHostResult> {
  const db = await getDb();
  const rows = await db
    .select({ walletAddress: marketplaceUsers.walletAddress })
    .from(marketplaceUsers)
    .where(eq(marketplaceUsers.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      status: 403,
      error: "User not found",
      code: BROADCAST_CODES.userNotFound,
    };
  }
  const hw = (hostWallet ?? "").trim().toLowerCase();
  const dbw = (row.walletAddress ?? "").trim().toLowerCase();
  if (hw && dbw && hw !== dbw) {
    return {
      ok: false,
      status: 403,
      error:
        "Connected wallet does not match the wallet on your Troo account. Use the same wallet or update your profile.",
      code: BROADCAST_CODES.hostMismatch,
    };
  }
  return { ok: true };
}
