import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minuteBooks } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, or, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, trustId, entityId, entityType } = body;

    if (!clientId || (!trustId && !entityId)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "clientId and (trustId or entityId) are required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const existing = await db
      .select()
      .from(minuteBooks)
      .where(
        and(
          eq(minuteBooks.clientId, clientId),
          trustId ? eq(minuteBooks.trustId, trustId) : eq(minuteBooks.entityId, entityId!),
          trustId ? isNull(minuteBooks.entityId) : isNull(minuteBooks.trustId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ ok: true, minuteBookId: existing[0].id });
    }

    const minuteBookId = uuidv4();
    await db.insert(minuteBooks).values({
      id: minuteBookId,
      clientId,
      entityId: entityId || null,
      trustId: trustId || null,
      entityType: entityType || "Trust",
      createdBy: userId,
    });

    return NextResponse.json({ ok: true, minuteBookId });
  } catch (error: any) {
    console.error("Ensure minute book error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to ensure minute book" } },
      { status: 500 }
    );
  }
}
