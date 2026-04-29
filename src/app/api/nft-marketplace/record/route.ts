import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { nfts, nftCollections } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createNFT } from "@/lib/marketplace/nft-queries";

type RecordNFTRequest = {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: "xrpl" | "solana" | "ethereum" | "polygon" | "metallicus";
  contractAddress?: string;
  ownerAddress: string;
  creatorAddress: string;
  royaltyPercentage?: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  collectionId?: string;
  metadataUrl?: string;
};

function ensureVisibilityAttribute(attrs: Array<{ trait_type: string; value: string | number }> | undefined) {
  const list = Array.isArray(attrs) ? [...attrs] : [];
  const hasVisibility = list.some(
    (a) => String(a?.trait_type || "").toLowerCase() === "visibility"
  );
  if (!hasVisibility) {
    list.push({ trait_type: "visibility", value: "public" });
  }
  return list;
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

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body: RecordNFTRequest = await req.json();
    const {
      tokenId,
      name,
      description,
      imageUrl,
      chain,
      contractAddress,
      ownerAddress,
      creatorAddress,
      royaltyPercentage,
      attributes,
      collectionId,
      metadataUrl,
    } = body;

    if (!tokenId || !name || !imageUrl || !chain || !ownerAddress || !creatorAddress) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const db = await getDb();
    await ensureNftsTable(db);

    const normalizedCreator = creatorAddress.toLowerCase();
    const normalizedOwner = ownerAddress.toLowerCase();
    let resolvedCollectionId = collectionId;
    let resolvedCollectionCreator: string | null = null;
    if (!resolvedCollectionId && contractAddress) {
      const rows = await db
        .select()
        .from(nftCollections)
        .where(and(eq(nftCollections.contractAddress, contractAddress), eq(nftCollections.chain, chain as any)))
        .limit(1);
      resolvedCollectionId = rows[0]?.id || undefined;
      resolvedCollectionCreator = rows[0]?.creatorAddress || null;
    } else if (resolvedCollectionId) {
      const rows = await db
        .select()
        .from(nftCollections)
        .where(and(eq(nftCollections.id, resolvedCollectionId), eq(nftCollections.chain, chain as any)))
        .limit(1);
      if (!rows[0]) {
        return NextResponse.json(
          { ok: false, error: { code: "BAD_REQUEST", message: "Collection not found" } },
          { status: 400 }
        );
      }
      resolvedCollectionCreator = rows[0]?.creatorAddress || null;
    }

    if (resolvedCollectionCreator && resolvedCollectionCreator.toLowerCase() !== normalizedCreator) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Only the collection creator can mint NFTs into this collection",
          },
        },
        { status: 403 }
      );
    }

    const attrs = ensureVisibilityAttribute(attributes);
    const nftId = await createNFT({
      tokenId,
      name,
      description: description || "",
      imageUrl,
      chain,
      contractAddress,
      ownerAddress: normalizedOwner,
      creatorAddress: normalizedCreator,
      royaltyPercentage: royaltyPercentage || 0,
      attributes: attrs,
      collectionId: resolvedCollectionId,
    });

    if (metadataUrl) {
      await db.update(nfts).set({ metadataUrl }).where(eq(nfts.id, nftId));
    }

    return NextResponse.json({ ok: true, nftId });
  } catch (error: any) {
    console.error("Record NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to record NFT" } },
      { status: 500 }
    );
  }
}
