import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { accessLogs, documentDisclosures, trustDrafts, trustDocuments } from "@/lib/db/schema";

function isExpired(expiresAt: any): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt as any).getTime();
  return Number.isFinite(t) ? t < Date.now() : false;
}

async function findDerivedDocFromTrustRecordsDraft(trustId: string, docId: string): Promise<any | null> {
  const db = await getDb();
  const draftRows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, "trust-records-state")))
    .orderBy(sql`version desc`)
    .limit(1);
  if (draftRows.length === 0) return null;
  let payload: any = null;
  try {
    payload = JSON.parse(String((draftRows[0] as any).payloadJson ?? "null"));
  } catch {
    payload = null;
  }
  const certs: any[] = Array.isArray(payload?.certificates) ? payload.certificates : [];
  const minutes: any[] = Array.isArray(payload?.minutes) ? payload.minutes : [];
  const cert = certs.find((c) => String(c?.id) === docId);
  if (cert) return { type: "Certificate", data: cert, root: payload };
  const minute = minutes.find((m) => String(m?.id) === docId);
  if (minute) return { type: String(minute?.kind || "Minutes"), data: minute, root: payload };
  return null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 20) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(documentDisclosures).where(eq(documentDisclosures.shareToken, token)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d: any = rows[0];
  if (d.status !== "active") return NextResponse.json({ error: "Inactive" }, { status: 403 });
  if (isExpired(d.expiresAt)) return NextResponse.json({ error: "Expired" }, { status: 403 });

  // Log access (external link access is actorUserId null)
  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId: String(d.trustId),
    actorUserId: null,
    action: "disclosure_accessed",
    documentId: d.documentId ? String(d.documentId) : null,
    disclosureId: String(d.id),
    metaJson: JSON.stringify({
      ua: request.headers.get("user-agent") || null,
      referer: request.headers.get("referer") || null,
    }),
  } as any);

  // Fetch doc metadata if persisted, else derive from trust-records draft.
  const docRows = await db
    .select()
    .from(trustDocuments)
    .where(and(eq(trustDocuments.id, String(d.documentId)), eq(trustDocuments.trustId, String(d.trustId))))
    .limit(1);

  let doc: any = null;
  if (docRows.length > 0) {
    doc = docRows[0];
  }

  const derived = doc ? null : await findDerivedDocFromTrustRecordsDraft(String(d.trustId), String(d.documentId));

  // “Disclosure Package” (JSON MVP)
  return NextResponse.json({
    trustId: String(d.trustId),
    documentId: String(d.documentId),
    disclosure: {
      id: String(d.id),
      status: String(d.status),
      expiresAt: d.expiresAt ? new Date(d.expiresAt as any).toISOString() : null,
      conditions: d.conditionsJson ? JSON.parse(String(d.conditionsJson)) : null,
    },
    document: doc
      ? {
          docType: String(doc.docType),
          title: String(doc.title),
          version: Number(doc.version ?? 1),
          classification: doc.classification,
          disclosureState: doc.disclosureState,
          proofState: doc.proofState,
          hash: doc.canonicalHashSha256 ?? null,
          archiveId: doc.archiveId ?? null,
          anchorTx: doc.anchorTx ?? null,
        }
      : derived
        ? {
            docType: derived.type,
            title: derived.type === "Certificate" ? "Trust Certificate" : String(derived.data?.title || derived.type),
            version: 1,
            classification: derived.type === "Certificate" ? "public" : "demandable",
            proofState: derived.data?.documentHash || derived.data?.hash ? "hashed" : "not_hashed",
            hash: derived.data?.documentHash || derived.data?.hash || null,
            signatureSealDataUrl: derived.data?.signatureSealDataUrl || null,
            payload: derived.data,
          }
        : null,
    verification: {
      instructions:
        "Verify integrity by comparing the SHA-256 hash to the hash shown in this disclosure package. Hash publication does not publish underlying contents.",
      generatedAt: new Date().toISOString(),
    },
  });
}


