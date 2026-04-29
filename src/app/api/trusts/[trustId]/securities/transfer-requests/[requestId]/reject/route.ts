import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityEvents, securityTransferRequests, trustRecordRoles, trustControls, trusts } from "@/lib/db/schema";
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
  reason: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string; requestId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, requestId } = await ctx.params;
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json().catch(() => ({})));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
  const effectiveRole = String((roleRows[0] as any)?.role || "Manager");
  if (effectiveRole !== "Trustee") {
    return NextResponse.json({ error: "Forbidden (Trustee role required)" }, { status: 403 });
  }

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const reqRows = await db
    .select()
    .from(securityTransferRequests)
    .where(and(eq(securityTransferRequests.id, requestId), eq(securityTransferRequests.trustId, trustId)))
    .limit(1);
  if (reqRows.length === 0) return NextResponse.json({ error: "Transfer request not found" }, { status: 404 });
  const reqRow: any = reqRows[0];
  if (String(reqRow.status) !== "PENDING") return NextResponse.json({ error: "Transfer request not pending" }, { status: 409 });

  await db.transaction(async (tx) => {
    await tx.update(securityTransferRequests).set({ status: "REJECTED" } as any).where(eq(securityTransferRequests.id, requestId));
    await tx.insert(securityEvents).values({
      id: crypto.randomUUID(),
      trustId,
      offeringId: String(reqRow.offeringId),
      certificateId: String(reqRow.certificateId),
      eventType: "TRANSFER_REJECTED",
      actorUserId: userId,
      actorRole: "trustee",
      payloadJson: JSON.stringify({ transferRequestId: requestId, reason: body.reason ?? null }),
    } as any);
  });

  return NextResponse.json({ ok: true });
}


