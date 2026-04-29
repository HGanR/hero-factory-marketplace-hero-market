import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { accessLogs, documentDisclosures, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(documentDisclosures).where(eq(documentDisclosures.shareToken, token)).limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d: any = rows[0];

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, String(d.trustId)), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.update(documentDisclosures).set({ status: "revoked" } as any).where(eq(documentDisclosures.id, String(d.id)));
  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId: String(d.trustId),
    actorUserId: userId,
    action: "disclosure_revoked",
    documentId: d.documentId ? String(d.documentId) : null,
    disclosureId: String(d.id),
  } as any);

  return NextResponse.json({ success: true });
}




