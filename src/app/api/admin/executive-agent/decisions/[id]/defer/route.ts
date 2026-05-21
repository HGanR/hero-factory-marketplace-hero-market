import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { deferExecutiveOperationalDecision } from "@/lib/executive-agent/decision-recording-service";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  deferredUntil: z.string().min(1),
  deferReason: z.string().max(2000).optional().nullable(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const body = PostSchema.parse(await req.json());
    const db = await getDb();
    const result = await deferExecutiveOperationalDecision(db, {
      adminUserId,
      decisionId: id,
      deferredUntil: body.deferredUntil,
      deferReason: body.deferReason,
    });
    if (!result.ok) {
      const status = result.error === "decision_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "DEFER_FAILED", message: msg }, { status: 500 });
  }
}
