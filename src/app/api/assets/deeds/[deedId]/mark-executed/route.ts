import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedExecutions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { assertDeedHasApprovedAuthority } from "@/lib/deeds/gating";
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
      method,
      signDate,
      notarized,
      witnessesRequired,
      witnessesCount,
      notaryName,
      notaryCommission,
      notaryState,
      acknowledgementText,
      executedPdfExhibitId,
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

    // Gate: must have approved authority
    const gate = await assertDeedHasApprovedAuthority(deedId);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: { code: gate.code, message: gate.message } },
        { status: 400 }
      );
    }

    // Enforce monotonic state transition
    const transitionCheck = validateDeedStatusTransition(gate.deed.status as any, "executed");
    if (!transitionCheck.ok) {
      return NextResponse.json(
        { ok: false, error: { code: transitionCheck.code, message: transitionCheck.message } },
        { status: 400 }
      );
    }

    // Create or update execution record
    // Note: If deed is already recorded, execution is immutable (read-only)
    let executionId = deed.executionId;
    if (executionId) {
      // If already recorded, execution is immutable
      if (deed.status === "recorded") {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "EXECUTION_IMMUTABLE",
              message: "Execution details are immutable after deed is recorded",
            },
          },
          { status: 409 }
        );
      }

      await db
        .update(deedExecutions)
        .set({
          method: method || "WET_IN_PERSON",
          signDate: signDate ? new Date(signDate) : null,
          notarized: notarized ?? false,
          witnessesRequired: witnessesRequired ?? false,
          witnessesCount: witnessesCount ?? 0,
          notaryName: notaryName || null,
          notaryCommission: notaryCommission || null,
          notaryState: notaryState || null,
          acknowledgementText: acknowledgementText || null,
        })
        .where(eq(deedExecutions.id, executionId));
    } else {
      executionId = uuidv4();
      await db.insert(deedExecutions).values({
        id: executionId,
        method: method || "WET_IN_PERSON",
        signDate: signDate ? new Date(signDate) : null,
        notarized: notarized ?? false,
        witnessesRequired: witnessesRequired ?? false,
        witnessesCount: witnessesCount ?? 0,
        notaryName: notaryName || null,
        notaryCommission: notaryCommission || null,
        notaryState: notaryState || null,
        acknowledgementText: acknowledgementText || null,
      });

      await db.update(deeds).set({ executionId }).where(eq(deeds.id, deedId));
    }

    // Update deed status and executed PDF exhibit
    await db
      .update(deeds)
      .set({
        status: "executed",
        executedPdfExhibitId: executedPdfExhibitId || null,
      })
      .where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "MARK_DEED_EXECUTED",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        executionId,
        method,
        notarized,
        executedPdfExhibitId: executedPdfExhibitId || null,
      },
    });

    // Update instrument status if feature is enabled
    if (process.env.INSTRUMENTS_ENABLED !== "false") {
      try {
        const { updateInstrumentStatusForDeed } = await import("@/lib/instruments/instrument-factory");
        await updateInstrumentStatusForDeed(deedId, "executed");
      } catch (error) {
        // Log but don't fail execution if instrument update fails
        console.error("Failed to update instrument status:", error);
      }
    }

    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Mark executed error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to mark executed" } },
      { status: 500 }
    );
  }
}
