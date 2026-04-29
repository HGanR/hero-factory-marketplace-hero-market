import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getNFTById, createListing, createActivity, checkIfNFTIsStaked } from "@/lib/marketplace/nft-queries";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nftId, price, currency, listingType, auctionDurationHours, sellerAddress } = body;

    if (!nftId || !price || !currency || !listingType) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    if (listingType === "auction" && !auctionDurationHours) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Auction duration is required for auction listings" } },
        { status: 400 }
      );
    }

    // Verify NFT ownership
    const nft = await getNFTById(nftId);

    if (!nft) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "NFT not found" } }, { status: 404 });
    }

    const seller = sellerAddress || nft.ownerAddress;
    if (nft.ownerAddress.toLowerCase() !== seller.toLowerCase()) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "You do not own this NFT" } }, { status: 403 });
    }

    const isStaked = await checkIfNFTIsStaked(nftId);
    if (isStaked) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Cannot list staked NFT" } }, { status: 400 });
    }

    if (nft.isListed) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "NFT is already listed" } }, { status: 400 });
    }

    // Calculate auction end time
    let auctionEndTime = null;
    if (listingType === "auction" && auctionDurationHours) {
      auctionEndTime = new Date(Date.now() + auctionDurationHours * 60 * 60 * 1000);
    }

    // Create listing in database
    const listingId = await createListing({
      nftId,
      sellerAddress: seller,
      price: parseFloat(price),
      currency,
      listingType: listingType as "fixed" | "auction",
      endTime: auctionEndTime || undefined,
    });

    // Record activity
    await createActivity({
      nftId,
      activityType: "list",
      fromAddress: seller,
      price: parseFloat(price),
      currency,
    });
    return NextResponse.json({
      ok: true,
      listingId,
      message: "NFT listed successfully",
    });
  } catch (error: any) {
    console.error("List NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to list NFT" } },
      { status: 500 }
    );
  }
}
