import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minutes, minuteBooks, minuteParticipants, resolutions, approvals } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { buildRequiredApprovalsForMinutes } from "@/lib/governance/approval-rules";
import { computeQuorum } from "@/lib/governance/quorum";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, ctx: { params: Promise<{ minutesId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { minutesId } = await ctx.params;

    const db = await getDb();

    const minutesRows = await db
      .select()
      .from(minutes)
      .where(eq(minutes.id, minutesId))
      .limit(1);

    if (minutesRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Minutes not found" } }, { status: 404 });
    }

    const minutesRecord = minutesRows[0];

    if (minutesRecord.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Only draft minutes can be submitted" } },
        { status: 400 }
      );
    }

    // Fetch related data
    const [minuteBookRows, participantRows, resolutionRows] = await Promise.all([
      db.select().from(minuteBooks).where(eq(minuteBooks.id, minutesRecord.minuteBookId)).limit(1),
      db.select().from(minuteParticipants).where(eq(minuteParticipants.minutesId, minutesId)),
      db.select().from(resolutions).where(eq(resolutions.minutesId, minutesId)),
    ]);

    if (minuteBookRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Minute book not found" } }, { status: 404 });
    }

    const minuteBook = minuteBookRows[0];
    const combinedMinutes = { ...minutesRecord, minuteBook, participants: participantRows, resolutions: resolutionRows };

    const quorum = computeQuorum(minutesRecord.recordType, participantRows);
    const requiredApprovals = buildRequiredApprovalsForMinutes(combinedMinutes as any);

    // Update minutes status
    await db
      .update(minutes)
      .set({
        status: "pending",
        submittedAt: new Date(),
        quorumRequired: minutesRecord.recordType !== "written_consent",
        quorumMet: quorum.quorumMet,
      })
      .where(eq(minutes.id, minutesId));

    // Generate approvals for minutes
    for (const ra of requiredApprovals.minutesApprovals) {
      await db.insert(approvals).values({
        id: uuidv4(),
        targetType: "minutes",
        targetId: minutesId,
        requiredRole: ra.requiredRole,
        status: "pending",
      });
    }

    // Generate approvals for resolutions
    for (const res of resolutionRows) {
      const resApprovals = requiredApprovals.resolutionApprovals(res as any);
      for (const ra of resApprovals) {
        await db.insert(approvals).values({
          id: uuidv4(),
          targetType: "resolution",
          targetId: res.id,
          requiredRole: ra.requiredRole,
          status: "pending",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Submit minute error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to submit minute" } },
      { status: 500 }
    );
  }
}
