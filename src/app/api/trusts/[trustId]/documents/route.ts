import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trustDocuments, trustDrafts, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

type DocRow = {
  id: string;
  trustId: string;
  docType: string;
  title: string;
  version: number;
  classification: "public" | "demandable" | "private";
  disclosureState: "not_shared" | "shared" | "shared_with_conditions" | "revoked";
  proofState: "not_hashed" | "hashed" | "archived" | "anchored";
  canonicalHashSha256?: string | null;
  archiveId?: string | null;
  anchorTx?: string | null;
  updatedAt: string | null;
};

function inferDocsFromTrustRecordsDraft(trustId: string, payload: any): DocRow[] {
  // Minimal “projection” so the Trust Dashboard can be useful immediately, even before doc generation is implemented.
  const now = new Date().toISOString();
  const certs: any[] = Array.isArray(payload?.certificates) ? payload.certificates : [];
  const minutes: any[] = Array.isArray(payload?.minutes) ? payload.minutes : [];

  const docs: DocRow[] = [];

  for (const c of certs) {
    const id = String(c?.id || "");
    if (!id) continue;
    docs.push({
      id,
      trustId,
      docType: "Certificate",
      title: String(c?.serialNumber ? `Trust Certificate ${c.serialNumber}` : "Trust Certificate"),
      version: 1,
      classification: "public",
      disclosureState: "not_shared",
      proofState: c?.documentHash ? "hashed" : "not_hashed",
      canonicalHashSha256: c?.documentHash ? String(c.documentHash) : null,
      archiveId: null,
      anchorTx: null,
      updatedAt: String(c?.issuedAt || now),
    });
  }

  for (const m of minutes) {
    const id = String(m?.id || "");
    if (!id) continue;
    const kind = String(m?.kind || "Minutes");
    const title = String(m?.title || kind);
    docs.push({
      id,
      trustId,
      docType: kind,
      title,
      version: 1,
      classification: "demandable",
      disclosureState: "not_shared",
      proofState: m?.hash ? "hashed" : "not_hashed",
      canonicalHashSha256: m?.hash ? String(m.hash) : null,
      archiveId: null,
      anchorTx: null,
      updatedAt: String(m?.createdAt || now),
    });
  }

  return docs;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Missing trustId" }, { status: 400 });

  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Prefer persisted trust_documents rows when present.
  const docs = await db.select().from(trustDocuments).where(eq(trustDocuments.trustId, trustId)).limit(500);
  if (docs.length > 0) {
    return NextResponse.json({
      trustId,
      items: docs.map((d: any) => ({
        id: String(d.id),
        trustId: String(d.trustId),
        docType: String(d.docType),
        title: String(d.title),
        version: Number(d.version ?? 1),
        classification: d.classification,
        disclosureState: d.disclosureState,
        proofState: d.proofState,
        canonicalHashSha256: d.canonicalHashSha256 ?? null,
        archiveId: d.archiveId ?? null,
        anchorTx: d.anchorTx ?? null,
        updatedAt: d.updatedAt ? new Date(d.updatedAt as any).toISOString() : null,
      })),
    });
  }

  // Otherwise, derive a useful list from the latest trust-records-state draft (Phase B).
  const draftRows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, "trust-records-state")))
    .orderBy(sql`version desc`)
    .limit(1);

  if (draftRows.length === 0) return NextResponse.json({ trustId, items: [] });

  let payload: any = null;
  try {
    payload = JSON.parse(String((draftRows[0] as any).payloadJson ?? "null"));
  } catch {
    payload = null;
  }

  return NextResponse.json({
    trustId,
    items: inferDocsFromTrustRecordsDraft(trustId, payload),
    derivedFrom: { draftType: "trust-records-state", version: Number((draftRows[0] as any).version ?? 0) },
  });
}




