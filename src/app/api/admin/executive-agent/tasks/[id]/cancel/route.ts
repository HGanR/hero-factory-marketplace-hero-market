import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { cancelExecutiveOperationalTask } from "@/lib/executive-agent/operational-task-service";

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  cancelReason: z.string().max(2000).optional().nullable(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const body = PostSchema.parse(await req.json().catch(() => ({})));
    const db = await getDb();
    const result = await cancelExecutiveOperationalTask(db, {
      adminUserId,
      taskId: id,
      cancelReason: body.cancelReason,
    });
    if (!result.ok) {
      const status = result.error === "task_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION", issues: e.issues }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "CANCEL_FAILED", message: msg }, { status: 500 });
  }
}
