import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { runExecutiveRoutineByIdForAdmin } from "@/lib/executive-agent/executive-routine-runner";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const result = await runExecutiveRoutineByIdForAdmin(db, id.trim(), adminUserId);
    if (!result) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ROUTINE_RUN_FAILED", message: msg }, { status: 500 });
  }
}
