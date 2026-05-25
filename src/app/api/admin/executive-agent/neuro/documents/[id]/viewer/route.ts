import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildNeuroDocumentViewerDto } from "@/lib/executive-agent/neuro/neuro-viewer-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const chunkId = req.nextUrl.searchParams.get("chunkId");
  const q = req.nextUrl.searchParams.get("q");

  const db = await getDb();
  const viewer = await buildNeuroDocumentViewerDto(db, adminUserId, id, {
    chunkId,
    highlightQuery: q,
  });
  if (!viewer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, viewer });
}
