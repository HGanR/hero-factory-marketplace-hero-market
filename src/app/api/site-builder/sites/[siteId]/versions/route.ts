import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites, web3SiteVersions } from "@/lib/db/schema";
import { CreateVersionSchema } from "@/lib/site-builder/schema";
import { hashSiteSchema } from "@/lib/site-builder/hash";
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

    const versions = await db
      .select()
      .from(web3SiteVersions)
      .where(eq(web3SiteVersions.siteId, site.id))
      .orderBy(desc(web3SiteVersions.version), desc(web3SiteVersions.createdAt));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("site-builder/sites/[siteId]/versions GET failed", error);
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = CreateVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const versionId = crypto.randomUUID();
    const schemaHash = hashSiteSchema(parsed.data.schemaJson);

    const [versionResult] = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${web3SiteVersions.version}), 0)` })
      .from(web3SiteVersions)
      .where(eq(web3SiteVersions.siteId, site.id));
    const nextVersion = Number(versionResult?.maxVersion ?? 0) + 1;

    await db.insert(web3SiteVersions).values({
      id: versionId,
      siteId: site.id,
      version: nextVersion,
      schemaJson: JSON.stringify(parsed.data.schemaJson),
      schemaHash,
      createdByUserId: userId,
      createdByWallet: parsed.data.createdByWallet?.trim() || null,
    });

    if (parsed.data.setCurrent) {
      await db
        .update(web3Sites)
        .set({
          currentVersionId: versionId,
          status: "DRAFT",
        })
        .where(and(eq(web3Sites.id, site.id), eq(web3Sites.userId, userId)));
    }

    const [inserted] = await db
      .select()
      .from(web3SiteVersions)
      .where(eq(web3SiteVersions.id, versionId))
      .limit(1);

    return NextResponse.json(
      {
        version: inserted,
        schemaHash,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("site-builder/sites/[siteId]/versions POST failed", error);
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }
}
