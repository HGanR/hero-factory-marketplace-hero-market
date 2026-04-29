import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  securityCertificates,
  securityEvents,
  securityHolders,
  securityTransferApprovals,
  securityTransferRequests,
  trustControls,
  trusts,
} from "@/lib/db/schema";
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

const CreateSchema = z.object({
  toHolderId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
  effectiveDate: z.string().max(32).optional(), // ISO date or label
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string; certificateId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId, certificateId } = await ctx.params;

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
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

  const certRows = await db
    .select()
    .from(securityCertificates)
    .where(and(eq(securityCertificates.id, certificateId), eq(securityCertificates.trustId, trustId)))
    .limit(1);
  if (certRows.length === 0) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  const cert: any = certRows[0];

  const toHolderRows = await db
    .select()
    .from(securityHolders)
    .where(and(eq(securityHolders.id, body.toHolderId), eq(securityHolders.trustId, trustId)))
    .limit(1);
  if (toHolderRows.length === 0) return NextResponse.json({ error: "Target holder not found" }, { status: 404 });

  const id = crypto.randomUUID();
  const approvalsToCreate: Array<{ roleRequired: string }> = [];
  if (controlRows[0]?.requireTrusteeApproval) approvalsToCreate.push({ roleRequired: "trustee" });
  if (controlRows[0]?.requireCounselApproval) approvalsToCreate.push({ roleRequired: "counsel" });
  if (approvalsToCreate.length === 0) approvalsToCreate.push({ roleRequired: "trustee" }); // safe default

  await db.transaction(async (tx) => {
    await tx.insert(securityTransferRequests).values({
      id,
      trustId,
      offeringId: String(cert.offeringId),
      certificateId,
      fromHolderId: String(cert.holderId),
      toHolderId: body.toHolderId,
      reason: body.reason ?? null,
      effectiveDate: body.effectiveDate ?? null,
      status: "PENDING",
      createdByUserId: userId,
    } as any);

    for (const a of approvalsToCreate) {
      await tx.insert(securityTransferApprovals).values({
        id: crypto.randomUUID(),
        transferRequestId: id,
        roleRequired: a.roleRequired,
      } as any);
    }

    await tx.insert(securityEvents).values({
      id: crypto.randomUUID(),
      trustId,
      offeringId: String(cert.offeringId),
      certificateId,
      eventType: "TRANSFER_REQUESTED",
      actorUserId: userId,
      actorRole: "trustee",
      payloadJson: JSON.stringify({
        transferRequestId: id,
        fromHolderId: String(cert.holderId),
        toHolderId: body.toHolderId,
        reason: body.reason ?? null,
        effectiveDate: body.effectiveDate ?? null,
      }),
    } as any);
  });

  return NextResponse.json({ trustId, transferRequestId: id, status: "PENDING" });
}




