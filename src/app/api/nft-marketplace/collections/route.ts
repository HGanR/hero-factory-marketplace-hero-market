// src/app/api/nft-marketplace/collections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { createCollection } from "@/lib/marketplace/nft-queries";
import { sql } from "drizzle-orm";

/**
 * POST /api/nft-marketplace/collections
 * Create a new NFT collection
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const db = await getDb();
    await ensureCollectionsTable(db);

    const body = await req.json();
    const {
      name,
      symbol,
      description,
      chain,
      creatorAddress,
      royaltyPercentage,
      imageUrl,
      contractAddress,
      isPublic,
    } = body;

    if (!name || !symbol || !chain || !creatorAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const collectionId = await createCollection({
      name,
      symbol,
      description: description || "",
      chain,
      contractAddress: contractAddress || undefined,
      creatorAddress,
      royaltyPercentage: royaltyPercentage || 0,
      imageUrl: imageUrl || null,
      isPublic: Boolean(isPublic),
    });

    return NextResponse.json({
      success: true,
      collectionId,
    });
  } catch (error: any) {
    console.error("Create collection error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to create collection",
      },
      { status: 500 }
    );
  }
}

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

  const alterStatements = [
    "ALTER TABLE nft_collections ADD COLUMN imageUrl TEXT",
    "ALTER TABLE nft_collections ADD COLUMN contractAddress VARCHAR(255)",
    "ALTER TABLE nft_collections ADD COLUMN royaltyPercentage DECIMAL(5,2) NOT NULL DEFAULT 0",
    "ALTER TABLE nft_collections ADD COLUMN isPublic BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE nft_collections ADD COLUMN isVerified BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE nft_collections ADD COLUMN totalSupply INT NOT NULL DEFAULT 0",
    "ALTER TABLE nft_collections ADD COLUMN floorPrice DECIMAL(20,8)",
    "ALTER TABLE nft_collections ADD COLUMN volumeTraded DECIMAL(30,8) NOT NULL DEFAULT 0",
    "ALTER TABLE nft_collections ADD COLUMN createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE nft_collections ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  ];
  for (const stmt of alterStatements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // ignore if column exists
    }
  }
}

/**
 * GET /api/nft-marketplace/collections
 * List all collections
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainRaw = searchParams.get("chain");
    const chain = chainRaw && chainRaw !== "all" ? chainRaw : null;
    const creator = searchParams.get("creator");

    const db = await getDb();
    await ensureCollectionsTable(db);
    const { nftCollections } = await import("@/lib/db/schema");
    const { eq, and } = await import("drizzle-orm");

    let query = db.select().from(nftCollections);

    if (chain) {
      query = query.where(eq(nftCollections.chain, chain as any)) as any;
    }

    if (creator) {
      const conditions = chain
        ? and(eq(nftCollections.chain, chain as any), eq(nftCollections.creatorAddress, creator))
        : eq(nftCollections.creatorAddress, creator);
      query = query.where(conditions as any) as any;
    }

    const collections = await query;

    return NextResponse.json({
      success: true,
      collections,
    });
  } catch (error: any) {
    console.error("List collections error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to list collections",
      },
      { status: 500 }
    );
  }
}
