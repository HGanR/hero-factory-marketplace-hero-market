import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getListingById, getNFTById, createSale } from "@/lib/marketplace/nft-queries";
import { calculatePlatformFee, calculateRoyalty, calculateSellerProceeds } from "@/lib/marketplace/utils";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { listingId, buyerAddress, txHash } = body;

    if (!listingId || !buyerAddress || !txHash) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    // Get listing details
    const listing = await getListingById(listingId);

    if (!listing) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Listing not found" } }, { status: 404 });
    }

    if (listing.status !== "active") {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Listing is not active" } }, { status: 400 });
    }

    // Get NFT details
    const nft = await getNFTById(listing.nftId);

    if (!nft) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "NFT not found" } }, { status: 404 });
    }

    // Calculate fees
    const salePrice = parseFloat(listing.price);
    const platformFee = calculatePlatformFee(salePrice, 2.5);
    const royaltyAmount = calculateRoyalty(salePrice, parseFloat(nft.royaltyPercentage || "0"));
    const sellerProceeds = calculateSellerProceeds(salePrice, 2.5, parseFloat(nft.royaltyPercentage || "0"));

    // Record sale in database
    const saleId = await createSale({
      listingId,
      nftId: nft.id,
      sellerAddress: listing.sellerAddress,
      buyerAddress,
      price: salePrice,
      currency: listing.currency,
      royaltyAmount,
      platformFee,
      txHash,
    });
    return NextResponse.json({
      ok: true,
      saleId,
      nftId: nft.id,
      message: "NFT purchased successfully",
      details: {
        salePrice,
        platformFee,
        royaltyAmount,
        sellerProceeds,
      },
    });
  } catch (error: any) {
    console.error("Buy NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to purchase NFT" } },
      { status: 500 }
    );
  }
}
