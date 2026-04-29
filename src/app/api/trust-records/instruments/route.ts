/**
 * Trust Records Instruments API
 * GET: List instruments for a trust (filter by status, kind)
 * POST: Create draft instrument
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustInstruments } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const trustId = searchParams.get("trustId");
  const status = searchParams.get("status");
  const kind = searchParams.get("kind");

  if (!trustId) return NextResponse.json({ error: "trustId is required" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const conditions = [eq(trustInstruments.trustId, trustId)];
  if (status) conditions.push(eq(trustInstruments.status, status as any));
  if (kind) conditions.push(eq(trustInstruments.instrumentKind, kind as any));

  const instruments = await db
    .select()
    .from(trustInstruments)
    .where(and(...conditions))
    .orderBy(desc(trustInstruments.createdAt));

  return NextResponse.json({
    ok: true,
    trustId,
    instruments: instruments.map((i) => ({
      id: i.id,
      trustId: i.trustId,
      workspaceId: i.workspaceId,
      instrumentKind: i.instrumentKind,
      instrumentSubtype: i.instrumentSubtype,
      status: i.status,
      serialNumber: i.serialNumber,
      issuerName: i.issuerName,
      governingLaw: i.governingLaw,
      faceValue: i.faceValue ? Number(i.faceValue) : null,
      currency: i.currency,
      issueDate: i.issueDate?.toISOString().slice(0, 10),
      maturityDate: i.maturityDate?.toISOString().slice(0, 10),
      ppmDocumentId: i.ppmDocumentId,
      governingResolutionId: i.governingResolutionId,
      collateralPoolId: i.collateralPoolId,
      debtInstrumentId: i.debtInstrumentId,
      certificateRefId: i.certificateRefId,
      signedAt: i.signedAt?.toISOString(),
      signedBy: i.signedBy,
      createdAt: i.createdAt?.toISOString(),
      updatedAt: i.updatedAt?.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    trustId: string;
    instrumentKind: string;
    instrumentSubtype?: string;
    faceValue?: number;
    currency?: string;
    maturityDate?: string;
    governingResolutionId?: string;
    collateralPoolId?: string;
    ppmDocumentId?: string;
    issuerName?: string;
    governingLaw?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trustId, instrumentKind } = body;
  if (!trustId) return NextResponse.json({ error: "trustId is required" }, { status: 400 });
  if (!instrumentKind) return NextResponse.json({ error: "instrumentKind is required" }, { status: 400 });

  const validKinds = ["CERTIFICATE", "BOND", "PROMISSORY_NOTE", "SECURED_NOTE", "PPM_SECURITY", "OTHER"];
  if (!validKinds.includes(instrumentKind)) {
    return NextResponse.json({ error: `instrumentKind must be one of: ${validKinds.join(", ")}` }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const id = uuidv4();
  await db.insert(trustInstruments).values({
    id,
    trustId,
    workspaceId: trustId,
    instrumentKind: instrumentKind as any,
    instrumentSubtype: body.instrumentSubtype ?? null,
    status: "DRAFT",
    faceValue: body.faceValue != null ? String(body.faceValue) : null,
    currency: body.currency ?? "USD",
    maturityDate: body.maturityDate ? new Date(body.maturityDate) : null,
    governingResolutionId: body.governingResolutionId ?? null,
    collateralPoolId: body.collateralPoolId ?? null,
    ppmDocumentId: body.ppmDocumentId ?? null,
    issuerName: body.issuerName ?? null,
    governingLaw: body.governingLaw ?? null,
    createdBy: String(userId),
  });

  const [created] = await db.select().from(trustInstruments).where(eq(trustInstruments.id, id)).limit(1);

  return NextResponse.json(
    {
      ok: true,
      instrument: {
        id: created.id,
        trustId: created.trustId,
        instrumentKind: created.instrumentKind,
        instrumentSubtype: created.instrumentSubtype,
        status: created.status,
        faceValue: created.faceValue ? Number(created.faceValue) : null,
        currency: created.currency,
        maturityDate: created.maturityDate?.toISOString().slice(0, 10),
        governingResolutionId: created.governingResolutionId,
        collateralPoolId: created.collateralPoolId,
        ppmDocumentId: created.ppmDocumentId,
        issuerName: created.issuerName,
        governingLaw: created.governingLaw,
        createdAt: created.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
}
