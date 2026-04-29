import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminLogs, marketplaceUsers } from "@/lib/db/schema";
import { resolveNpcAdminSession } from "@/lib/admin/require-npc-admin";

export async function POST(request: NextRequest) {
  try {
    if (!(await resolveNpcAdminSession(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      userId?: unknown;
      revenueOsAccess?: unknown;
    };
    const userId = Number(body.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const revenueOsAccess = Boolean(body.revenueOsAccess);

    const db = await getDb();
    const rows = await db.select().from(marketplaceUsers).where(eq(marketplaceUsers.id, userId)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const prev = rows[0]!;

    await db.update(marketplaceUsers).set({ revenueOsAccess }).where(eq(marketplaceUsers.id, userId));

    await db.insert(adminLogs).values({
      adminId: 0,
      action: "TOGGLE_REVENUE_OS_ACCESS",
      targetUserId: userId,
      targetEmail: prev.email,
      details: JSON.stringify({
        before: prev.revenueOsAccess ?? null,
        after: revenueOsAccess,
        at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ success: true, revenueOsAccess });
  } catch (error) {
    console.error("toggle-revenue-os-access:", error);
    return NextResponse.json({ error: "Failed to update Revenue OS access" }, { status: 500 });
  }
}
