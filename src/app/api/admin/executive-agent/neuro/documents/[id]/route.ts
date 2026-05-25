import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listNeuroDocuments } from "@/lib/executive-agent/neuro/neuro-store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = await getDb();
  const documents = await listNeuroDocuments(db, adminUserId);
  const document = documents.find((d) => d.id === id);
  if (!document) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, document });
}
