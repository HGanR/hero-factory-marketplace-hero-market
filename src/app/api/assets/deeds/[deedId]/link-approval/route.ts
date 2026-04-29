import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, resolutions, minutes, minuteBooks } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { insertAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;
    const body = await req.json();
    const { approvingResolutionId } = body;

    if (!approvingResolutionId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "approvingResolutionId is required" } },
        { status: 400 }
      );
    }

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

    const resolutionRows = await db.select().from(resolutions).where(eq(resolutions.id, approvingResolutionId)).limit(1);
    if (resolutionRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Resolution not found" } }, { status: 404 });
    }

    const resolution = resolutionRows[0];

    // Fetch minutes and minuteBook to verify context match
    const minutesRows = await db.select().from(minutes).where(eq(minutes.id, resolution.minutesId)).limit(1);
    if (minutesRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Minutes not found" } }, { status: 404 });
    }

    const minutesRecord = minutesRows[0];
    const minuteBookRows = await db.select().from(minuteBooks).where(eq(minuteBooks.id, minutesRecord.minuteBookId)).limit(1);
    if (minuteBookRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Minute book not found" } }, { status: 404 });
    }

    const minuteBook = minuteBookRows[0];

    // Enforce context match: deed(trustId/entityId) must match minuteBook(trustId/entityId)
    if (deed.trustId && minuteBook.trustId !== deed.trustId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONTEXT_MISMATCH",
            message: "Resolution belongs to a different trust. Deed and resolution must share the same trustId.",
          },
        },
        { status: 400 }
      );
    }

    if (deed.entityId && minuteBook.entityId !== deed.entityId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CONTEXT_MISMATCH",
            message: "Resolution belongs to a different entity. Deed and resolution must share the same entityId.",
          },
        },
        { status: 400 }
      );
    }

    await db
      .update(deeds)
      .set({
        approvingResolutionId: approvingResolutionId,
        approvingMinutesId: resolution.minutesId,
      })
      .where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "LINK_APPROVAL",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        approvingResolutionId,
        approvingMinutesId: resolution.minutesId,
      },
    });

    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Link approval error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to link approval" } },
      { status: 500 }
    );
  }
}
