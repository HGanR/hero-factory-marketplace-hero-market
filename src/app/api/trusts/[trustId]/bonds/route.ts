import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  trustBondholderRegister,
  trustDebtCollateral,
  trustDebtDisclosures,
  trustDebtInstruments,
  trustDocuments,
  trusts,
} from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateBondNumber } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const PaymentFrequencySchema = z.enum(["monthly", "quarterly", "annual"]);

const CreateBondSchema = z.object({
  holderName: z.string().min(1).max(200),
  principalAmountUSD: z.number().positive(),
  interestRatePct: z.number().min(0),
  interestType: z.enum(["fixed", "variable"]),
  paymentFrequency: PaymentFrequencySchema,
  maturityDate: z.string().min(1),
  seniority: z.enum(["senior", "subordinated"]),
  callable: z.boolean().optional(),
  collateralDescription: z.string().max(2000).optional(),
  governingLaw: z.string().min(1).max(100),
  ppmDocumentId: z.string().uuid(),
  exemption: z.enum(["reg_d_506b", "reg_d_506c"]).optional(),
  bondPrefix: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

function mapPaymentFrequencyMonths(v: z.infer<typeof PaymentFrequencySchema>) {
  if (v === "monthly") return 1;
  if (v === "quarterly") return 3;
  return 12;
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

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(trustDebtInstruments)
    .where(eq(trustDebtInstruments.trustId, trustId))
    .orderBy(sql`createdAt desc`)
    .limit(200);

  return NextResponse.json({
    trustId,
    items: rows.map((r: any) => ({
      id: String(r.id),
      bondNumber: String(r.bondNumber),
      status: r.status,
      instrumentType: r.instrumentType,
      principalAmount: r.principalAmount,
      interestRate: r.interestRate,
      interestType: r.interestType,
      paymentFrequencyMonths: r.paymentFrequencyMonths,
      maturityDate: r.maturityDate,
      seniority: r.seniority,
      callable: Boolean(r.callable),
      governingLaw: r.governingLaw,
      ppmDocumentId: r.ppmDocumentId,
      issuedAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
    })),
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  let body: z.infer<typeof CreateBondSchema>;
  try {
    body = CreateBondSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });
  const trust = trustRows[0];

  const docRows = await db
    .select()
    .from(trustDocuments)
    .where(and(eq(trustDocuments.id, body.ppmDocumentId), eq(trustDocuments.trustId, trustId)))
    .limit(1);
  if (docRows.length === 0) return NextResponse.json({ error: "PPM document not found" }, { status: 404 });
  const ppmDoc = docRows[0] as any;
  const ppmDocType = String(ppmDoc.docType || "");
  if (!ppmDocType.toLowerCase().includes("ppm")) {
    return NextResponse.json({ error: "Selected document is not a PPM" }, { status: 400 });
  }

  const bondId = crypto.randomUUID();
  const issuedAt = new Date();
  const bondNumber = await allocateBondNumber(trustId, issuedAt.getFullYear(), body.bondPrefix);
  const exemption = body.exemption ?? "reg_d_506b";
  const advertisingAllowed = exemption === "reg_d_506c";
  const accreditedOnly = exemption === "reg_d_506c";
  const paymentFrequencyMonths = mapPaymentFrequencyMonths(body.paymentFrequency);

  const executedDocType = "Bond Certificate (Executed)";
  const trustName = String(trust.name || "Trust");
  const executedTitle = `Bond Certificate ${bondNumber} — ${trustName}`;
  const executedContent = {
    bondId,
    bondNumber,
    trustId,
    trustName,
    issuedAt: issuedAt.toISOString(),
    holderName: body.holderName.trim(),
    principalAmountUSD: body.principalAmountUSD,
    interestRatePct: body.interestRatePct,
    interestType: body.interestType,
    paymentFrequency: body.paymentFrequency,
    maturityDate: body.maturityDate,
    seniority: body.seniority,
    callable: Boolean(body.callable),
    collateralDescription: body.collateralDescription?.trim() || null,
    governingLaw: body.governingLaw.trim(),
    ppmDocumentId: body.ppmDocumentId,
    exemption,
    notes: body.notes?.trim() || null,
  };
  const executedContentJson = canonicalJson(executedContent);
  const executedHash = sha256Hex(executedContentJson);

  const executedDocId = crypto.randomUUID();
  const disclosureId = crypto.randomUUID();
  const registerId = crypto.randomUUID();

  await db.transaction(async (tx) => {
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

    await tx.insert(trustDebtInstruments).values({
      id: bondId,
      trustId,
      status: "issued",
      instrumentType: "bond",
      exemption,
      bondNumber,
      principalAmount: body.principalAmountUSD.toFixed(6),
      interestRate: body.interestRatePct.toFixed(4),
      interestType: body.interestType,
      paymentFrequencyMonths,
      maturityDate: body.maturityDate,
      seniority: body.seniority,
      callable: Boolean(body.callable),
      governingLaw: body.governingLaw.trim(),
      ppmDocumentId: body.ppmDocumentId,
      isNonRecourse: false,
      revenueSourceDescription: null,
      trusteeResolutionId: null,
      bondInstrumentDocumentId: executedDocId,
      trusteeName: null,
      trustName: trust.name ?? null,
      trustDateLabel: null,
      advertisingAllowed,
      accreditedOnly,
    } as any);

    await tx.insert(trustDebtDisclosures).values({
      id: disclosureId,
      trustId,
      debtInstrumentId: bondId,
      docType: "ppm",
      title: String(ppmDoc.title || "PPM"),
      description: "Bond issuance PPM binding",
      documentId: body.ppmDocumentId,
      isRequired: true,
      isComplete: true,
    } as any);

    await tx.insert(trustBondholderRegister).values({
      id: registerId,
      trustId,
      debtInstrumentId: bondId,
      holderName: body.holderName.trim(),
      holderEntityType: null,
      holderContact: null,
      principalHeld: body.principalAmountUSD.toFixed(6),
      issueDate: issuedAt.toISOString().slice(0, 10),
      status: "active",
    } as any);

    if (body.collateralDescription && body.collateralDescription.trim()) {
      await tx.insert(trustDebtCollateral).values({
        id: crypto.randomUUID(),
        trustId,
        debtInstrumentId: bondId,
        collateralType: "other",
        description: body.collateralDescription.trim(),
      } as any);
    }
  });

  return NextResponse.json({
    bond: {
      id: bondId,
      bondNumber,
      issuedAt: issuedAt.toISOString(),
      holderName: body.holderName.trim(),
      principalAmountUSD: body.principalAmountUSD,
      interestRatePct: body.interestRatePct,
      interestType: body.interestType,
      paymentFrequency: body.paymentFrequency,
      maturityDate: body.maturityDate,
      seniority: body.seniority,
      callable: Boolean(body.callable),
      collateralDescription: body.collateralDescription?.trim() || null,
      governingLaw: body.governingLaw.trim(),
      ppmDocumentId: body.ppmDocumentId,
      notes: body.notes?.trim() || null,
      status: "Active",
      documentHash: executedHash,
      executedDocumentId: executedDocId,
    },
  });
}
