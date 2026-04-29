import { NextRequest, NextResponse } from "next/server";
import { getNFTById, getListingByNFTId } from "@/lib/marketplace/nft-queries";
import { parseAttributes } from "@/lib/marketplace/utils";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const nft = await getNFTById(id);
    if (!nft) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "NFT not found" } }, { status: 404 });
    }

    // Get active listing if exists
    let listing = null;
    if (nft.isListed) {
      listing = await getListingByNFTId(id);
    }

    // Transform to match expected format
    const nftDetail = {
      id: nft.id,
      tokenId: nft.tokenId,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.imageUrl,
      chain: nft.chain,
      contractAddress: nft.contractAddress || "",
      ownerAddress: nft.ownerAddress,
      creatorAddress: nft.creatorAddress,
      isListed: nft.isListed,
      listPrice: nft.listPrice ? parseFloat(nft.listPrice) : undefined,
      listCurrency: nft.listCurrency || undefined,
      listingId: listing?.id || undefined,
      royaltyPercentage: parseFloat(nft.royaltyPercentage || "0"),
      attributes: parseAttributes(nft.attributes),
    };

    return NextResponse.json({
      ok: true,
      nft: nftDetail,
    });
  } catch (error: any) {
    console.error("Get NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch NFT" } },
      { status: 500 }
    );
  }
}
