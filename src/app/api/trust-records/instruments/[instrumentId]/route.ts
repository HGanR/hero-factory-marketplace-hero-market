/**
 * Trust Records Instrument Detail API
 * GET: Get single instrument
 * PATCH: Update instrument (limited when not DRAFT)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustInstruments } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instrumentId } = await ctx.params;
  if (!instrumentId) return NextResponse.json({ error: "Invalid instrumentId" }, { status: 400 });

  const db = await getDb();
  const [instrument] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, instrumentId))
    .limit(1);
  if (!instrument) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, instrument.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    instrument: {
      id: instrument.id,
      trustId: instrument.trustId,
      workspaceId: instrument.workspaceId,
      instrumentKind: instrument.instrumentKind,
      instrumentSubtype: instrument.instrumentSubtype,
      status: instrument.status,
      serialNumber: instrument.serialNumber,
      issuerName: instrument.issuerName,
      governingLaw: instrument.governingLaw,
      faceValue: instrument.faceValue ? Number(instrument.faceValue) : null,
      currency: instrument.currency,
      issueDate: instrument.issueDate?.toISOString().slice(0, 10),
      maturityDate: instrument.maturityDate?.toISOString().slice(0, 10),
      ppmDocumentId: instrument.ppmDocumentId,
      governingResolutionId: instrument.governingResolutionId,
      collateralPoolId: instrument.collateralPoolId,
      debtInstrumentId: instrument.debtInstrumentId,
      certificateRefId: instrument.certificateRefId,
      createdBy: instrument.createdBy,
      signedAt: instrument.signedAt?.toISOString(),
      signedBy: instrument.signedBy,
      createdAt: instrument.createdAt?.toISOString(),
      updatedAt: instrument.updatedAt?.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instrumentId } = await ctx.params;
  if (!instrumentId) return NextResponse.json({ error: "Invalid instrumentId" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const [instrument] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, instrumentId))
    .limit(1);
  if (!instrument) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, instrument.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  if (instrument.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only DRAFT instruments can be updated" },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  const allowed = [
    "instrumentSubtype",
    "faceValue",
    "currency",
    "maturityDate",
    "governingResolutionId",
    "collateralPoolId",
    "ppmDocumentId",
    "issuerName",
    "governingLaw",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.maturityDate === null) updates.maturityDate = null;
  if (body.faceValue != null) updates.faceValue = String(body.faceValue);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, instrument: instrument });
  }

  await db
    .update(trustInstruments)
    .set(updates as any)
    .where(eq(trustInstruments.id, instrumentId));

  const [updated] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, instrumentId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    instrument: {
      id: updated.id,
      trustId: updated.trustId,
      instrumentKind: updated.instrumentKind,
      instrumentSubtype: updated.instrumentSubtype,
      status: updated.status,
      serialNumber: updated.serialNumber,
      issuerName: updated.issuerName,
      governingLaw: updated.governingLaw,
      faceValue: updated.faceValue ? Number(updated.faceValue) : null,
      currency: updated.currency,
      issueDate: updated.issueDate?.toISOString().slice(0, 10),
      maturityDate: updated.maturityDate?.toISOString().slice(0, 10),
      ppmDocumentId: updated.ppmDocumentId,
      governingResolutionId: updated.governingResolutionId,
      collateralPoolId: updated.collateralPoolId,
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    },
  });
}
