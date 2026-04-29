import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3SiteTemplates } from "@/lib/db/schema";
import { ensureSiteBuilderTables } from "@/lib/site-builder/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { templateId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    await db
      .delete(web3SiteTemplates)
      .where(and(eq(web3SiteTemplates.id, templateId), eq(web3SiteTemplates.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("site-builder/templates/[templateId] DELETE failed", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}

