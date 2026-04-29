import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites, web3SiteVersions } from "@/lib/db/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string; versionId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId, versionId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const [version] = await db
      .select({ id: web3SiteVersions.id })
      .from(web3SiteVersions)
      .where(and(eq(web3SiteVersions.id, versionId), eq(web3SiteVersions.siteId, site.id)))
      .limit(1);

    if (!version) return NextResponse.json({ error: "Version not found for site" }, { status: 404 });

    await db
      .update(web3Sites)
      .set({ currentVersionId: version.id })
      .where(and(eq(web3Sites.id, site.id), eq(web3Sites.userId, userId)));

    const [updated] = await db.select().from(web3Sites).where(eq(web3Sites.id, site.id)).limit(1);
    return NextResponse.json({ site: updated });
  } catch (error) {
    console.error("site-builder set-current failed", error);
    return NextResponse.json({ error: "Failed to set current version" }, { status: 500 });
  }
}
