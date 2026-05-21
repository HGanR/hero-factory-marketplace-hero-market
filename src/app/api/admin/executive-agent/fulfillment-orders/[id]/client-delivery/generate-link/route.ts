import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { generateClientDeliveryLink } from "@/lib/fulfillment/fulfillment-client-delivery-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST — owner explicitly creates expiring client review link (no email). */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  let body: { expiresInDays?: number; regenerate?: boolean } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const result = await generateClientDeliveryLink(db, {
    orderId,
    adminUserId,
    expiresInDays: body.expiresInDays,
    regenerate: Boolean(body.regenerate),
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    tokenId: result.tokenId,
    workspaceUrl: result.workspaceUrl,
    expiresAt: result.expiresAt,
    draftVersion: result.draftVersion,
    message: "Copy the workspace URL and share it with your client manually (no email sent).",
  });
}
