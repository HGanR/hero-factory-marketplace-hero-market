import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadClientDeliveryWorkspace } from "@/lib/fulfillment/fulfillment-client-delivery-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ token: string }> };

/** GET — read-only client delivery workspace payload. */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const db = await getDb();
  const result = await loadClientDeliveryWorkspace(db, token, { recordView: true });

  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid_token: "This review link is invalid.",
      token_revoked: "This review link has been revoked.",
      token_expired: "This review link has expired.",
      token_inactive: "This review link is no longer active.",
      order_not_found: "This project is no longer available.",
      deliverable_not_found: "Draft not found.",
    };
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: messages[result.code] ?? result.message,
      },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
