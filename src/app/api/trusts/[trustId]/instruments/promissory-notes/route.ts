import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowPromissoryNotes, workflowAssetCertificates, trusts, trustDocuments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateNoteNumber } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateNoteSchema = z.object({
  certificateId: z.string().uuid(),
  issuerName: z.string().min(1).max(255),
  principalAmountCents: z.number().int().min(1),
  interestRateBps: z.number().int().min(0).optional(),
  paymentTerms: z.string().min(1),
  maturityDate: z.string().min(1),
  governingLawState: z.string().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateNoteSchema>;
  try {
    body = CreateNoteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Verify certificate exists and belongs to this trust
  const certRows = await db
    .select()
    .from(workflowAssetCertificates)
    .where(and(eq(workflowAssetCertificates.id, body.certificateId), eq(workflowAssetCertificates.trustId, trustId)))
    .limit(1);

  if (certRows.length === 0) return NextResponse.json({ error: "Certificate not found or does not belong to this trust" }, { status: 404 });

  // Generate note number
  const year = new Date().getFullYear();
  const noteNumber = await allocateNoteNumber(trustId, year);

  // Create note
  const noteId = crypto.randomUUID();

  // Create trust document for the note
  const docId = crypto.randomUUID();
  await db.insert(trustDocuments).values({
    id: docId,
    trustId,
    docType: "PromissoryNote",
    title: `Promissory Note ${noteNumber}`,
    version: 1,
    classification: "private",
    disclosureState: "not_shared",
    proofState: "not_hashed",
    contentJson: JSON.stringify({
      noteId,
      noteNumber,
      certificateId: body.certificateId,
      issuerName: body.issuerName,
      principalAmountCents: body.principalAmountCents,
      interestRateBps: body.interestRateBps,
      paymentTerms: body.paymentTerms,
      maturityDate: body.maturityDate,
      governingLawState: body.governingLawState,
    }),
  });

  // Create note record
  await db.insert(workflowPromissoryNotes).values({
    id: noteId,
    trustId,
    certificateId: body.certificateId,
    noteNumber,
    issuerName: body.issuerName,
    principalAmountCents: body.principalAmountCents,
    interestRateBps: body.interestRateBps,
    paymentTerms: body.paymentTerms,
    maturityDate: body.maturityDate,
    governingLawState: body.governingLawState,
    trustDocumentId: docId,
  });

  return NextResponse.json({
    note: {
      id: noteId,
      trustId,
      certificateId: body.certificateId,
      noteNumber,
      issuerName: body.issuerName,
      principalAmountCents: body.principalAmountCents,
      interestRateBps: body.interestRateBps,
      paymentTerms: body.paymentTerms,
      maturityDate: body.maturityDate,
      governingLawState: body.governingLawState,
      trustDocumentId: docId,
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
