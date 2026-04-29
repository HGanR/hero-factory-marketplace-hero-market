import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { assertDeedHasApprovedAuthority } from "@/lib/deeds/gating";
import { validateDeedStatusTransition } from "@/lib/deeds/state-machine";
import { insertAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;

    const gate = await assertDeedHasApprovedAuthority(deedId);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: { code: gate.code, message: gate.message } },
        { status: 400 }
      );
    }

    // Enforce monotonic state transition
    const transitionCheck = validateDeedStatusTransition(gate.deed.status as any, "approved");
    if (!transitionCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: transitionCheck.code, message: transitionCheck.message } },
        { status: 400 }
      );
    }

    const db = await getDb();

    await db.update(deeds).set({ status: "approved" }).where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "MARK_DEED_APPROVED",
      entityType: "deed",
      entityId: deedId,
      metadata: { approvingResolutionId: gate.deed.approvingResolutionId },
    });

    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Mark approved error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to mark approved" } },
      { status: 500 }
    );
  }
}
