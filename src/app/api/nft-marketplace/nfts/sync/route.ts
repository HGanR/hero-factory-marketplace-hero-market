import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createPublicClient, decodeEventLog, fallback, http } from "viem";
import { polygon } from "viem/chains";
import { getDb } from "@/lib/db";
import { nftCollections, nfts } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/polygon",
  "https://rpc.ankr.com/polygon",
  "https://polygon-rpc.com",
].filter(Boolean);

const TRANSFER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: true, internalType: "uint256", name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
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
}

async function normalizeTokenUri(uri: string) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  }
  return uri;
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
    const body = await req.json().catch(() => ({}));
    const creatorAddress = String(body?.creatorAddress || "").toLowerCase();
    const ownerAddress = String(body?.ownerAddress || "").toLowerCase();
    const fromBlock = typeof body?.fromBlock === "number" ? BigInt(body.fromBlock) : 0n;

    const db = await getDb();
    await ensureCollectionsTable(db);

    let collections;
    if (creatorAddress) {
      collections = await db
        .select()
        .from(nftCollections)
        .where(and(eq(nftCollections.chain, "polygon"), eq(nftCollections.creatorAddress, creatorAddress)));
    } else {
      collections = await db.select().from(nftCollections).where(eq(nftCollections.chain, "polygon"));
    }
    const targets = collections
      .map((c) => String(c.contractAddress || "").toLowerCase())
      .filter((addr) => addr.startsWith("0x"));

    if (!targets.length) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, collections: 0 });
    }

    const client = createPublicClient({
      chain: polygon,
      transport: fallback(POLYGON_RPC_CANDIDATES.map((url) => http(url))),
    });
    let inserted = 0;
    let updated = 0;

    for (const contractAddress of targets) {
      const logs = await getLogsChunked(client, {
        address: contractAddress as `0x${string}`,
        event: TRANSFER_ABI[0],
        fromBlock,
        toBlock: "latest",
      });

      for (const log of logs) {
        const parsed = decodeEventLog({
          abi: TRANSFER_ABI,
          data: log.data,
          topics: log.topics,
        }) as any;
        const tokenId = String(parsed?.args?.tokenId ?? "");
        const to = String(parsed?.args?.to ?? "").toLowerCase();
        if (!tokenId || !to) continue;

        const existing = (
          await db
            .select()
            .from(nfts)
            .where(and(eq(nfts.chain, "polygon"), eq(nfts.contractAddress, contractAddress), eq(nfts.tokenId, tokenId)))
            .limit(1)
        )[0];

        if (existing) {
          if (existing.ownerAddress !== to) {
            await db
              .update(nfts)
              .set({ ownerAddress: to })
              .where(and(eq(nfts.id, existing.id)));
            updated += 1;
          }
          continue;
        }

        if (ownerAddress && ownerAddress !== to) {
          continue;
        }

        let tokenUri = "";
        try {
          tokenUri = (await client.readContract({
            address: contractAddress as `0x${string}`,
            abi: TRANSFER_ABI,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
          })) as string;
        } catch {
          tokenUri = "";
        }

        let imageUrl = "https://via.placeholder.com/400/374151/FFFFFF?text=NFT";
        let name = `Token #${tokenId}`;
        let description = "";
        let metadataUrl = tokenUri;
        if (tokenUri) {
          const resolved = await normalizeTokenUri(tokenUri);
          try {
            const metaRes = await fetch(resolved);
            const metaJson = await metaRes.json();
            name = metaJson?.name || name;
            description = metaJson?.description || "";
            const img = metaJson?.image || metaJson?.image_url;
            if (img) imageUrl = await normalizeTokenUri(String(img));
            metadataUrl = resolved;
          } catch {
            // ignore
          }
        }

        const collection = collections.find(
          (c) => String(c.contractAddress || "").toLowerCase() === contractAddress
        );

        await db.insert(nfts).values({
          id: crypto.randomUUID(),
          tokenId,
          chain: "polygon",
          contractAddress,
          ownerAddress: to,
          creatorAddress: creatorAddress || collection?.creatorAddress || to,
          name,
          description,
          imageUrl,
          metadataUrl: metadataUrl || null,
          attributes: null,
          collectionId: collection?.id ?? null,
          isListed: false,
          royaltyPercentage: "0",
          isStaked: false,
        });
        inserted += 1;
      }
    }

    return NextResponse.json({ ok: true, inserted, updated, collections: targets.length });
  } catch (error: any) {
    console.error("NFT sync error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to sync NFTs" },
      { status: 500 }
    );
  }
}
