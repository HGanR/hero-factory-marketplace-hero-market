import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { entityOnboardings, adminLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAdminApiDecoded } from "@/lib/admin/admin-api-request-auth";

export async function POST(request: NextRequest) {
  try {
    if (!getAdminApiDecoded(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const onboardingId = Number(body?.onboardingId);
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "Missing required documents";

    if (!Number.isFinite(onboardingId) || onboardingId <= 0) {
      return NextResponse.json({ error: "Invalid onboardingId" }, { status: 400 });
    }

    const db = await getDb();

    const rows = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.id, onboardingId))
      .limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(entityOnboardings)
      .set({
        isRevoked: true,
        revokedReason: reason,
        onboardingStatus: "revoked",
      })
      .where(eq(entityOnboardings.id, onboardingId));

    // log admin action
    await db.insert(adminLogs).values({
      adminId: 0,
      action: "REVOKE_ONBOARDING",
      targetUserId: rows[0].userId,
      details: `Revoked onboarding #${onboardingId}. Reason: ${reason}`,
    });

    const updated = await db
      .select()
      .from(entityOnboardings)
      .where(eq(entityOnboardings.id, onboardingId))
      .limit(1);

    return NextResponse.json({ onboarding: updated[0] });
  } catch (error) {
    console.error("Revoke onboarding error:", error);
    return NextResponse.json({ error: "Failed to revoke onboarding" }, { status: 500 });
  }
}


