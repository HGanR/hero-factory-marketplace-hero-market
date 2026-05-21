import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clientRequestDeliveryRevision } from "@/lib/fulfillment/fulfillment-client-delivery-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
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
  const result = await clientRequestDeliveryRevision(db, token, revisionNote);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
