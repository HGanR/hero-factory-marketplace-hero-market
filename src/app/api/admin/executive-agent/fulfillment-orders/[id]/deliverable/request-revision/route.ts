import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { requestDeliverableRevision } from "@/lib/fulfillment/fulfillment-deliverable-draft";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST …/fulfillment-orders/:id/deliverable/request-revision
 * Owner rejects draft for revision — routes back to service_drafting; no client send.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  let revisionNote: string | null = null;
  try {
    const text = await req.text();
    if (text.trim()) {
      const body = JSON.parse(text) as { revisionNote?: string };
      revisionNote = body.revisionNote?.trim() || null;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const result = await requestDeliverableRevision(db, {
    orderId,
    adminUserId,
    revisionNote,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    pipelineStage: result.pipelineStage,
    ownerReviewStatus: result.ownerReviewStatus,
    message: result.message,
  });
}
