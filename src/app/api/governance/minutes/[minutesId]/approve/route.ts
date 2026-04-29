import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minutes, approvals } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ minutesId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { minutesId } = await ctx.params;
    const body = await req.json();
    const { approvalId, signatureHash } = body;

    const db = await getDb();

    // Update the approval
    if (approvalId) {
      await db
        .update(approvals)
        .set({
          status: "approved",
          approverId: userId,
          approvedAt: new Date(),
          signatureHash: signatureHash || sha256Hex(`${userId}-${minutesId}-${Date.now()}`),
        })
        .where(eq(approvals.id, approvalId));
    }

    // Check if all required approvals are met
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.targetType, "minutes"), eq(approvals.targetId, minutesId)));

    const allApproved = allApprovals.every((a) => a.status === "approved");

    if (allApproved) {
      await db
        .update(minutes)
        .set({
          status: "approved",
          approvedAt: new Date(),
        })
        .where(eq(minutes.id, minutesId));
    }

    const updated = await db.select().from(minutes).where(eq(minutes.id, minutesId)).limit(1);

    return NextResponse.json({ ok: true, minutes: updated[0], allApproved });
  } catch (error: any) {
    console.error("Approve minute error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to approve minute" } },
      { status: 500 }
    );
  }
}
