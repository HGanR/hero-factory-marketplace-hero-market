import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { minuteBooks, resolutions, minutes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, or, like } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const trustId = searchParams.get("trustId");
    const entityId = searchParams.get("entityId");
    const q = searchParams.get("q")?.trim() || "";

    if (!trustId && !entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId or entityId is required" } },
        { status: 400 }
      );
    }

    if (trustId && entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Provide only one of trustId or entityId" } },
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

    // Build query for eligible resolutions
    const whereConditions = [
      eq(resolutions.status, "approved"),
      eq(minutes.minuteBookId, minuteBook.id),
      or(eq(minutes.status, "approved"), eq(minutes.status, "locked")),
    ];

    if (q) {
      whereConditions.push(
        or(like(resolutions.title, `%${q}%`), like(resolutions.counterparty, `%${q}%`))
      );
    }

    const resolutionRows = await db
      .select({
        resolution: resolutions,
        minutes: minutes,
      })
      .from(resolutions)
      .innerJoin(minutes, eq(resolutions.minutesId, minutes.id))
      .where(and(...whereConditions))
      .limit(50);

    const items = resolutionRows.map((r) => ({
      id: r.resolution.id,
      title: r.resolution.title,
      resolutionType: r.resolution.resolutionType,
      effectiveDate: r.resolution.effectiveDate,
      counterparty: r.resolution.counterparty,
      minutes: {
        id: r.minutes.id,
        title: r.minutes.title,
        actionDate: r.minutes.actionDate,
        status: r.minutes.status,
      },
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error: any) {
    console.error("List eligible resolutions error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to list eligible resolutions" } },
      { status: 500 }
    );
  }
}
