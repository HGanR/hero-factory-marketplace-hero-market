import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityCertificates, securityEvents, securityHolders, securityOfferings, trustControls, trustDocuments, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function canonicalJson(obj: unknown) {
  const normalize = (v: any): any => {
    if (v === null || v === undefined) return v ?? null;
    if (Array.isArray(v)) return v.map(normalize);
    if (typeof v === "object") {
      const out: any = {};
      for (const k of Object.keys(v).sort()) out[k] = normalize(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(normalize(obj), null, 2);
}

const BodySchema = z.object({
  holderId: z.string().uuid().optional(),
  createHolder: z
    .object({
      displayName: z.string().min(1).max(255),
      holderRef: z.string().max(191).optional(),
    })
    .optional(),
  amount: z.string().min(1).max(64),
  custodyMode: z.enum(["holder_possession", "trustee_or_custodian_possession"]).default("holder_possession"),
  custodianName: z.string().max(255).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string; offeringId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });

  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, offeringId } = await ctx.params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const offerRows = await db
    .select()
    .from(securityOfferings)
    .where(and(eq(securityOfferings.id, offeringId), eq(securityOfferings.trustId, trustId)))
    .limit(1);
  if (offerRows.length === 0) return NextResponse.json({ error: "Offering not found" }, { status: 404 });
  const offer: any = offerRows[0];
  if (String(offer.status) !== "finalized") {
    return NextResponse.json({ error: "Offering must be finalized before issuance" }, { status: 409 });
  }

  let draft: any = null;
  try {
    draft = JSON.parse(String(offer.draftJson ?? "null"));
  } catch {
    draft = null;
  }
  if (!draft) return NextResponse.json({ error: "Missing offering draft" }, { status: 400 });

  if (controlRows[0]?.requireCounselApproval && !offer.counselApproved && !draft?.finalize?.counselApproved) {
    return NextResponse.json({ error: "Counsel sign-off required before issuance" }, { status: 409 });
  }

  // Resolve holder (prefer existing registry record; allow creation with minimal fields).
  let resolvedHolderId = body.holderId ?? null;
  if (!resolvedHolderId && body.createHolder) {
    const newHolderId = crypto.randomUUID();
    await db.insert(securityHolders).values({
      id: newHolderId,
      trustId,
      displayName: body.createHolder.displayName.trim(),
      holderRef: body.createHolder.holderRef ? body.createHolder.holderRef.trim() : null,
    } as any);
    resolvedHolderId = newHolderId;
  }
  if (!resolvedHolderId) return NextResponse.json({ error: "holderId or createHolder required" }, { status: 400 });

  const holderRows = await db
    .select()
    .from(securityHolders)
    .where(and(eq(securityHolders.id, resolvedHolderId), eq(securityHolders.trustId, trustId)))
    .limit(1);
  if (holderRows.length === 0) return NextResponse.json({ error: "Holder not found" }, { status: 404 });
  const holder: any = holderRows[0];

  const offeringName = String(offer.offeringName || draft.offeringName || "Offering");
  const certificateNo = `SEC-${Date.now()}`;
  const custodyMode = body.custodyMode;
  const custodianName = custodyMode === "trustee_or_custodian_possession" ? String(body.custodianName || "").trim() : "";
  if (custodyMode === "trustee_or_custodian_possession" && !custodianName) {
    return NextResponse.json({ error: "custodianName required for trustee/custodian possession" }, { status: 400 });
  }

  const issueDate = new Date();
  const executedDocType = "Security Certificate (Executed)";
  const executedTitle = `Security Certificate ${certificateNo} — ${offeringName}`;
  const executedContent = {
    offeringName,
    certificateNo,
    holder: { id: String(holder.id), displayName: String(holder.displayName), holderRef: holder.holderRef ? String(holder.holderRef) : null },
    amount: body.amount,
    issueDate: issueDate.toISOString().slice(0, 10),
    custodyMode,
    custodianName: custodianName || null,
    terms: { payment: draft?.paymentTerms ?? {}, aggregate: draft?.aggregateAmountOrFormula ?? "" },
    transferRestrictions: draft?.transferRestrictions ?? {},
    legends: draft?.legends ?? {},
  };
  const executedContentJson = canonicalJson(executedContent);
  const executedHash = sha256Hex(executedContentJson);

  const certificateId = crypto.randomUUID();
  const executedDocId = crypto.randomUUID();
  const eventId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // Version bump for executed certificate doc type
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDocuments.version})` })
      .from(trustDocuments)
      .where(and(eq(trustDocuments.trustId, trustId), eq(trustDocuments.docType, executedDocType)))
      .limit(1);
    const nextV = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDocuments).values({
      id: executedDocId,
      trustId,
      docType: executedDocType,
      title: executedTitle,
      version: nextV,
      classification: "demandable",
      disclosureState: "not_shared",
      proofState: "hashed",
      contentJson: executedContentJson,
      canonicalHashSha256: executedHash,
      archiveId: null,
      anchorTx: null,
    } as any);

    await tx.insert(securityCertificates).values({
      id: certificateId,
      trustId,
      offeringId,
      certificateNo,
      holderId: String(holder.id),
      holderName: String(holder.displayName),
      amount: body.amount,
      custodyMode,
      custodianName: custodianName || null,
      executedDocumentId: executedDocId,
      issuedAt: issueDate,
      status: "issued",
    } as any);

    await tx.insert(securityEvents).values({
      id: eventId,
      trustId,
      offeringId,
      certificateId,
      eventType: "CERT_ISSUED",
      actorUserId: userId,
      actorRole: "trustee",
      payloadJson: JSON.stringify({
        executedDocumentId: executedDocId,
        executedHashSha256: executedHash,
        amount: body.amount,
        custodyMode,
        custodianName: custodianName || null,
        holderId: String(holder.id),
      }),
    } as any);
  });

  return NextResponse.json({
    trustId,
    offeringId,
    certificate: {
      id: certificateId,
      certificateNo,
      holderId: String(holder.id),
      holderName: String(holder.displayName),
      amount: body.amount,
      custodyMode,
      custodianName: custodianName || null,
      executedDocumentId: executedDocId,
    },
    executed: {
      documentId: executedDocId,
      canonicalHashSha256: executedHash,
    },
  });
}


