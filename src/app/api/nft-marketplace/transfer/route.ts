import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getNFTById, updateNFTOwner, setNFTListingStatus, createActivity } from "@/lib/marketplace/nft-queries";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nftId, recipientAddress, senderAddress, txHash } = body;

    if (!nftId || !recipientAddress || !senderAddress) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const nft = await getNFTById(nftId);
    if (!nft) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "NFT not found" } }, { status: 404 });
    }

    const sender = String(senderAddress).toLowerCase();
    if (nft.ownerAddress.toLowerCase() !== sender) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "You do not own this NFT" } }, { status: 403 });
    }

    if (nft.creatorAddress.toLowerCase() !== sender) {
      return NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "Only the creator can transfer this NFT" } },
        { status: 403 }
      );
    }

    await updateNFTOwner(nftId, recipientAddress);
    await setNFTListingStatus(nftId, false);
    await createActivity({
      nftId,
      activityType: "transfer",
      fromAddress: sender,
      toAddress: recipientAddress,
      txHash,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Transfer NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to transfer NFT" } },
      { status: 500 }
    );
  }
}
