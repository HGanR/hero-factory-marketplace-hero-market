import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { securityCertificates, trustControls, trusts } from "@/lib/db/schema";
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string; certificateId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });

  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, certificateId } = await ctx.params;
  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(securityCertificates)
    .where(and(eq(securityCertificates.id, certificateId), eq(securityCertificates.trustId, trustId)))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

  const r: any = rows[0];
  return NextResponse.json({
    trustId,
    certificate: {
      id: String(r.id),
      offeringId: String(r.offeringId),
      certificateNo: String(r.certificateNo),
      holderId: String(r.holderId),
      holderName: String(r.holderName),
      amount: String(r.amount),
      custodyMode: String(r.custodyMode),
      custodianName: r.custodianName ? String(r.custodianName) : null,
      possessionAcknowledgedAt: r.possessionAcknowledgedAt ? new Date(r.possessionAcknowledgedAt as any).toISOString() : null,
      possessionAcknowledgedMethod: r.possessionAcknowledgedMethod ? String(r.possessionAcknowledgedMethod) : null,
      executedDocumentId: r.executedDocumentId ? String(r.executedDocumentId) : null,
      issuedAt: r.issuedAt ? new Date(r.issuedAt as any).toISOString() : null,
      status: String(r.status),
    },
  });
}




