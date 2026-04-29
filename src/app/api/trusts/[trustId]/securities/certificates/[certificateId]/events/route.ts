import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { securityCertificates, securityEvents, trustControls, trusts } from "@/lib/db/schema";
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

  const certRows = await db
    .select()
    .from(securityCertificates)
    .where(and(eq(securityCertificates.id, certificateId), eq(securityCertificates.trustId, trustId)))
    .limit(1);
  if (certRows.length === 0) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(securityEvents)
    .where(and(eq(securityEvents.trustId, trustId), eq(securityEvents.certificateId, certificateId)))
    .orderBy(sql`createdAt asc`)
    .limit(500);

  return NextResponse.json({
    trustId,
    certificateId,
    items: rows.map((r: any) => ({
      id: String(r.id),
      eventType: String(r.eventType),
      actorUserId: r.actorUserId ?? null,
      actorRole: r.actorRole ? String(r.actorRole) : null,
      payload: (() => {
        try {
          return r.payloadJson ? JSON.parse(String(r.payloadJson)) : null;
        } catch {
          return null;
        }
      })(),
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
    })),
  });
}




