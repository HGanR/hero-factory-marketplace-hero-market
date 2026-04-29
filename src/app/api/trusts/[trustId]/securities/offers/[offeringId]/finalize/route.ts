import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityOfferings, trustControls, trustDocuments, trusts } from "@/lib/db/schema";
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

const BodySchema = z.object({
  // Hard default policies (hash-only). Optional overrides can be added later for admin/counsel.
  confirmNoArchive: z.boolean().optional(),
});

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

function nextDocTitle(base: string, offeringName: string) {
  return `${base} — ${offeringName}`;
}

function docDefaults(docType: string): { classification: "public" | "demandable" | "private" } {
  if (docType === "Incumbency / Authority Certificate") return { classification: "public" };
  if (docType === "Verification Page") return { classification: "public" };
  if (docType === "Trustee Resolution (Issuance)") return { classification: "demandable" };
  if (docType === "Security Certificate (Specimen)") return { classification: "demandable" };
  if (docType === "PPM") return { classification: "demandable" };
  if (docType === "Subscription Agreement") return { classification: "demandable" };
  if (docType === "Risk Factors Annex") return { classification: "demandable" };
  return { classification: "private" };
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string; offeringId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });

  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, offeringId } = await ctx.params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json().catch(() => ({})));
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
  let draft: any = null;
  try {
    draft = JSON.parse(String(offer.draftJson ?? "null"));
  } catch {
    draft = null;
  }
  if (!draft) return NextResponse.json({ error: "Missing offering draft" }, { status: 400 });

  if (!offer.counselApproved && !draft?.finalize?.counselApproved) {
    return NextResponse.json({ error: "Counsel sign-off required before finalize" }, { status: 409 });
  }

  // Finalize = generate offering package docs only (no executed certificate, no issuance).
  const offeringName = String(offer.offeringName || draft.offeringName || "Offering");

  const docsToGenerate: Array<{ docType: string; title: string; content: any }> = [
    {
      docType: "Trustee Resolution (Issuance)",
      title: nextDocTitle("Trustee Resolution Authorizing Issuance", offeringName),
      content: {
        offeringName,
        securityType: offer.securityType,
        exemptionTag: offer.exemptionTag,
        authorizedBy: "Trustee",
        createdAt: new Date().toISOString(),
      },
    },
    {
      docType: "Incumbency / Authority Certificate",
      title: nextDocTitle("Incumbency / Authority Certificate", offeringName),
      content: { issuer: draft?.issuer ?? {}, trustees: draft?.approvals ?? {}, createdAt: new Date().toISOString() },
    },
    {
      docType: "PPM",
      title: nextDocTitle("Private Placement Memorandum", offeringName),
      content: { offeringName, terms: draft?.paymentTerms ?? {}, transferRestrictions: draft?.transferRestrictions ?? {}, legends: draft?.legends ?? {} },
    },
    {
      docType: "Subscription Agreement",
      title: nextDocTitle("Subscription Agreement", offeringName),
      content: { offeringName, exemptionTag: offer.exemptionTag, createdAt: new Date().toISOString() },
    },
    {
      docType: "Security Certificate (Specimen)",
      title: nextDocTitle("Security Certificate (Specimen)", offeringName),
      content: { offeringName, certificateNo: "SPECIMEN", holderName: "________________", legends: draft?.legends ?? {}, transferRestrictions: draft?.transferRestrictions ?? {} },
    },
    {
      docType: "Verification Page",
      title: nextDocTitle("Verification Page (No Confidential Terms)", offeringName),
      content: {
        offeringName,
        instructions:
          "This page is provided for verification purposes only. It does not disclose offering economics or confidential terms. Verify integrity using the hashes provided by the issuer.",
      },
    },
  ];

  const createdDocIds: string[] = [];
  await db.transaction(async (tx) => {
    for (const d of docsToGenerate) {
      // Increment version per trustId+docType
      const maxRows = await tx
        .select({ maxV: sql<number>`max(${trustDocuments.version})` })
        .from(trustDocuments)
        .where(and(eq(trustDocuments.trustId, trustId), eq(trustDocuments.docType, d.docType)))
        .limit(1);
      const nextV = Number(maxRows[0]?.maxV ?? 0) + 1;

      const defaults = docDefaults(d.docType);
      const contentJson = canonicalJson(d.content);
      const hash = sha256Hex(contentJson);

      const id = crypto.randomUUID();
      await tx.insert(trustDocuments).values({
        id,
        trustId,
        docType: d.docType,
        title: d.title,
        version: nextV,
        classification: defaults.classification,
        disclosureState: "not_shared",
        proofState: "hashed",
        contentJson,
        canonicalHashSha256: hash,
        archiveId: null,
        anchorTx: null,
      } as any);
      createdDocIds.push(id);
    }

    await tx.update(securityOfferings).set({ status: "finalized", counselApproved: true } as any).where(eq(securityOfferings.id, offeringId));
  });

  return NextResponse.json({ trustId, offeringId, status: "finalized", documentIds: createdDocIds });
}


