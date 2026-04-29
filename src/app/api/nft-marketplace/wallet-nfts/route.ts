import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { nfts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("address");
    const chain = searchParams.get("chain") || "all";

    console.log("Wallet NFT API called with address:", walletAddress, "chain:", chain);

    if (!walletAddress) {
      console.log("No wallet address provided");
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_ADDRESS", message: "Wallet address is required" } },
        { status: 400 }
      );
    }

    // Normalize wallet address (lowercase for consistency)
    const normalizedAddress = walletAddress.toLowerCase();

    let dbNfts: Array<any> = [];
    try {
      const db = await getDb();
      const conditions = [eq(nfts.ownerAddress, normalizedAddress)];
      if (chain !== "all") {
        conditions.push(eq(nfts.chain, chain as "ethereum" | "polygon" | "xrpl" | "solana" | "metallicus"));
      }
      const walletNfts = await db
        .select()
        .from(nfts)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]);
      dbNfts = walletNfts.map((nft) => ({
        id: nft.id,
        tokenId: nft.tokenId,
        name: nft.name,
        description: nft.description,
        imageUrl: nft.imageUrl,
        chain: nft.chain,
        ownerAddress: nft.ownerAddress,
        isListed: nft.isListed,
        contractAddress: nft.contractAddress,
        attributes: nft.attributes ? JSON.parse(nft.attributes) : null,
      }));
    } catch (dbErr) {
      console.error("Wallet NFT DB query failed:", dbErr);
    }

    return NextResponse.json({
      ok: true,
      nfts: dbNfts,
      count: dbNfts.length,
      walletAddress: normalizedAddress,
      chain: chain,
    });
  } catch (error: any) {
    console.error("Wallet NFT API error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch wallet NFTs" } },
      { status: 500 }
    );
  }
}