import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties, deedParties, resolutions, minutes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { insertAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
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

    // Fetch related data
    const [propertyRows, partyRows, resolutionRows, minutesRows] = await Promise.all([
      deed.propertyId ? db.select().from(deedProperties).where(eq(deedProperties.id, deed.propertyId)).limit(1) : Promise.resolve([]),
      db.select().from(deedParties).where(eq(deedParties.deedId, deedId)),
      deed.approvingResolutionId
        ? db.select().from(resolutions).where(eq(resolutions.id, deed.approvingResolutionId)).limit(1)
        : Promise.resolve([]),
      deed.approvingMinutesId ? db.select().from(minutes).where(eq(minutes.id, deed.approvingMinutesId)).limit(1) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      ok: true,
      deed: {
        ...deed,
        property: propertyRows[0] || null,
        parties: partyRows,
        approvingResolution: resolutionRows[0] || null,
        approvingMinutes: minutesRows[0] || null,
      },
    });
  } catch (error: any) {
    console.error("Get deed error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to get deed" } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;
    const body = await req.json();

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

    // Execution immutable after recording
    if (deed.status === "recorded" && body.execution) {
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

    if (deed.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Only draft deeds can be edited" } },
        { status: 400 }
      );
    }

    const { property, parties, deedType } = body;
    const allowedDeedTypes = new Set([
      "QUITCLAIM",
      "WARRANTY_GENERAL",
      "WARRANTY_SPECIAL",
      "GRANT",
      "TRUST_TRANSFER",
      "OTHER",
    ]);

    if (deedType) {
      if (!allowedDeedTypes.has(String(deedType))) {
        return NextResponse.json(
          { ok: false, error: { code: "BAD_REQUEST", message: "Invalid deed type" } },
          { status: 400 }
        );
      }
      if (deedType !== deed.deedType) {
        await db.update(deeds).set({ deedType }).where(eq(deeds.id, deedId));
        await insertAuditLog(db, {
          actorUserId: userId,
          action: "UPDATE_DEED_TYPE",
          entityType: "deed",
          entityId: deedId,
          metadata: { deedType },
        });
      }
    }

    let propertyId = deed.propertyId;

    // Upsert property
    if (property) {
      const wasNewProperty = !propertyId;
      if (propertyId) {
        await db
          .update(deedProperties)
          .set({
            street1: property.street1 || null,
            street2: property.street2 || null,
            city: property.city || null,
            state: property.state || null,
            postalCode: property.postalCode || null,
            county: property.county || null,
            parcelNumber: property.parcelNumber || null,
            legalDescription: property.legalDescription || null,
            situsJurisdiction: property.situsJurisdiction || null,
          })
          .where(eq(deedProperties.id, propertyId));
      } else {
        const propertyIdNew = uuidv4();
        await db.insert(deedProperties).values({
          id: propertyIdNew,
          street1: property.street1 || null,
          street2: property.street2 || null,
          city: property.city || null,
          state: property.state || null,
          postalCode: property.postalCode || null,
          county: property.county || null,
          parcelNumber: property.parcelNumber || null,
          legalDescription: property.legalDescription || null,
          situsJurisdiction: property.situsJurisdiction || null,
        });
        propertyId = propertyIdNew;

        await db.update(deeds).set({ propertyId }).where(eq(deeds.id, deedId));
      }

      // Audit log
      await insertAuditLog(db, {
        actorUserId: userId,
        action: wasNewProperty ? "CREATE_DEED_PROPERTY" : "UPDATE_DEED_PROPERTY",
        entityType: "deed",
        entityId: deedId,
        metadata: { propertyId },
      });
    }

    // Replace parties
    if (Array.isArray(parties)) {
      const rolesToReplace = parties.map((p: any) => p.role).filter(Boolean);

      // Delete existing parties with those roles
      const existingParties = await db.select().from(deedParties).where(eq(deedParties.deedId, deedId));
      for (const existing of existingParties) {
        if (rolesToReplace.includes(existing.role)) {
          await db.delete(deedParties).where(eq(deedParties.id, existing.id));
        }
      }

      // Insert new parties
      for (const p of parties) {
        await db.insert(deedParties).values({
          id: uuidv4(),
          deedId,
          role: p.role,
          personId: p.personId || null,
          displayName: p.displayName || "",
          address: p.address || null,
          capacityLine: p.capacityLine || null,
          email: p.email || null,
          phone: p.phone || null,
        });
      }

      // Audit log
      await insertAuditLog(db, {
        actorUserId: userId,
        action: "UPDATE_DEED_PARTIES",
        entityType: "deed",
        entityId: deedId,
        metadata: { partyCount: parties.length, roles: rolesToReplace },
      });
    }

    // Fetch updated deed
    const updated = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);

    return NextResponse.json({ ok: true, deed: updated[0] });
  } catch (error: any) {
    console.error("Update deed error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to update deed" } },
      { status: 500 }
    );
  }
}
