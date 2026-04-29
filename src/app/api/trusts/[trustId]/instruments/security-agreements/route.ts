import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowSecurityAgreements, workflowAssetCertificates, workflowPromissoryNotes, trusts, trustDocuments } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateAgreementNumber } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateAgreementSchema = z.object({
  certificateId: z.string().uuid(),
  noteId: z.string().uuid().optional(), // Optional link to promissory note
  debtorName: z.string().min(1).max(255),
  collateralDescription: z.string().min(1),
  governingLawState: z.string().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateAgreementSchema>;
  try {
    body = CreateAgreementSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // TODO: Check authority status when field is added
  // const authorityStatus = trust.authorityStatus;
  // if (authorityStatus !== "confirmed") {
  //   return NextResponse.json({ error: "Trust authority must be confirmed before issuing security agreements" }, { status: 403 });
  // }

  // Verify certificate exists and belongs to this trust
  const certRows = await db
    .select()
    .from(workflowAssetCertificates)
    .where(and(eq(workflowAssetCertificates.id, body.certificateId), eq(workflowAssetCertificates.trustId, trustId)))
    .limit(1);

  if (certRows.length === 0) return NextResponse.json({ error: "Certificate not found or does not belong to this trust" }, { status: 404 });

  const certificate = certRows[0];

  // If noteId provided, verify it exists and belongs to this trust
  if (body.noteId) {
    const noteRows = await db
      .select()
      .from(workflowPromissoryNotes)
      .where(and(eq(workflowPromissoryNotes.id, body.noteId), eq(workflowPromissoryNotes.trustId, trustId)))
      .limit(1);

    if (noteRows.length === 0) return NextResponse.json({ error: "Note not found or does not belong to this trust" }, { status: 404 });
  }

  // Generate agreement number
  const year = new Date().getFullYear();
  const agreementNumber = await allocateAgreementNumber(trustId, year);

  // Create agreement
  const agreementId = crypto.randomUUID();

  // Create trust document for the agreement
  const docId = crypto.randomUUID();
  await db.insert(trustDocuments).values({
    id: docId,
    trustId,
    docType: "SecurityAgreement",
    title: `Security Agreement ${agreementNumber}`,
    version: 1,
    classification: "private",
    disclosureState: "not_shared",
    proofState: "not_hashed",
    contentJson: JSON.stringify({
      agreementId,
      agreementNumber,
      certificateId: body.certificateId,
      certificateNumber: certificate.certificateNumber,
      noteId: body.noteId,
      debtorName: body.debtorName,
      collateralDescription: body.collateralDescription,
      governingLawState: body.governingLawState,
    }),
  });

  // Create agreement record
  await db.insert(workflowSecurityAgreements).values({
    id: agreementId,
    trustId,
    certificateId: body.certificateId,
    noteId: body.noteId,
    agreementNumber,
    debtorName: body.debtorName,
    collateralDescription: body.collateralDescription,
    governingLawState: body.governingLawState,
    trustDocumentId: docId,
  });

  return NextResponse.json({
    agreement: {
      id: agreementId,
      trustId,
      certificateId: body.certificateId,
      noteId: body.noteId,
      agreementNumber,
      debtorName: body.debtorName,
      collateralDescription: body.collateralDescription,
      governingLawState: body.governingLawState,
      trustDocumentId: docId,
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
