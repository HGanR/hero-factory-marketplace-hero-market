import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getDb } from "@/lib/db";
import { web3Sites, web3SiteVersions } from "@/lib/db/schema";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";
import { UpdateSiteSchema } from "@/lib/site-builder/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    let currentVersion: any = null;
    if (site.currentVersionId) {
      const [version] = await db
        .select()
        .from(web3SiteVersions)
        .where(
          and(
            eq(web3SiteVersions.id, site.currentVersionId),
            eq(web3SiteVersions.siteId, site.id)
          )
        )
        .limit(1);
      currentVersion = version ?? null;
    }

    return NextResponse.json({ site, currentVersion });
  } catch (error) {
    console.error("site-builder/sites/[siteId] GET failed", error);
    return NextResponse.json({ error: "Failed to load site" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug ? parsed.data.slug.trim() : null;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.ownerWallet !== undefined) updates.ownerWallet = parsed.data.ownerWallet ? parsed.data.ownerWallet.trim() : null;
    if (parsed.data.currentVersionId !== undefined) {
      if (parsed.data.currentVersionId) {
        const [version] = await db
          .select({ id: web3SiteVersions.id })
          .from(web3SiteVersions)
          .where(
            and(
              eq(web3SiteVersions.id, parsed.data.currentVersionId),
              eq(web3SiteVersions.siteId, site.id)
            )
          )
          .limit(1);
        if (!version) return NextResponse.json({ error: "Invalid currentVersionId for site" }, { status: 400 });
      }
      updates.currentVersionId = parsed.data.currentVersionId;
    }
    if (parsed.data.clientId !== undefined) {
      await ensureClientHubTables();
      if (parsed.data.clientId) {
        const c = await getOwnedClientRow(userId, parsed.data.clientId);
        if (!c) {
          return NextResponse.json({ error: "Client not found or access denied" }, { status: 403 });
        }
        updates.clientId = c.id;
      } else {
        updates.clientId = null;
      }
    }

    await db.update(web3Sites).set(updates).where(and(eq(web3Sites.id, site.id), eq(web3Sites.userId, userId)));
    const [updated] = await db.select().from(web3Sites).where(eq(web3Sites.id, site.id)).limit(1);
    return NextResponse.json({ site: updated });
  } catch (error) {
    console.error("site-builder/sites/[siteId] PATCH failed", error);
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }
}
