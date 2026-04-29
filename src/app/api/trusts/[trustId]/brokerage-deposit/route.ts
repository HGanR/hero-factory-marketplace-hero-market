/**
 * Trust Brokerage Deposit API
 * POST: Record a brokerage deposit event and optionally create instrument metadata
 * Append-only event ledger for auditability
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustAssetInstruments, trustAssetEvents } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

const INSTRUMENT_TYPES = [
  "Security",
  "Negotiable Instrument",
  "Cash",
  "Private Security",
  "Promissory Note",
  "Corporate Bond",
  "Trust Certificate",
  "Stock",
] as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: {
    assetId: string;
    brokerageAccountId: string;
    instrumentType?: string;
    issuer?: string;
    issueDate?: string;
    faceValue?: number;
    transferability?: string;
    cusip?: string;
    transferAgent?: string;
    depositDate?: string;
    quantity?: number;
    settlementMethod?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.assetId || !body.brokerageAccountId) {
    return NextResponse.json(
      { error: "assetId and brokerageAccountId are required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const instrumentId = uuidv4();
  const eventId = uuidv4();

  // Create instrument metadata if provided
  if (
    body.instrumentType ||
    body.issuer ||
    body.faceValue !== undefined ||
    body.issueDate ||
    body.transferability ||
    body.cusip ||
    body.transferAgent
  ) {
    await db.insert(trustAssetInstruments).values({
      id: instrumentId,
      assetId: body.assetId,
      instrumentType: body.instrumentType ?? null,
      issuer: body.issuer ?? null,
      faceValue: body.faceValue != null ? String(body.faceValue) : null,
      issueDate: body.issueDate ?? null,
      transferability: body.transferability ?? null,
      cusip: body.cusip ?? null,
      transferAgent: body.transferAgent ?? null,
    });
  }

  // Append deposit event (append-only ledger)
  await db.insert(trustAssetEvents).values({
    id: eventId,
    trustId,
    assetId: body.assetId,
    eventType: "BROKERAGE_DEPOSIT_INITIATED",
    metadata: {
      brokerageAccountId: body.brokerageAccountId,
      instrumentId: instrumentId,
      depositDate: body.depositDate ?? new Date().toISOString().slice(0, 10),
      quantity: body.quantity,
      settlementMethod: body.settlementMethod,
      notes: body.notes,
    },
  });

  return NextResponse.json(
    {
      eventId,
      instrumentId,
      eventType: "BROKERAGE_DEPOSIT_INITIATED",
      trustId,
      assetId: body.assetId,
      brokerageAccountId: body.brokerageAccountId,
      createdAt: new Date().toISOString(),
    },
    { status: 201 }
  );
}
