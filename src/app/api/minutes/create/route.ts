import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minuteBooks, minutes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, entityId, trustId, entityType, recordType, title, actionDate, location, calledBy, chair } = body;

    if (!clientId || (!entityId && !trustId)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "clientId and either entityId or trustId required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Find or create minute book
    let minuteBook = await db
      .select()
      .from(minuteBooks)
      .where(
        and(
          eq(minuteBooks.clientId, clientId),
          entityId ? eq(minuteBooks.entityId, entityId) : eq(minuteBooks.trustId, trustId!)
        )
      )
      .limit(1);

    let minuteBookId: string;
    if (minuteBook.length === 0) {
      minuteBookId = uuidv4();
      await db.insert(minuteBooks).values({
        id: minuteBookId,
        clientId,
        entityId: entityId || null,
        trustId: trustId || null,
        entityType: entityType || "Trust",
        createdBy: userId,
      });
    } else {
      minuteBookId = minuteBook[0].id;
    }

    // Create minute record
    const minuteId = uuidv4();
    await db.insert(minutes).values({
      id: minuteId,
      minuteBookId,
      recordType: recordType || "meeting",
      title,
      actionDate,
      location: location || null,
      calledBy: calledBy || null,
      chair: chair || null,
      quorumRequired: recordType === "written_consent" ? false : true,
      quorumMet: false,
      status: "draft",
      createdBy: userId,
    });

    return NextResponse.json({ ok: true, minuteId, minuteBookId });
  } catch (error: any) {
    console.error("Create minute error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to create minute" } },
      { status: 500 }
    );
  }
}
