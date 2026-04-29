import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, or, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { insertAuditLog } from "@/lib/audit";

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

    const items = await db
      .select()
      .from(deeds)
      .where(trustId ? eq(deeds.trustId, trustId) : eq(deeds.entityId, entityId!))
      .orderBy(deeds.createdAt);

    // Fetch related data
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        const property = item.propertyId
          ? (await db.select().from(deedProperties).where(eq(deedProperties.id, item.propertyId)).limit(1))[0] || null
          : null;
        return { ...item, property };
      })
    );

    return NextResponse.json({ ok: true, items: itemsWithDetails });
  } catch (error: any) {
    console.error("List deeds error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to list deeds" } },
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
    const { clientId, trustId, entityId, deedType } = body;

    if (!clientId || !deedType) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "clientId and deedType are required" } },
        { status: 400 }
      );
    }

    // Enforce "exactly one of trustId/entityId"
    const hasTrust = !!trustId;
    const hasEntity = !!entityId;
    if (hasTrust === hasEntity) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Exactly one of trustId or entityId is required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const deedId = uuidv4();
    await db.insert(deeds).values({
      id: deedId,
      clientId,
      trustId: trustId || null,
      entityId: entityId || null,
      deedType,
      status: "draft",
      createdBy: userId,
    });

    // Create instrument record if feature is enabled
    if (process.env.INSTRUMENTS_ENABLED !== "false") {
      try {
        const { createInstrumentForDeed } = await import("@/lib/instruments/instrument-factory");
        await createInstrumentForDeed(deedId, {
          trustId: trustId || null,
          entityId: entityId || null,
        });
      } catch (error) {
        // Log but don't fail deed creation if instrument creation fails
        console.error("Failed to create instrument for deed:", error);
      }
    }

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "CREATE_DEED",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        deedType,
        trustId: trustId || null,
        entityId: entityId || null,
      },
    });

    const created = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: created[0] });
  } catch (error: any) {
    console.error("Create deed error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to create deed" } },
      { status: 500 }
    );
  }
}
