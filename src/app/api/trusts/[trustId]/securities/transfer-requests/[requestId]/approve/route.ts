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
  trustRecordRoles,
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

const BodySchema = z.object({
  // Do NOT trust client-provided role. We only accept optional signature metadata.
  signatureJson: z.unknown().optional(),
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

  // Role is derived server-side. For now we reuse the existing Trust Records role table:
  // only Trustees can approve transfers (admins can still reach this endpoint via admin-token,
  // but we do not accept role claims from the browser).
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

  // Mark approval for the server-derived role (idempotent-ish).
  // Note: we only support trustee approvals in MVP; counsel/officer can be added once trust membership is modeled.
  const approvalRole = "trustee";
  const approvalRows = await db
    .select()
    .from(securityTransferApprovals)
    .where(and(eq(securityTransferApprovals.transferRequestId, requestId), eq(securityTransferApprovals.roleRequired, approvalRole)))
    .limit(1);
  if (approvalRows.length === 0) return NextResponse.json({ error: `No ${approvalRole} approval required for this request` }, { status: 400 });

  const approval = approvalRows[0] as any;
  if (approval.approvedAt) return NextResponse.json({ ok: true, alreadyApproved: true });

  const now = new Date();
  await db
    .update(securityTransferApprovals)
    .set({
      approvedByUserId: userId,
      approvedAt: now,
      signatureJson: body.signatureJson ? JSON.stringify(body.signatureJson) : null,
    } as any)
    .where(eq(securityTransferApprovals.id, String(approval.id)));

  // If all approvals are satisfied, finalize transfer (move holder, emit event).
  const allApprovals = await db.select().from(securityTransferApprovals).where(eq(securityTransferApprovals.transferRequestId, requestId));
  const allApproved = allApprovals.every((a: any) => Boolean(a.approvedAt));

  if (allApproved) {
    const certRows = await db
      .select()
      .from(securityCertificates)
      .where(and(eq(securityCertificates.id, String(reqRow.certificateId)), eq(securityCertificates.trustId, trustId)))
      .limit(1);
    if (certRows.length === 0) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    const cert: any = certRows[0];

    const toHolderRows = await db
      .select()
      .from(securityHolders)
      .where(and(eq(securityHolders.id, String(reqRow.toHolderId)), eq(securityHolders.trustId, trustId)))
      .limit(1);
    if (toHolderRows.length === 0) return NextResponse.json({ error: "Target holder not found" }, { status: 404 });
    const toHolder: any = toHolderRows[0];

    await db.transaction(async (tx) => {
      await tx
        .update(securityCertificates)
        .set({
          holderId: String(toHolder.id),
          holderName: String(toHolder.displayName),
        } as any)
        .where(eq(securityCertificates.id, String(reqRow.certificateId)));

      await tx
        .update(securityTransferRequests)
        .set({ status: "APPROVED" } as any)
        .where(eq(securityTransferRequests.id, requestId));

      await tx.insert(securityEvents).values({
        id: crypto.randomUUID(),
        trustId,
        offeringId: String(reqRow.offeringId),
        certificateId: String(reqRow.certificateId),
        eventType: "TRANSFER_APPROVED",
        actorUserId: userId,
        actorRole: "trustee",
        payloadJson: JSON.stringify({
          transferRequestId: requestId,
          fromHolderId: String(reqRow.fromHolderId),
          toHolderId: String(reqRow.toHolderId),
          previousHolderId: String(cert.holderId),
          newHolderId: String(toHolder.id),
        }),
      } as any);
    });
  }

  return NextResponse.json({ ok: true, allApproved });
}


