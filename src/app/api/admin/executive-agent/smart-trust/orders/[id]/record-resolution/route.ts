import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { recordSmartTrustResolutionFromOrder } from "@/lib/fulfillment/smart-trust-operations-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/executive-agent/smart-trust/orders/:id/record-resolution
 * Queues recordSmartTrustResolutionCheckpoint — minutes record only; no filing or signatures.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const result = await recordSmartTrustResolutionFromOrder(db, { adminUserId, orderId, body });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.approvalId ? { approvalId: result.approvalId } : {}),
      },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    approvalId: result.approvalId,
    orderId: result.orderId,
    resolutionId: result.resolutionId,
    pipelineStage: result.pipelineStage,
    proposedAction: "recordSmartTrustResolutionCheckpoint",
    message: result.message,
  });
}
