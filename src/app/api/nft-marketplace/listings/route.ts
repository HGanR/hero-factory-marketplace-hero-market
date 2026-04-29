import { NextRequest, NextResponse } from "next/server";
import { getActiveListings } from "@/lib/marketplace/nft-queries";
import { getDb } from "@/lib/db";
import { nfts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

function isVisible(attributes: string | null): boolean {
  if (!attributes) return true;
  try {
    const parsed = JSON.parse(attributes);
    if (!Array.isArray(parsed)) return true;
    const vis = parsed.find((a) => String(a?.trait_type || "").toLowerCase() === "visibility");
    if (!vis) return true;
    const val = String(vis.value || "").toLowerCase();
    return val !== "hidden";
  } catch {
    return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get("chain") || "all";
    const includeUnlisted = searchParams.get("includeUnlisted") === "1";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const listings = await getActiveListings(chain === "all" ? undefined : chain, limit, offset);

    // Transform to match expected format
    const listedNfts = listings
      .filter((item) => isVisible(item.nft.attributes))
      .map((item) => ({
      id: item.nft.id,
      tokenId: item.nft.tokenId,
      name: item.nft.name,
      description: item.nft.description,
      imageUrl: item.nft.imageUrl,
      chain: item.nft.chain,
      ownerAddress: item.nft.ownerAddress,
      isListed: item.nft.isListed,
      listPrice: parseFloat(item.listing.price),
      listCurrency: item.listing.currency,
      contractAddress: item.nft.contractAddress,
      }));

    let unlisted: typeof listedNfts = [];
    if (includeUnlisted) {
      const db = await getDb();
      const rows = await db
        .select()
        .from(nfts)
        .where(
          chain === "all"
            ? eq(nfts.isListed, false)
            : and(eq(nfts.isListed, false), eq(nfts.chain, chain as any))
        )
        .limit(limit)
        .offset(offset);

      unlisted = rows
        .filter((row) => isVisible(row.attributes))
        .map((row) => ({
          id: row.id,
          tokenId: row.tokenId,
          name: row.name,
          description: row.description,
          imageUrl: row.imageUrl,
          chain: row.chain,
          ownerAddress: row.ownerAddress,
          isListed: row.isListed,
          listPrice: row.listPrice ? parseFloat(String(row.listPrice)) : 0,
          listCurrency: row.listCurrency ?? "",
          contractAddress: row.contractAddress ?? null,
        }));
    }

    const byId = new Map(listedNfts.map((nft) => [nft.id, nft]));
    for (const nft of unlisted) {
      if (!byId.has(nft.id)) byId.set(nft.id, nft);
    }
    const mergedNfts = Array.from(byId.values());

    return NextResponse.json({
      ok: true,
      nfts: mergedNfts,
      count: mergedNfts.length,
    });
  } catch (error: any) {
    console.error("List listings error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch listings" } },
      { status: 500 }
    );
  }
}
