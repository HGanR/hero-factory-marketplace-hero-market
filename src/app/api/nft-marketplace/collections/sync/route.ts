import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createPublicClient, decodeEventLog, fallback, http } from "viem";
import { polygon } from "viem/chains";
import { getDb } from "@/lib/db";
import { nftCollections } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_POLYGON_NFT_FACTORY || "").trim();
const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/polygon",
  "https://rpc.ankr.com/polygon",
  "https://polygon-rpc.com",
].filter(Boolean);

const FACTORY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "collection", type: "address" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "string", name: "name", type: "string" },
      { indexed: false, internalType: "string", name: "symbol", type: "string" },
      { indexed: false, internalType: "uint256", name: "mintPrice", type: "uint256" },
      { indexed: false, internalType: "uint96", name: "defaultRoyaltyBps", type: "uint96" },
    ],
    name: "CollectionDeployed",
    type: "event",
  },
] as const;

const LOG_CHUNK_SIZE = 500n;

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

async function getLogsChunked<T extends Parameters<ReturnType<typeof createPublicClient>["getLogs"]>[0]>(
  client: ReturnType<typeof createPublicClient>,
  params: T
) {
  const latestBlock = await client.getBlockNumber();
  const start = (params as any).fromBlock ?? 0n;
  const end = (params as any).toBlock ?? latestBlock;
  const toBlock = end === "latest" ? latestBlock : (end as bigint);
  const fromBlock = typeof start === "bigint" ? start : 0n;
  if (fromBlock > toBlock) return [];

  const logs: Awaited<ReturnType<typeof client.getLogs>> = [];
  const fetchRange = async (rangeStart: bigint, rangeEnd: bigint) => {
    try {
      const chunk = await client.getLogs({
        ...(params as any),
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      });
      logs.push(...chunk);
    } catch (error: any) {
      const msg = String(error?.shortMessage || error?.message || "");
      if (msg.toLowerCase().includes("range") && msg.toLowerCase().includes("too large") && rangeStart < rangeEnd) {
        const mid = rangeStart + (rangeEnd - rangeStart) / 2n;
        await fetchRange(rangeStart, mid);
        await fetchRange(mid + 1n, rangeEnd);
        return;
      }
      throw error;
    }
  };

  for (let cursor = fromBlock; cursor <= toBlock; cursor += LOG_CHUNK_SIZE) {
    const chunkEnd = cursor + LOG_CHUNK_SIZE - 1n > toBlock ? toBlock : cursor + LOG_CHUNK_SIZE - 1n;
    await fetchRange(cursor, chunkEnd);
  }
  return logs;
}

export async function POST(req: NextRequest) {
  try {
    if (!FACTORY_ADDRESS) {
      return NextResponse.json({ ok: false, error: "Factory address not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const creatorAddress = String(body?.creatorAddress || "").toLowerCase();
    const fromBlockRaw = body?.fromBlock;
    const fromBlock = typeof fromBlockRaw === "number" ? BigInt(fromBlockRaw) : 0n;

    if (!creatorAddress) {
      return NextResponse.json({ ok: false, error: "creatorAddress is required" }, { status: 400 });
    }

    const client = createPublicClient({
      chain: polygon,
      transport: fallback(POLYGON_RPC_CANDIDATES.map((url) => http(url))),
    });

    const logs = await getLogsChunked(client, {
      address: FACTORY_ADDRESS as `0x${string}`,
      event: FACTORY_ABI[0],
      fromBlock,
      toBlock: "latest",
      args: { creator: creatorAddress as `0x${string}` },
    });

    if (!logs.length) {
      return NextResponse.json({ ok: true, inserted: 0, total: 0 });
    }

    const decoded = logs.map((log) => {
      const parsed = decodeEventLog({
        abi: FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      }) as any;
      return {
        collection: String(parsed?.args?.collection || "").toLowerCase(),
        creator: String(parsed?.args?.creator || "").toLowerCase(),
        name: String(parsed?.args?.name || ""),
        symbol: String(parsed?.args?.symbol || ""),
        royaltyBps: Number(parsed?.args?.defaultRoyaltyBps ?? 0),
      };
    });

    const contractAddresses = decoded.map((d) => d.collection).filter(Boolean);
    const db = await getDb();
    await ensureCollectionsTable(db);

    const existing = contractAddresses.length
      ? await db
          .select({ contractAddress: nftCollections.contractAddress })
          .from(nftCollections)
          .where(inArray(nftCollections.contractAddress, contractAddresses))
      : [];
    const existingSet = new Set(existing.map((r) => String(r.contractAddress || "").toLowerCase()));

    const toInsert = decoded
      .filter((d) => d.collection && !existingSet.has(d.collection))
      .map((d) => ({
        id: crypto.randomUUID(),
        name: d.name || "Untitled Collection",
        symbol: d.symbol || "COLL",
        description: "",
        imageUrl: null,
        chain: "polygon" as const,
        contractAddress: d.collection,
        creatorAddress: d.creator,
        royaltyPercentage: (d.royaltyBps / 100).toFixed(2),
        isPublic: false,
        isVerified: false,
        totalSupply: 0,
        volumeTraded: "0",
      }));

    if (toInsert.length) {
      await db.insert(nftCollections).values(toInsert as any);
    }

    return NextResponse.json({
      ok: true,
      inserted: toInsert.length,
      total: decoded.length,
    });
  } catch (error: any) {
    console.error("Collection sync error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync collections" },
      { status: 500 }
    );
  }
}
