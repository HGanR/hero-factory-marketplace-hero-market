import { NextRequest, NextResponse } from "next/server";
import { getConnection, getDb } from "@/lib/db";
import { nftCollections, nfts } from "@/lib/db/schema";
import { and, eq, desc, asc, like, or } from "drizzle-orm";

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
    const query = (searchParams.get("q") || "").trim();
    const sort = searchParams.get("sort") || "newest";
    const collectionId = searchParams.get("collectionId") || "all";
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const connection = await getConnection();
    let hasIsPublic = true;
    try {
      const [rows] = await connection.query(
        "SELECT COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nft_collections'"
      );
      const cols = new Set(
        Array.isArray(rows)
          ? rows.map((r: any) => r.columnName || r.COLUMN_NAME).filter(Boolean)
          : []
      );
      hasIsPublic = cols.has("isPublic");
    } catch {
      hasIsPublic = false;
    }

    const db = await getDb();

    let baseCondition: any = hasIsPublic
      ? and(
          eq(nftCollections.isPublic, true),
          chain === "all" ? eq(nftCollections.isPublic, true) : eq(nftCollections.chain, chain as any)
        )
      : chain === "all"
        ? undefined
        : eq(nftCollections.chain, chain as any);

    if (collectionId !== "all") {
      const c = eq(nfts.collectionId, collectionId);
      baseCondition = baseCondition ? and(baseCondition, c) : c;
    }

    if (query) {
      const likeQuery = `%${query}%`;
      const searchCondition = or(
        like(nfts.name, likeQuery),
        like(nfts.description, likeQuery),
        like(nftCollections.name, likeQuery),
        like(nftCollections.symbol, likeQuery)
      );
      baseCondition = baseCondition ? and(baseCondition, searchCondition) : searchCondition;
    }

    const orderBy =
      sort === "price_low"
        ? asc(nfts.listPrice)
        : sort === "price_high"
          ? desc(nfts.listPrice)
          : sort === "name"
            ? asc(nfts.name)
            : desc(nfts.mintedAt);

    const rows = await db
      .select({
        nft: nfts,
        collection: nftCollections,
      })
      .from(nfts)
      .innerJoin(nftCollections, eq(nfts.collectionId, nftCollections.id))
      .where(baseCondition as any)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const items = rows
      .filter((row) => isVisible(row.nft.attributes))
      .map((row) => ({
        id: row.nft.id,
        tokenId: row.nft.tokenId,
        name: row.nft.name,
        description: row.nft.description,
        imageUrl: row.nft.imageUrl,
        chain: row.nft.chain,
        ownerAddress: row.nft.ownerAddress,
        isListed: row.nft.isListed,
        listPrice: row.nft.listPrice ? parseFloat(String(row.nft.listPrice)) : 0,
        listCurrency: row.nft.listCurrency ?? "",
        contractAddress: row.nft.contractAddress ?? null,
        attributes: row.nft.attributes ? JSON.parse(row.nft.attributes) : null,
        collection: {
          id: row.collection.id,
          name: row.collection.name,
          symbol: row.collection.symbol,
          contractAddress: row.collection.contractAddress,
        },
      }));

    return NextResponse.json({
      ok: true,
      nfts: items,
      count: items.length,
    });
  } catch (error: any) {
    console.error("Public assets error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch public assets" } },
      { status: 500 }
    );
  }
}
