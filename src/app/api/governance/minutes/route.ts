import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minuteBooks, minutes, resolutions, approvals } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, desc, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const trustId = searchParams.get("trustId");
    const entityId = searchParams.get("entityId");

    if (!trustId && !entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId or entityId is required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const minuteBookRows = await db
      .select()
      .from(minuteBooks)
      .where(trustId ? eq(minuteBooks.trustId, trustId) : eq(minuteBooks.entityId, entityId!))
      .limit(1);

    if (minuteBookRows.length === 0) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const minuteBook = minuteBookRows[0];

    const items = await db
      .select()
      .from(minutes)
      .where(eq(minutes.minuteBookId, minuteBook.id))
      .orderBy(desc(minutes.actionDate), desc(minutes.createdAt));

    // Fetch resolutions and approvals for each minute
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const [resolutionsList, approvalsList] = await Promise.all([
          db.select().from(resolutions).where(eq(resolutions.minutesId, item.id)),
          db.select().from(approvals).where(and(eq(approvals.targetType, "minutes"), eq(approvals.targetId, item.id))),
        ]);
        return { ...item, resolutions: resolutionsList, approvals: approvalsList };
      })
    );

    return NextResponse.json({ ok: true, items: itemsWithDetails });
  } catch (error: any) {
    console.error("List minutes error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to list minutes" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { minuteBookId, recordType, title, actionDate, actionTime, location, calledBy, chair, quorumRequired, agenda } = body;

    if (!minuteBookId || !recordType || !title || !actionDate) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "minuteBookId, recordType, title, actionDate are required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const minuteId = uuidv4();
    await db.insert(minutes).values({
      id: minuteId,
      minuteBookId,
      recordType: recordType === "WRITTEN_CONSENT" ? "written_consent" : "meeting",
      title,
      actionDate,
      actionTime: actionTime || null,
      location: location || null,
      calledBy: calledBy || null,
      chair: chair || null,
      quorumRequired: recordType === "WRITTEN_CONSENT" ? false : quorumRequired ?? true,
      quorumMet: recordType === "WRITTEN_CONSENT" ? true : false,
      agenda: agenda ? JSON.stringify(agenda) : null,
      status: "draft",
      createdBy: userId,
    });

    const created = await db.select().from(minutes).where(eq(minutes.id, minuteId)).limit(1);

    return NextResponse.json({ ok: true, minutes: created[0] });
  } catch (error: any) {
    console.error("Create minute error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to create minute" } },
      { status: 500 }
    );
  }
}
