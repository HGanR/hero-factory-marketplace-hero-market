import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties, deedParties, deedExecutions, deedRecordings, exhibits } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { hashMinutesRecord } from "@/lib/governance/hash";
import { validateDeedStatusTransition } from "@/lib/deeds/state-machine";
import { insertAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;

    const db = await getDb();

    const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
    if (deedRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Deed not found" } }, { status: 404 });
    }

    const deed = deedRows[0];

    // Enforce "exactly one of trustId/entityId"
    if ((deed.trustId && deed.entityId) || (!deed.trustId && !deed.entityId)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Deed must have exactly one of trustId or entityId" } },
        { status: 400 }
      );
    }

    // Locking rule: can only lock when status is RECORDED (or EXECUTED if you want optional earlier locking)
    // Note: "locked" is not a status enum, but we validate the transition
    const allowedStatusesForLock = ["recorded", "executed"];
    if (!allowedStatusesForLock.includes(deed.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: `Deed can only be locked when status is 'recorded' or 'executed'. Current status: ${deed.status}`,
          },
        },
        { status: 400 }
      );
    }

    if (deed.lockedAt) {
      return NextResponse.json(
        { ok: false, error: { code: "ALREADY_LOCKED", message: "Deed is already locked" } },
        { status: 409 }
      );
    }

    // Fetch all related data for hashing
    const [propertyRows, partyRows, executionRows, recordingRows] = await Promise.all([
      deed.propertyId ? db.select().from(deedProperties).where(eq(deedProperties.id, deed.propertyId)).limit(1) : Promise.resolve([]),
      db.select().from(deedParties).where(eq(deedParties.deedId, deedId)),
      deed.executionId ? db.select().from(deedExecutions).where(eq(deedExecutions.id, deed.executionId)).limit(1) : Promise.resolve([]),
      deed.recordingId ? db.select().from(deedRecordings).where(eq(deedRecordings.id, deed.recordingId)).limit(1) : Promise.resolve([]),
    ]);

    // Fetch exhibits (including recording receipt if present)
    const exhibitIds = [
      deed.draftPdfExhibitId,
      deed.executedPdfExhibitId,
      recordingRows[0]?.recordingReceiptExhibitId,
    ].filter(Boolean) as string[];
    const exhibitRows = exhibitIds.length > 0
      ? await Promise.all(exhibitIds.map((id) => db.select().from(exhibits).where(eq(exhibits.id, id)).limit(1)))
      : [];

    // Hash strategy: Include all core fields, snapshots, approval IDs, and exhibit hashes (not just IDs)
    const payload = {
      // Deed core fields
      id: deed.id,
      clientId: deed.clientId,
      trustId: deed.trustId,
      entityId: deed.entityId,
      deedType: deed.deedType,
      status: deed.status,
      approvingResolutionId: deed.approvingResolutionId,
      approvingMinutesId: deed.approvingMinutesId,
      // Property snapshot
      property: propertyRows[0] || null,
      // Parties snapshot
      parties: partyRows,
      // Execution snapshot
      execution: executionRows[0] || null,
      // Recording snapshot
      recording: recordingRows[0] || null,
      // Exhibit hashes (not just IDs) - critical for integrity
      exhibits: exhibitRows.map((e) => e[0]).filter(Boolean).map((ex) => ({
        id: ex.id,
        hash: ex.hash, // Include hash, not just ID
        fileName: ex.fileName,
        fileType: ex.fileType,
      })),
      // Version/timestamp identifiers
      createdAt: deed.createdAt,
      updatedAt: deed.updatedAt,
      lockedAt: new Date().toISOString(),
    };

    const finalHash = hashMinutesRecord(payload);

    await db
      .update(deeds)
      .set({
        lockedAt: new Date(),
        finalHash,
      })
      .where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "LOCK_DEED",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        finalHash,
        status: deed.status,
      },
    });

    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Lock deed error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to lock deed" } },
      { status: 500 }
    );
  }
}
