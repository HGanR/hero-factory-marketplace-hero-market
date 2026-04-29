import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { nfts, nftCollections } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { xrplNFTService } from "@/lib/blockchain/xrpl-nft";
import { solanaNFTService } from "@/lib/blockchain/solana-nft";
import { ethereumNFTService, polygonNFTService, metallicusNFTService } from "@/lib/blockchain/evm-nft";
import { uploadJSONToIPFS } from "@/lib/marketplace/pinata";
import { createNFT, createActivity } from "@/lib/marketplace/nft-queries";

interface MintNFTRequest {
  chain: "xrpl" | "solana" | "ethereum" | "polygon" | "metallicus";
  walletPrivateKey?: string; // Or seed for XRPL
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  };
  collectionId?: string;
  royaltyPercentage?: number;
  contractAddress?: string; // Required for EVM chains
  ownerAddress: string;
}

async function uploadMetadataToIPFS(metadata: any): Promise<string> {
  try {
    const result = await uploadJSONToIPFS(metadata);
    return result.ipfsUrl;
  } catch (error) {
    console.error("IPFS upload failed, using placeholder:", error);
    // Fallback to placeholder if Pinata is not configured
    return `ipfs://placeholder/${Date.now()}`;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body: MintNFTRequest = await req.json();
    const { chain, walletPrivateKey, metadata, collectionId, royaltyPercentage, contractAddress, ownerAddress } = body;

    // Validation
    if (!chain || !metadata || !ownerAddress) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields: chain, metadata, ownerAddress" } },
        { status: 400 }
      );
    }

    if (!metadata.name || !metadata.description || !metadata.image) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Metadata must include name, description, and image" } },
        { status: 400 }
      );
    }

    let mintResult: {
      success: boolean;
      tokenId?: string;
      nftTokenId?: string;
      mintAddress?: string;
      txHash?: string;
      txSignature?: string;
      metadataUri?: string;
      ownerAddress?: string;
      error?: string;
    };

    // Route to appropriate blockchain service
    switch (chain) {
      case "xrpl":
        if (!walletPrivateKey) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "walletPrivateKey (seed) required for XRPL" } }, { status: 400 });
        }
        // Upload metadata to IPFS first
        const metadataUri = await uploadMetadataToIPFS(metadata);
        mintResult = await xrplNFTService.mintNFT({
          walletSeed: walletPrivateKey,
          uri: metadataUri,
          transferFee: (royaltyPercentage || 0) * 1000, // Convert to basis points
        });
        break;

      case "solana":
        if (!walletPrivateKey) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "walletPrivateKey required for Solana" } }, { status: 400 });
        }
        mintResult = await solanaNFTService.mintNFT({
          privateKey: Buffer.from(walletPrivateKey, "hex"),
          metadata: {
            ...metadata,
            symbol: metadata.name.substring(0, 10).toUpperCase(),
          },
          sellerFeeBasisPoints: (royaltyPercentage || 0) * 100,
        });
        break;

      case "ethereum":
        if (!contractAddress) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Contract address required for Ethereum" } }, { status: 400 });
        }
        if (!walletPrivateKey) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "walletPrivateKey required for Ethereum" } }, { status: 400 });
        }
        mintResult = await ethereumNFTService.mintNFT({
          privateKey: walletPrivateKey,
          metadata,
          contractAddress,
          recipientAddress: ownerAddress,
          royaltyPercentage,
        });
        break;

      case "polygon":
        if (!contractAddress) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Contract address required for Polygon" } }, { status: 400 });
        }
        if (!walletPrivateKey) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "walletPrivateKey required for Polygon" } }, { status: 400 });
        }
        mintResult = await polygonNFTService.mintNFT({
          privateKey: walletPrivateKey,
          metadata,
          contractAddress,
          recipientAddress: ownerAddress,
          royaltyPercentage,
        });
        break;

      case "metallicus":
        if (!contractAddress) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Contract address required for Metallicus" } }, { status: 400 });
        }
        if (!walletPrivateKey) {
          return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "walletPrivateKey required for Metallicus" } }, { status: 400 });
        }
        mintResult = await metallicusNFTService.mintNFT({
          privateKey: walletPrivateKey,
          metadata,
          contractAddress,
          recipientAddress: ownerAddress,
          royaltyPercentage,
        });
        break;

      default:
        return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Unsupported blockchain" } }, { status: 400 });
    }

    if (!mintResult.success) {
      return NextResponse.json(
        { ok: false, error: { code: "MINT_FAILED", message: mintResult.error || "Minting failed" } },
        { status: 500 }
      );
    }

    // Save NFT to database
    const tokenId = mintResult.tokenId || mintResult.nftTokenId || mintResult.mintAddress || "";
    // Use metadataUri from mint result if available, otherwise upload to IPFS
    const metadataUri = mintResult.metadataUri || (await uploadMetadataToIPFS({
      name: metadata.name,
      description: metadata.description,
      image: metadata.image,
      attributes: metadata.attributes || [],
    }));

    const normalizedAttributes = Array.isArray(metadata.attributes) ? [...metadata.attributes] : [];
    const hasVisibility = normalizedAttributes.some(
      (a) => String(a?.trait_type || "").toLowerCase() === "visibility"
    );
    if (!hasVisibility) {
      normalizedAttributes.push({ trait_type: "visibility", value: "public" });
    }

    let resolvedCollectionId = collectionId;
    if (!resolvedCollectionId && contractAddress) {
      const db = await getDb();
      const rows = await db
        .select()
        .from(nftCollections)
        .where(and(eq(nftCollections.contractAddress, contractAddress), eq(nftCollections.chain, chain as any)))
        .limit(1);
      resolvedCollectionId = rows[0]?.id || undefined;
    }

    const nftId = await createNFT({
      tokenId,
      name: metadata.name,
      description: metadata.description,
      imageUrl: metadata.image,
      chain: chain as any,
      contractAddress: contractAddress || undefined,
      ownerAddress: ownerAddress,
      creatorAddress: ownerAddress,
      mintTxHash: mintResult.txHash || mintResult.txSignature || undefined,
      royaltyPercentage: royaltyPercentage || 0,
      attributes: normalizedAttributes,
      collectionId: resolvedCollectionId,
    });

    // Update metadataUrl if we have it
    if (metadataUri) {
      const db = await getDb();
      await db.update(nfts).set({ metadataUrl: metadataUri }).where(eq(nfts.id, nftId));
    }

    // Record activity
    await createActivity({
      nftId,
      activityType: "mint",
      toAddress: ownerAddress,
      txHash: mintResult.txHash || mintResult.txSignature || undefined,
    });
    return NextResponse.json({
      ok: true,
      nftId,
      tokenId: mintResult.tokenId || mintResult.nftTokenId || mintResult.mintAddress,
      mintAddress: mintResult.mintAddress,
      txHash: mintResult.txHash || mintResult.txSignature,
      chain,
      message: "NFT minted successfully",
    });
  } catch (error: any) {
    console.error("Mint NFT error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to mint NFT" } },
      { status: 500 }
    );
  }
}
