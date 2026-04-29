import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { listBuilderActionRunsForSite } from "@/lib/site-builder/log-builder-action-run";

export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    const runs = await listBuilderActionRunsForSite(db, siteId, limit);
    return NextResponse.json({ runs });
  } catch (e) {
    console.error("action-runs GET", e);
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
