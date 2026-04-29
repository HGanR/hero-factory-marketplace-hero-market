import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites } from "@/lib/db/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { verifyNftOwnership } from "@/lib/site-builder/chain";

const MintConfirmSchema = z.object({
  chainId: z.number().int().positive(),
  contract: z.string().min(1).max(140),
  tokenId: z.string().min(1).max(120),
  txHash: z.string().min(1).max(140),
  expectedOwnerWallet: z.string().min(1).max(140),
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
    const parsed = MintConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const ownership = await verifyNftOwnership({
      chainId: parsed.data.chainId,
      contract: parsed.data.contract,
      tokenId: parsed.data.tokenId,
      expectedOwner: parsed.data.expectedOwnerWallet,
    });

    if (!ownership.ok) {
      return NextResponse.json(
        {
          error: "Ownership verification failed",
          details: ownership.reason || "ownerOf check did not match expected owner",
          owner: ownership.owner,
        },
        { status: 400 }
      );
    }

    await db
      .update(web3Sites)
      .set({
        ownerWallet: parsed.data.expectedOwnerWallet.trim(),
        nftChainId: parsed.data.chainId,
        nftContract: parsed.data.contract.trim(),
        nftTokenId: parsed.data.tokenId.trim(),
      })
      .where(and(eq(web3Sites.id, site.id), eq(web3Sites.userId, userId)));

    const [updated] = await db.select().from(web3Sites).where(eq(web3Sites.id, site.id)).limit(1);

    return NextResponse.json({
      ok: true,
      site: updated,
      txHash: parsed.data.txHash,
      owner: ownership.owner,
    });
  } catch (error) {
    console.error("site-builder mint confirm failed", error);
    const message = error instanceof Error ? error.message : "Failed to confirm mint";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
