import { getConnection, getDb } from "@/lib/db";
import { nfts, nftListings, nftSales, nftActivity, nftCollections } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * NFT Database Queries
 * Provides database operations for the NFT marketplace using Drizzle ORM
 */

// ============= NFT Operations =============

export async function createNFT(params: {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: "xrpl" | "solana" | "ethereum" | "polygon" | "metallicus";
  contractAddress?: string;
  ownerAddress: string;
  creatorAddress: string;
  mintTxHash?: string;
  royaltyPercentage: number;
  attributes?: any[];
  collectionId?: string;
}): Promise<string> {
  const db = await getDb();
  const nftId = uuidv4();

  await db.insert(nfts).values({
    id: nftId,
    tokenId: params.tokenId,
    name: params.name,
    description: params.description,
    imageUrl: params.imageUrl,
    chain: params.chain,
    contractAddress: params.contractAddress || null,
    ownerAddress: params.ownerAddress,
    creatorAddress: params.creatorAddress,
    metadataUrl: null,
    attributes: params.attributes ? JSON.stringify(params.attributes) : null,
    collectionId: params.collectionId || null,
    isListed: false,
    royaltyPercentage: params.royaltyPercentage.toString(),
    isStaked: false,
  });

  return nftId;
}

export async function getNFTById(nftId: string) {
  const db = await getDb();
  const rows = await db.select().from(nfts).where(eq(nfts.id, nftId)).limit(1);
  return rows[0] || null;
}

export async function getNFTsByOwner(ownerAddress: string, limit = 50, offset = 0) {
  const db = await getDb();
  return await db
    .select()
    .from(nfts)
    .where(eq(nfts.ownerAddress, ownerAddress))
    .orderBy(desc(nfts.mintedAt))
    .limit(limit)
    .offset(offset);
}

export async function updateNFTOwner(nftId: string, newOwner: string): Promise<void> {
  const db = await getDb();
  await db.update(nfts).set({ ownerAddress: newOwner }).where(eq(nfts.id, nftId));
}

export async function setNFTListingStatus(nftId: string, isListed: boolean, price?: number, currency?: string): Promise<void> {
  const db = await getDb();
  const updateData: any = { isListed };
  if (price !== undefined) {
    updateData.listPrice = price.toString();
  }
  if (currency !== undefined) {
    updateData.listCurrency = currency;
  }
  await db.update(nfts).set(updateData).where(eq(nfts.id, nftId));
}

// ============= Listing Operations =============

export async function createListing(params: {
  nftId: string;
  sellerAddress: string;
  price: number;
  currency: string;
  listingType: "fixed" | "auction";
  startTime?: Date;
  endTime?: Date;
}): Promise<string> {
  const db = await getDb();
  const listingId = uuidv4();

  await db.insert(nftListings).values({
    id: listingId,
    nftId: params.nftId,
    sellerAddress: params.sellerAddress,
    price: params.price.toString(),
    currency: params.currency,
    listingType: params.listingType,
    status: "active",
    auctionEndTime: params.endTime || null,
  });

  // Update NFT listing status
  await setNFTListingStatus(params.nftId, true, params.price, params.currency);

  return listingId;
}

export async function getListingById(listingId: string) {
  const db = await getDb();
  const rows = await db.select().from(nftListings).where(eq(nftListings.id, listingId)).limit(1);
  return rows[0] || null;
}

export async function getListingByNFTId(nftId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(nftListings)
    .where(and(eq(nftListings.nftId, nftId), eq(nftListings.status, "active")))
    .limit(1);
  return rows[0] || null;
}

export async function getActiveListings(chain?: string, limit = 50, offset = 0) {
  const db = await getDb();
  
  if (chain) {
    return await db
      .select({
        listing: nftListings,
        nft: nfts,
      })
      .from(nftListings)
      .innerJoin(nfts, eq(nftListings.nftId, nfts.id))
      .where(and(eq(nftListings.status, "active"), eq(nfts.chain, chain as any)))
      .orderBy(desc(nftListings.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    return await db
      .select({
        listing: nftListings,
        nft: nfts,
      })
      .from(nftListings)
      .innerJoin(nfts, eq(nftListings.nftId, nfts.id))
      .where(eq(nftListings.status, "active"))
      .orderBy(desc(nftListings.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

export async function cancelListing(listingId: string): Promise<void> {
  const db = await getDb();
  const listing = await getListingById(listingId);
  if (listing) {
    await db.update(nftListings).set({ status: "cancelled" }).where(eq(nftListings.id, listingId));
    await setNFTListingStatus(listing.nftId, false);
  }
}

// ============= Sale Operations =============

export async function createSale(params: {
  listingId: string;
  nftId: string;
  sellerAddress: string;
  buyerAddress: string;
  price: number;
  currency: string;
  royaltyAmount: number;
  platformFee: number;
  txHash: string;
}): Promise<string> {
  const db = await getDb();
  const saleId = uuidv4();

  await db.insert(nftSales).values({
    id: saleId,
    listingId: params.listingId,
    nftId: params.nftId,
    sellerAddress: params.sellerAddress,
    buyerAddress: params.buyerAddress,
    price: params.price.toString(),
    currency: params.currency,
    royaltyAmount: params.royaltyAmount.toString(),
    platformFee: params.platformFee.toString(),
    txHash: params.txHash,
  });

  // Update listing status
  await db.update(nftListings).set({ status: "sold", soldAt: new Date() }).where(eq(nftListings.id, params.listingId));

  // Update NFT owner and listing status
  await updateNFTOwner(params.nftId, params.buyerAddress);
  await setNFTListingStatus(params.nftId, false);

  // Record activity
  await createActivity({
    nftId: params.nftId,
    activityType: "sale",
    fromAddress: params.sellerAddress,
    toAddress: params.buyerAddress,
    price: params.price,
    currency: params.currency,
    txHash: params.txHash,
  });

  return saleId;
}

export async function getSalesByNFT(nftId: string) {
  const db = await getDb();
  return await db.select().from(nftSales).where(eq(nftSales.nftId, nftId)).orderBy(desc(nftSales.soldAt));
}

// ============= Activity Operations =============

export async function createActivity(params: {
  nftId: string;
  activityType: "mint" | "list" | "sale" | "transfer" | "cancel";
  fromAddress?: string;
  toAddress?: string;
  price?: number;
  currency?: string;
  txHash?: string;
}): Promise<string> {
  const db = await getDb();
  const activityId = uuidv4();

  await db.insert(nftActivity).values({
    id: activityId,
    nftId: params.nftId,
    activityType: params.activityType,
    fromAddress: params.fromAddress || null,
    toAddress: params.toAddress || null,
    price: params.price ? params.price.toString() : null,
    currency: params.currency || null,
    txHash: params.txHash || null,
  });

  return activityId;
}

export async function getActivityByNFT(nftId: string, limit = 20) {
  const db = await getDb();
  return await db.select().from(nftActivity).where(eq(nftActivity.nftId, nftId)).orderBy(desc(nftActivity.createdAt)).limit(limit);
}

// ============= Collection Operations =============

export async function createCollection(params: {
  name: string;
  symbol: string;
  description: string;
  chain: "xrpl" | "solana" | "ethereum" | "polygon" | "metallicus";
  contractAddress?: string;
  creatorAddress: string;
  royaltyPercentage: number;
  imageUrl?: string;
  isPublic?: boolean;
}): Promise<string> {
  const normalizedContract = params.contractAddress ? params.contractAddress.toLowerCase() : null;
  const collectionId = uuidv4();

  if (normalizedContract) {
    const db = await getDb();
    const existing = (
      await db
        .select()
        .from(nftCollections)
        .where(sql`lower(${nftCollections.contractAddress}) = ${normalizedContract}`)
        .limit(1)
    )[0];
    if (existing) {
      const updateData: Record<string, any> = {
        name: params.name,
        symbol: params.symbol,
        description: params.description || existing.description || "",
        imageUrl: params.imageUrl ?? existing.imageUrl ?? null,
        chain: params.chain,
        contractAddress: normalizedContract,
        creatorAddress: params.creatorAddress,
        royaltyPercentage: params.royaltyPercentage.toString(),
        isPublic: params.isPublic ?? existing.isPublic ?? false,
      };
      await db.update(nftCollections).set(updateData).where(eq(nftCollections.id, existing.id));
      return existing.id;
    }
  }

  const connection = await getConnection();
  let availableColumns = new Set<string>();
  try {
    const [rows] = await connection.query(
      "SELECT COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nft_collections'"
    );
    if (Array.isArray(rows)) {
      for (const row of rows as Array<{ columnName?: string; COLUMN_NAME?: string }>) {
        const col = row.columnName || row.COLUMN_NAME;
        if (col) availableColumns.add(col);
      }
    }
  } catch {
    // If we cannot inspect schema, proceed with the minimal column set.
    availableColumns = new Set();
  }

  const data: Record<string, any> = {
    id: collectionId,
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageUrl: params.imageUrl || null,
    chain: params.chain,
    contractAddress: normalizedContract,
    creatorAddress: params.creatorAddress,
    royaltyPercentage: params.royaltyPercentage.toString(),
  };

  const optionalDefaults: Record<string, any> = {
    isPublic: Boolean(params.isPublic),
    isVerified: false,
    totalSupply: 0,
    floorPrice: null,
    volumeTraded: "0",
  };

  for (const [key, value] of Object.entries(optionalDefaults)) {
    if (availableColumns.has(key)) {
      data[key] = value;
    }
  }

  const columns = Object.keys(data);
  const placeholders = columns.map(() => "?").join(", ");
  const columnSql = columns.map((col) => `\`${col}\``).join(", ");

  try {
    await connection.execute(
      `INSERT INTO nft_collections (${columnSql}) VALUES (${placeholders})`,
      columns.map((col) => data[col])
    );
  } catch (error) {
    const message = String((error as any)?.message || "");
    if (message.includes("doesn't exist") || message.includes("ER_NO_SUCH_TABLE")) {
      console.warn("nft_collections table missing; skipping DB insert.");
      return collectionId;
    }
    console.error("Create collection insert failed:", error);
    throw error;
  }

  return collectionId;
}

export async function getCollectionById(collectionId: string) {
  const db = await getDb();
  const rows = await db.select().from(nftCollections).where(eq(nftCollections.id, collectionId)).limit(1);
  return rows[0] || null;
}

export async function getCollectionsByChain(chain: string) {
  const db = await getDb();
  return await db.select().from(nftCollections).where(eq(nftCollections.chain, chain as any)).orderBy(desc(nftCollections.createdAt));
}

// ============= Staking Operations =============

export async function checkIfNFTIsStaked(nftId: string): Promise<boolean> {
  const db = await getDb();
  const nft = await getNFTById(nftId);
  return nft ? nft.isStaked : false;
}
