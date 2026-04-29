import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedRecordings } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { validateDeedStatusTransition } from "@/lib/deeds/state-machine";
import { insertAuditLog } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;
    const body = await req.json();
    const {
      status,
      county,
      state,
      submittedAt,
      recordedAt,
      instrumentNumber,
      book,
      page,
      rejectionReason,
      recordingReceiptExhibitId,
    } = body;

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

    // Locking rule: cannot edit locked deeds
    if (deed.lockedAt) {
      return NextResponse.json(
        { ok: false, error: { code: "LOCKED", message: "Deed is locked and cannot be edited" } },
        { status: 409 }
      );
    }

    // Require executedPdfExhibitId before marking as recorded
    if (!deed.executedPdfExhibitId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_EXECUTED_EXHIBIT",
            message: "An executed deed exhibit (executedPdfExhibitId) is required before marking as recorded",
          },
        },
        { status: 400 }
      );
    }

    // Enforce monotonic state transition
    const transitionCheck = validateDeedStatusTransition(deed.status as any, "recorded");
    if (!transitionCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: transitionCheck.code, message: transitionCheck.message } },
        { status: 400 }
      );
    }

    // Create or update recording record
    let recordingId = deed.recordingId;
    if (recordingId) {
      await db
        .update(deedRecordings)
        .set({
          status: status || "NOT_SUBMITTED",
          county: county || null,
          state: state || null,
          submittedAt: submittedAt ? new Date(submittedAt) : null,
          recordedAt: recordedAt ? new Date(recordedAt) : null,
          instrumentNumber: instrumentNumber || null,
          book: book || null,
          page: page || null,
          rejectionReason: rejectionReason || null,
          recordingReceiptExhibitId: recordingReceiptExhibitId || null, // Recording receipt exhibit
        })
        .where(eq(deedRecordings.id, recordingId));
    } else {
      recordingId = uuidv4();
      await db.insert(deedRecordings).values({
        id: recordingId,
        status: status || "NOT_SUBMITTED",
        county: county || null,
        state: state || null,
        submittedAt: submittedAt ? new Date(submittedAt) : null,
        recordedAt: recordedAt ? new Date(recordedAt) : null,
        instrumentNumber: instrumentNumber || null,
        book: book || null,
        page: page || null,
        rejectionReason: rejectionReason || null,
        recordingReceiptExhibitId: recordingReceiptExhibitId || null,
      });

      await db.update(deeds).set({ recordingId }).where(eq(deeds.id, deedId));
    }

    // Update deed status if recorded
    const newStatus = status === "RECORDED" ? "recorded" : deed.status;
    await db.update(deeds).set({ status: newStatus }).where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "MARK_DEED_RECORDED",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        recordingId,
        status,
        instrumentNumber: instrumentNumber || null,
        recordedAt: recordedAt || null,
      },
    });

    // Update instrument status if feature is enabled
    let instrumentId: string | null = null;
    if (process.env.INSTRUMENTS_ENABLED !== "false") {
      try {
        const { updateInstrumentStatusForDeed } = await import("@/lib/instruments/instrument-factory");
        await updateInstrumentStatusForDeed(deedId, newStatus);
        
        // Get instrument ID for witness anchoring
        const updatedDeed = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
        if (updatedDeed.length > 0 && updatedDeed[0].instrumentId) {
          instrumentId = updatedDeed[0].instrumentId;
        }
      } catch (error) {
        // Log but don't fail recording if instrument update fails
        console.error("Failed to update instrument status:", error);
      }
    }

    // Optionally trigger witness anchoring (async, non-blocking)
    // This happens after recording is complete, so it doesn't block the recording workflow
    if (instrumentId && process.env.WITNESS_ENABLED !== "false" && newStatus === "recorded") {
      // Fire and forget - witness anchoring is optional and async
      import("@/lib/instruments/witness-adapter")
        .then(({ notarizeInstrumentAsWitness }) => {
          return notarizeInstrumentAsWitness(instrumentId!);
        })
        .then((result) => {
          console.log(`Witness notarized for instrument ${instrumentId}: ${result.txHash}`);
        })
        .catch((error) => {
          // Log but don't fail - witness is optional
          console.error(`Failed to notarize witness for instrument ${instrumentId}:`, error);
        });
    }

    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Mark recorded error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to mark recorded" } },
      { status: 500 }
    );
  }
}
