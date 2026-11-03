import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runRevenueLoop } from "@/lib/executive-agent/revenue-loop";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Default daily; deliberately not registered in vercel.json until reviewed activation. */
export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalCronRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.SKIPPER_REVENUE_LOOP_ENABLED !== "true") return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  const adminUserId = Number(process.env.SKIPPER_REVENUE_LOOP_ADMIN_USER_ID);
  if (!Number.isSafeInteger(adminUserId) || adminUserId <= 0 || !process.env.ADMIN_USERNAME?.trim()) {
    return NextResponse.json({ error: "REVENUE_LOOP_OWNER_NOT_CONFIGURED" }, { status: 503 });
  }
  try {
    const db = await getDb();
    const [owner] = await db.select({ id: marketplaceUsers.id }).from(marketplaceUsers)
      .where(and(eq(marketplaceUsers.id, adminUserId), eq(marketplaceUsers.username, process.env.ADMIN_USERNAME.trim()))).limit(1);
    if (!owner) return NextResponse.json({ error: "REVENUE_LOOP_OWNER_MISMATCH" }, { status: 503 });
    return NextResponse.json({ ok: true, ...await runRevenueLoop(adminUserId) });
  } catch {
    return NextResponse.json({ error: "REVENUE_LOOP_FAILED", notice: "Transaction rolled back; operator inspection required." }, { status: 500 });
  }
}
/** Vercel native Cron invokes GET; both methods use identical secret authentication and enable gate. */
export const GET = POST;
