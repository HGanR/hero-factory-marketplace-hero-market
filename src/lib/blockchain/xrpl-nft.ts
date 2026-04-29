import { Client, Wallet, convertStringToHex, NFTokenMint } from "xrpl";

/**
 * XRPL NFT Minting Service
 * Handles NFT creation on the XRP Ledger
 */

export interface XRPLNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export interface MintNFTParams {
  walletSeed: string;
  uri: string; // IPFS or Arweave URL
  transferFee?: number; // 0-50000 (0% to 50%)
  taxon?: number; // Collection identifier
  flags?: number;
}

export class XRPLNFTService {
  private client: Client;
  private network: "mainnet" | "testnet" | "devnet";

  constructor(network: "mainnet" | "testnet" | "devnet" = "testnet") {
    this.network = network;
    const rpcUrl = this.getRPCUrl(network);
    this.client = new Client(rpcUrl);
  }

  private getRPCUrl(network: string): string {
    const urls = {
      mainnet: "wss://xrplcluster.com",
      testnet: "wss://s.altnet.rippletest.net:51233",
      devnet: "wss://s.devnet.rippletest.net:51233",
    };
    return urls[network as keyof typeof urls];
  }

  /**
   * Connect to XRPL network
   */
  async connect(): Promise<void> {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from XRPL network
   */
  async disconnect(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
  }

  /**
   * Mint a new NFT on XRPL
   */
  async mintNFT(params: MintNFTParams): Promise<{
    success: boolean;
    nftTokenId?: string;
    txHash?: string;
    ownerAddress?: string;
    error?: string;
  }> {
    try {
      await this.connect();

      // Create wallet from seed
      const wallet = Wallet.fromSeed(params.walletSeed);

      // Convert URI to hex
      const uriHex = convertStringToHex(params.uri);

      // Prepare NFTokenMint transaction
      const mintTx: NFTokenMint = {
        TransactionType: "NFTokenMint",
        Account: wallet.address,
        URI: uriHex,
        Flags: params.flags || 8, // tfTransferable
        TransferFee: params.transferFee || 0,
        NFTokenTaxon: params.taxon || 0,
      };

      // Submit and wait for validation
      const response = await this.client.submitAndWait(mintTx, { wallet });

      // Check if transaction was successful
      if (response.result.meta && typeof response.result.meta === "object") {
        const meta = response.result.meta as any;

        if (meta.TransactionResult === "tesSUCCESS") {
          // Extract NFTokenID from metadata
          const nftTokenId = this.extractNFTokenID(meta);

          return {
            success: true,
            nftTokenId,
            txHash: response.result.hash,
            ownerAddress: wallet.address,
          };
        }
      }

      return {
        success: false,
        error: "Transaction failed",
      };
    } catch (error) {
      console.error("XRPL NFT minting error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Extract NFTokenID from transaction metadata
   */
  private extractNFTokenID(meta: any): string | undefined {
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFTokenPage") {
          const nfts = node.CreatedNode.NewFields?.NFTokens || [];
          if (nfts.length > 0) {
            return nfts[0].NFToken?.NFTokenID;
          }
        }
        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "NFTokenPage") {
          const nfts = node.ModifiedNode.FinalFields?.NFTokens || [];
          if (nfts.length > 0) {
            return nfts[nfts.length - 1].NFToken?.NFTokenID;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Get NFTs owned by an address
   */
  async getNFTsByOwner(address: string): Promise<any[]> {
    try {
      await this.connect();

      const response = await this.client.request({
        command: "account_nfts",
        account: address,
      });

      return response.result.account_nfts || [];
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      return [];
    } finally {
      await this.disconnect();
    }
  }
}

// Export singleton instance
export const xrplNFTService = new XRPLNFTService(
  (process.env.NEXT_PUBLIC_XRPL_NETWORK as "mainnet" | "testnet" | "devnet") || "testnet"
);
