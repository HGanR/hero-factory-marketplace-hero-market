import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { deleteExecutiveKnowledgeDocument } from "@/lib/executive-agent/executive-knowledge-store";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  try {
    const db = await getDb();
    await deleteExecutiveKnowledgeDocument(db, adminUserId, id.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "DELETE_FAILED", message: msg }, { status: 500 });
  }
}
