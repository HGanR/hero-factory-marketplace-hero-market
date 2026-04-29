import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { nftCollections, nfts } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function ensureCollectionsTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nft_collections (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      description TEXT,
      imageUrl TEXT,
      chain ENUM('xrpl','solana','ethereum','polygon','metallicus') NOT NULL,
      contractAddress VARCHAR(255),
      creatorAddress VARCHAR(255) NOT NULL,
      royaltyPercentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      isPublic BOOLEAN NOT NULL DEFAULT false,
      isVerified BOOLEAN NOT NULL DEFAULT false,
      totalSupply INT NOT NULL DEFAULT 0,
      floorPrice DECIMAL(20,8),
      volumeTraded DECIMAL(30,8) NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX nft_collections_chain_idx (chain),
      INDEX nft_collections_creator_idx (creatorAddress),
      INDEX nft_collections_verified_idx (isVerified)
    )
  `);
}

async function ensureNftsTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nfts (
      id VARCHAR(36) PRIMARY KEY,
      tokenId VARCHAR(255) NOT NULL,
      chain ENUM('xrpl','solana','ethereum','polygon','metallicus') NOT NULL,
      contractAddress VARCHAR(255),
      ownerAddress VARCHAR(255) NOT NULL,
      creatorAddress VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      imageUrl TEXT NOT NULL,
      metadataUrl TEXT,
      attributes TEXT,
      collectionId VARCHAR(36),
      isListed BOOLEAN NOT NULL DEFAULT false,
      listPrice DECIMAL(20,8),
      listCurrency VARCHAR(10),
      royaltyPercentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      isStaked BOOLEAN NOT NULL DEFAULT false,
      mintedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX nfts_chain_token_idx (chain, tokenId),
      INDEX nfts_owner_idx (ownerAddress),
      INDEX nfts_creator_idx (creatorAddress),
      INDEX nfts_collection_idx (collectionId),
      INDEX nfts_listed_idx (isListed),
      INDEX nfts_staked_idx (isStaked)
    )
  `);

  const alterStatements = [
    "ALTER TABLE nfts ADD COLUMN contractAddress VARCHAR(255)",
    "ALTER TABLE nfts ADD COLUMN ownerAddress VARCHAR(255) NOT NULL",
    "ALTER TABLE nfts ADD COLUMN creatorAddress VARCHAR(255) NOT NULL",
    "ALTER TABLE nfts ADD COLUMN description TEXT",
    "ALTER TABLE nfts ADD COLUMN metadataUrl TEXT",
    "ALTER TABLE nfts ADD COLUMN attributes TEXT",
    "ALTER TABLE nfts ADD COLUMN collectionId VARCHAR(36)",
    "ALTER TABLE nfts ADD COLUMN isListed BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE nfts ADD COLUMN listPrice DECIMAL(20,8)",
    "ALTER TABLE nfts ADD COLUMN listCurrency VARCHAR(10)",
    "ALTER TABLE nfts ADD COLUMN royaltyPercentage DECIMAL(5,2) NOT NULL DEFAULT 0",
    "ALTER TABLE nfts ADD COLUMN isStaked BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE nfts ADD COLUMN mintedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE nfts ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    "ALTER TABLE nfts ADD INDEX nfts_collection_idx (collectionId)",
  ];
  for (const stmt of alterStatements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // ignore if column/index exists
    }
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = (await ctx.params).id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const db = await getDb();
    await ensureCollectionsTable(db);
    await ensureNftsTable(db);

    const collection = (
      await db.select().from(nftCollections).where(eq(nftCollections.id, id)).limit(1)
    )[0];

    if (!collection) {
      return NextResponse.json({ ok: false, error: "Collection not found" }, { status: 404 });
    }

    const rows = await db.select().from(nfts).where(eq(nfts.collectionId, id));

    const items = rows.map((nft) => ({
      id: nft.id,
      tokenId: nft.tokenId,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.imageUrl,
      chain: nft.chain,
      ownerAddress: nft.ownerAddress,
      isListed: nft.isListed,
      listPrice: nft.listPrice ? parseFloat(String(nft.listPrice)) : 0,
      listCurrency: nft.listCurrency ?? "",
      contractAddress: nft.contractAddress ?? null,
      attributes: nft.attributes ? JSON.parse(nft.attributes) : null,
    }));

    return NextResponse.json({ ok: true, collection, nfts: items });
  } catch (error: any) {
    console.error("Collection detail error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load collection" },
      { status: 500 }
    );
  }
}
