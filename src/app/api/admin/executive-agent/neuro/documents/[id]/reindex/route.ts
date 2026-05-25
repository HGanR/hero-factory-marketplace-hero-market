import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { reindexNeuroDocument } from "@/lib/executive-agent/neuro/neuro-indexing-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const adminUserId = await getExecutiveAdminUserId(_req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = await getDb();
  const result = await reindexNeuroDocument(db, adminUserId, id);
  if ("error" in result && result.error) {
    const status = result.error === "not_found" ? 404 : 500;
    return NextResponse.json(
      { error: result.error, message: "message" in result ? result.message : undefined },
      { status }
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
