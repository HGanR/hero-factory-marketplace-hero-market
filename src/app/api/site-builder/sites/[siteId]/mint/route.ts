import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites, web3SiteVersions } from "@/lib/db/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { uploadJSONToIPFS } from "@/lib/marketplace/pinata";

const MintPrepareSchema = z.object({
  chainId: z.number().int().positive(),
  contract: z.string().min(1).max(140),
  toWallet: z.string().min(1).max(140),
  versionId: z.string().uuid().optional(),
  siteName: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = MintPrepareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const versionId = parsed.data.versionId || site.currentVersionId || "";
    if (!versionId) return NextResponse.json({ error: "No version selected for mint" }, { status: 400 });

    const [version] = await db
      .select()
      .from(web3SiteVersions)
      .where(and(eq(web3SiteVersions.id, versionId), eq(web3SiteVersions.siteId, site.id)))
      .limit(1);
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    if (!version.ipfsCid) return NextResponse.json({ error: "Version must be deployed to IPFS before minting" }, { status: 400 });

    const tokenMetadata = {
      name: parsed.data.siteName?.trim() || site.name,
      description: parsed.data.description?.trim() || "Web3 Trust Site ownership NFT",
      image: "ipfs://placeholder/site-builder-preview",
      external_url: `ipfs://${version.ipfsCid}`,
      attributes: [
        { trait_type: "Site ID", value: site.id },
        { trait_type: "Version ID", value: version.id },
        { trait_type: "Version", value: String(version.version) },
        { trait_type: "Schema Hash", value: version.schemaHash },
        { trait_type: "IPFS CID", value: version.ipfsCid },
        { trait_type: "Trust ID", value: site.trustId || "" },
      ],
    };

    const metadataUpload = await uploadJSONToIPFS(tokenMetadata);
    const tokenUri = metadataUpload.ipfsUrl;

    return NextResponse.json({
      ok: true,
      mintIntent: {
        chainId: parsed.data.chainId,
        contract: parsed.data.contract,
        functionName: "mintSiteNFT",
        args: [parsed.data.toWallet, tokenUri],
      },
      tokenUri,
      metadataIpfsHash: metadataUpload.ipfsHash,
      site: {
        id: site.id,
        name: site.name,
      },
      version: {
        id: version.id,
        version: version.version,
        ipfsCid: version.ipfsCid,
      },
      next: "After wallet mint transaction, call /api/site-builder/sites/[siteId]/mint/confirm",
    });
  } catch (error) {
    console.error("site-builder mint prepare failed", error);
    const message = error instanceof Error ? error.message : "Failed to prepare mint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
