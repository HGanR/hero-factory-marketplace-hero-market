import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minutes, minuteParticipants, resolutions, resolutionVotes, exhibits, approvals } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { hashMinutesRecord } from "@/lib/governance/hash";

export async function POST(req: NextRequest, ctx: { params: Promise<{ minutesId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { minutesId } = await ctx.params;

    const db = await getDb();

    const minutesRows = await db.select().from(minutes).where(eq(minutes.id, minutesId)).limit(1);

    if (minutesRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Minutes not found" } }, { status: 404 });
    }

    const minutesRecord = minutesRows[0];

    if (minutesRecord.status !== "approved") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Minutes must be approved before locking" } },
        { status: 400 }
      );
    }

    // Fetch all related data for hashing
    const [participantRows, resolutionRows, approvalRows] = await Promise.all([
      db.select().from(minuteParticipants).where(eq(minuteParticipants.minutesId, minutesId)),
      db.select().from(resolutions).where(eq(resolutions.minutesId, minutesId)),
      db.select().from(approvals).where(and(eq(approvals.targetType, "minutes"), eq(approvals.targetId, minutesId))),
    ]);

    // Fetch votes and exhibits for each resolution
    const resolutionsWithDetails = await Promise.all(
      resolutionRows.map(async (res) => {
        const [votes, resExhibits, resApprovals] = await Promise.all([
          db.select().from(resolutionVotes).where(eq(resolutionVotes.resolutionId, res.id)),
          db.select().from(exhibits).where(eq(exhibits.resolutionId, res.id)),
          db.select().from(approvals).where(and(eq(approvals.targetType, "resolution"), eq(approvals.targetId, res.id))),
        ]);
        return { ...res, votes, exhibits: resExhibits, approvals: resApprovals };
      })
    );

    const [exhibitRows] = await Promise.all([
      db.select().from(exhibits).where(eq(exhibits.minutesId, minutesId)),
    ]);

    const payload = {
      ...minutesRecord,
      participants: participantRows,
      resolutions: resolutionsWithDetails,
      exhibits: exhibitRows,
      approvals: approvalRows,
    };

    const finalHash = hashMinutesRecord(payload);

    await db
      .update(minutes)
      .set({
        status: "locked",
        finalizedAt: new Date(),
        hash: finalHash,
      })
      .where(eq(minutes.id, minutesId));

    const updated = await db.select().from(minutes).where(eq(minutes.id, minutesId)).limit(1);

    return NextResponse.json({ ok: true, minutes: updated[0] });
  } catch (error: any) {
    console.error("Lock minute error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to lock minute" } },
      { status: 500 }
    );
  }
}
