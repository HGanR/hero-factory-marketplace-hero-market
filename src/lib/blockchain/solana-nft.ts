import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} from "@metaplex-foundation/js";

/**
 * Solana NFT Minting Service
 * Uses Metaplex for NFT creation on Solana
 */

export interface SolanaNFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string | Buffer; // URL or image buffer
  attributes?: Array<{ trait_type: string; value: string | number }>;
  externalUrl?: string;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    category?: string;
    creators?: Array<{ address: string; share: number }>;
  };
}

export interface MintSolanaNFTParams {
  privateKey: Uint8Array; // Wallet private key
  metadata: SolanaNFTMetadata;
  sellerFeeBasisPoints?: number; // Royalty (0-10000, where 100 = 1%)
  collection?: PublicKey; // Optional collection address
}

export class SolanaNFTService {
  private connection: Connection;
  private metaplex: Metaplex | null = null;
  private network: "mainnet-beta" | "testnet" | "devnet";

  constructor(network: "mainnet-beta" | "testnet" | "devnet" = "devnet") {
    this.network = network;
    const rpcUrl = this.getRPCUrl(network);
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  private getRPCUrl(network: string): string {
    const urls = {
      "mainnet-beta": process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com",
      testnet: "https://api.testnet.solana.com",
      devnet: "https://api.devnet.solana.com",
    };
    return urls[network as keyof typeof urls];
  }

  /**
   * Initialize Metaplex instance with wallet
   */
  private initializeMetaplex(keypair: Keypair): Metaplex {
    if (!this.metaplex) {
      this.metaplex = Metaplex.make(this.connection)
        .use(keypairIdentity(keypair))
        .use(
          bundlrStorage({
            address: this.network === "mainnet-beta" ? "https://node1.bundlr.network" : "https://devnet.bundlr.network",
            providerUrl: this.getRPCUrl(this.network),
            timeout: 60000,
          })
        );
    }
    return this.metaplex;
  }

  /**
   * Mint a new NFT on Solana using Metaplex
   */
  async mintNFT(params: MintSolanaNFTParams): Promise<{
    success: boolean;
    mintAddress?: string;
    metadataAddress?: string;
    txSignature?: string;
    ownerAddress?: string;
    error?: string;
  }> {
    try {
      // Create keypair from private key
      const keypair = Keypair.fromSecretKey(params.privateKey);

      // Initialize Metaplex
      const metaplex = this.initializeMetaplex(keypair);

      // Upload metadata to Arweave via Bundlr
      let imageUri: string;

      if (Buffer.isBuffer(params.metadata.image)) {
        // Upload image file
        const imageFile = toMetaplexFile(params.metadata.image, "image.png");
        const imageUploadResponse = await metaplex.storage().upload(imageFile);
        imageUri = imageUploadResponse;
      } else {
        // Use existing URL
        imageUri = params.metadata.image;
      }

      // Prepare metadata JSON
      // Convert attributes to ensure value is always a string (Metaplex requirement)
      const attributes = (params.metadata.attributes || []).map((attr) => ({
        trait_type: attr.trait_type,
        value: String(attr.value),
      }));

      const metadataJson = {
        name: params.metadata.name,
        symbol: params.metadata.symbol,
        description: params.metadata.description,
        image: imageUri,
        attributes,
        external_url: params.metadata.externalUrl || "",
        properties: params.metadata.properties || {
          files: [{ uri: imageUri, type: "image/png" }],
          category: "image",
        },
      };

      // Upload metadata JSON
      const { uri: metadataUri } = await metaplex.nfts().uploadMetadata(metadataJson);

      // Mint NFT
      const { nft, response } = await metaplex.nfts().create({
        uri: metadataUri,
        name: params.metadata.name,
        sellerFeeBasisPoints: params.sellerFeeBasisPoints || 500, // 5% default royalty
        symbol: params.metadata.symbol,
        collection: params.collection,
      });

      return {
        success: true,
        mintAddress: nft.address.toString(),
        metadataAddress: nft.metadataAddress.toString(),
        txSignature: response.signature,
        ownerAddress: keypair.publicKey.toString(),
      };
    } catch (error) {
      console.error("Solana NFT minting error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get NFTs owned by an address
   */
  async getNFTsByOwner(ownerAddress: string): Promise<any[]> {
    try {
      const ownerPublicKey = new PublicKey(ownerAddress);
      const metaplex = this.initializeMetaplex(Keypair.generate()); // Temporary keypair for read-only

      const nfts = await metaplex.nfts().findAllByOwner({ owner: ownerPublicKey });

      return nfts.map((nft) => ({
        mintAddress: nft.address.toString(),
        name: nft.name,
        symbol: nft.symbol,
        uri: nft.uri,
        sellerFeeBasisPoints: nft.sellerFeeBasisPoints,
      }));
    } catch (error) {
      console.error("Error fetching Solana NFTs:", error);
      return [];
    }
  }
}

// Export singleton instance
export const solanaNFTService = new SolanaNFTService(
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "mainnet-beta" | "testnet" | "devnet") || "devnet"
);
