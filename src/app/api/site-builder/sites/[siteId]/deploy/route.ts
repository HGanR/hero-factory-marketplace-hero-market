import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites, web3SiteVersions } from "@/lib/db/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { markLatestSiteGenerationRunPublished } from "@/lib/site-builder/intelligence/publish-intelligence";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { uploadArbitraryJSONToIPFS } from "@/lib/marketplace/pinata";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const body = await req.json().catch(() => ({}));
    const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";

    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const targetVersionId = versionId || site.currentVersionId || "";
    if (!targetVersionId) {
      return NextResponse.json({ error: "No version selected. Provide versionId or set current version first." }, { status: 400 });
    }

    const [version] = await db
      .select()
      .from(web3SiteVersions)
      .where(and(eq(web3SiteVersions.id, targetVersionId), eq(web3SiteVersions.siteId, site.id)))
      .limit(1);
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

    const parsedSchemaJson = JSON.parse(version.schemaJson || "{}");
    const schemaParse = SiteSchemaDocument.safeParse(parsedSchemaJson);
    if (!schemaParse.success) {
      return NextResponse.json({ error: "Stored version schema is invalid", issues: schemaParse.error.issues }, { status: 400 });
    }

    const generated = generateStaticBundle(schemaParse.data);
    const bundlePayload = {
      siteId: site.id,
      versionId: version.id,
      version: version.version,
      generatedAt: new Date().toISOString(),
      metadata: schemaParse.data.metadata ?? {},
      files: generated.files.map((file) => ({
        path: file.path,
        contentType: file.contentType,
        content: file.content,
        bytes: file.bytes,
        sha256: file.sha256,
      })),
      manifest: generated.manifest,
    };

    const upload = await uploadArbitraryJSONToIPFS(bundlePayload);
    const ipfsCid = upload.ipfsHash;
    const ipfsUri = upload.ipfsUrl;

    await db
      .update(web3SiteVersions)
      .set({
        ipfsCid: ipfsCid,
        buildManifestJson: JSON.stringify(generated.manifest),
      })
      .where(and(eq(web3SiteVersions.id, version.id), eq(web3SiteVersions.siteId, site.id)));

    await db
      .update(web3Sites)
      .set({
        currentVersionId: version.id,
        status: "PUBLISHED",
      })
      .where(and(eq(web3Sites.id, site.id), eq(web3Sites.userId, userId)));

    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCid}`;
    void markLatestSiteGenerationRunPublished(db, {
      userId,
      siteId: site.id,
      publishedVersionId: version.id,
      deployedUrl: gatewayUrl,
    });

    return NextResponse.json({
      ok: true,
      siteId: site.id,
      versionId: version.id,
      ipfsCid,
      ipfsUri,
      gatewayUrl,
      manifest: generated.manifest,
    });
  } catch (error) {
    console.error("site-builder deploy failed", error);
    const message = error instanceof Error ? error.message : "Failed to deploy site version";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
