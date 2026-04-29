import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolutions, approvals } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ resolutionId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { resolutionId } = await ctx.params;
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
          signatureHash: signatureHash || sha256Hex(`${userId}-${resolutionId}-${Date.now()}`),
        })
        .where(eq(approvals.id, approvalId));
    }

    // Check if all required approvals are met
    const allApprovals = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.targetType, "resolution"), eq(approvals.targetId, resolutionId)));

    const allApproved = allApprovals.every((a) => a.status === "approved");

    if (allApproved) {
      await db.update(resolutions).set({ status: "approved" }).where(eq(resolutions.id, resolutionId));
    }

    const updated = await db.select().from(resolutions).where(eq(resolutions.id, resolutionId)).limit(1);

    return NextResponse.json({ ok: true, resolution: updated[0], allApproved });
  } catch (error: any) {
    console.error("Approve resolution error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to approve resolution" } },
      { status: 500 }
    );
  }
}
