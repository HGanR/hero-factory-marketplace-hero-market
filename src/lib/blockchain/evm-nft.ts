import { ethers } from "ethers";
import axios from "axios";

/**
 * EVM NFT Minting Service
 * Supports Ethereum, Polygon, and Metallicus (EVM-compatible chains)
 */

export interface EVMNFTMetadata {
  name: string;
  description: string;
  image: string; // IPFS URL
  attributes?: Array<{ trait_type: string; value: string | number }>;
  external_url?: string;
}

export interface MintEVMNFTParams {
  privateKey: string;
  metadata: EVMNFTMetadata;
  contractAddress: string;
  recipientAddress?: string;
  royaltyPercentage?: number; // 0-100
}

export type EVMChain = "ethereum" | "polygon" | "metallicus";

export class EVMNFTService {
  private provider: ethers.JsonRpcProvider;
  private chain: EVMChain;

  // ERC-721 Standard ABI (simplified)
  private readonly ERC721_ABI = [
    "function mint(address to, string memory tokenURI) public returns (uint256)",
    "function safeMint(address to, string memory uri) public",
    "function tokenURI(uint256 tokenId) public view returns (string memory)",
    "function ownerOf(uint256 tokenId) public view returns (address)",
    "function balanceOf(address owner) public view returns (uint256)",
    "function transferFrom(address from, address to, uint256 tokenId) public",
    "function approve(address to, uint256 tokenId) public",
    "function setApprovalForAll(address operator, bool approved) public",
    "function getApproved(uint256 tokenId) public view returns (address)",
    "function isApprovedForAll(address owner, address operator) public view returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ];

  constructor(chain: EVMChain = "polygon") {
    this.chain = chain;
    const rpcUrl = this.getRPCUrl(chain);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  private getRPCUrl(chain: EVMChain): string {
    const urls = {
      ethereum: process.env.NEXT_PUBLIC_ETHEREUM_RPC || "https://eth.llamarpc.com",
      polygon: process.env.NEXT_PUBLIC_POLYGON_RPC || "https://polygon-rpc.com",
      metallicus: process.env.NEXT_PUBLIC_METALLICUS_RPC || "https://rpc.metalblockchain.org",
    };
    return urls[chain];
  }

  /**
   * Upload metadata to IPFS (using Pinata or similar service)
   */
  async uploadMetadataToIPFS(metadata: EVMNFTMetadata): Promise<{
    success: boolean;
    ipfsUrl?: string;
    error?: string;
  }> {
    try {
      // Using Pinata API (requires PINATA_API_KEY and PINATA_SECRET_KEY)
      const pinataApiKey = process.env.PINATA_API_KEY;
      const pinataSecretKey = process.env.PINATA_SECRET_KEY;

      if (!pinataApiKey || !pinataSecretKey) {
        throw new Error("Pinata API credentials not configured");
      }

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          pinataContent: metadata,
          pinataMetadata: {
            name: `${metadata.name}-metadata.json`,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            pinata_api_key: pinataApiKey,
            pinata_secret_api_key: pinataSecretKey,
          },
        }
      );

      const ipfsHash = response.data.IpfsHash;
      const ipfsUrl = `ipfs://${ipfsHash}`;

      return {
        success: true,
        ipfsUrl,
      };
    } catch (error) {
      console.error("IPFS upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Mint NFT on EVM-compatible chain
   */
  async mintNFT(params: MintEVMNFTParams): Promise<{
    success: boolean;
    tokenId?: string;
    txHash?: string;
    contractAddress?: string;
    metadataUri?: string;
    ownerAddress?: string;
    error?: string;
  }> {
    try {
      // Create wallet from private key
      const wallet = new ethers.Wallet(params.privateKey, this.provider);

      // Upload metadata to IPFS
      const uploadResult = await this.uploadMetadataToIPFS(params.metadata);

      if (!uploadResult.success || !uploadResult.ipfsUrl) {
        throw new Error("Failed to upload metadata to IPFS");
      }

      // Create contract instance
      const contract = new ethers.Contract(params.contractAddress, this.ERC721_ABI, wallet);

      // Determine recipient address
      const recipient = params.recipientAddress || wallet.address;

      // Call mint function (assumes contract has a mint or safeMint function)
      let tx;
      try {
        // Try safeMint first
        tx = await contract.safeMint(recipient, uploadResult.ipfsUrl);
      } catch (e) {
        // Fallback to mint
        tx = await contract.mint(recipient, uploadResult.ipfsUrl);
      }

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Extract token ID from events
      const tokenId = this.extractTokenIdFromReceipt(receipt);

      return {
        success: true,
        tokenId: tokenId?.toString(),
        txHash: receipt.hash,
        contractAddress: params.contractAddress,
        metadataUri: uploadResult.ipfsUrl,
        ownerAddress: recipient,
      };
    } catch (error) {
      console.error("EVM NFT minting error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract token ID from transaction receipt
   */
  private extractTokenIdFromReceipt(receipt: ethers.ContractTransactionReceipt): bigint | null {
    // Look for Transfer event in logs
    const iface = new ethers.Interface(this.ERC721_ABI);
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "Transfer") {
          // Token ID is the third argument in Transfer event
          return parsed.args[2];
        }
      } catch (e) {
        // Not a Transfer event, continue
      }
    }

    return null;
  }

  /**
   * Transfer NFT to another address
   */
  async transferNFT(params: {
    privateKey: string;
    contractAddress: string;
    tokenId: string;
    toAddress: string;
  }): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const wallet = new ethers.Wallet(params.privateKey, this.provider);
      const contract = new ethers.Contract(params.contractAddress, this.ERC721_ABI, wallet);

      // Transfer NFT
      const tx = await contract.transferFrom(wallet.address, params.toAddress, params.tokenId);

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error) {
      console.error("EVM NFT transfer error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get NFT metadata URI
   */
  async getTokenURI(contractAddress: string, tokenId: string): Promise<string | null> {
    try {
      const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);

      const tokenURI = await contract.tokenURI(tokenId);
      return tokenURI;
    } catch (error) {
      console.error("Error fetching token URI:", error);
      return null;
    }
  }

  /**
   * Get NFT owner
   */
  async getOwner(contractAddress: string, tokenId: string): Promise<string | null> {
    try {
      const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);

      const owner = await contract.ownerOf(tokenId);
      return owner;
    } catch (error) {
      console.error("Error fetching owner:", error);
      return null;
    }
  }

  /**
   * Get NFT balance of an address
   */
  async getBalance(contractAddress: string, ownerAddress: string): Promise<number> {
    try {
      const contract = new ethers.Contract(contractAddress, this.ERC721_ABI, this.provider);

      const balance = await contract.balanceOf(ownerAddress);
      return Number(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      return 0;
    }
  }

  /**
   * Approve NFT transfer
   */
  async approveNFT(params: {
    privateKey: string;
    contractAddress: string;
    tokenId: string;
    approvedAddress: string;
  }): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const wallet = new ethers.Wallet(params.privateKey, this.provider);
      const contract = new ethers.Contract(params.contractAddress, this.ERC721_ABI, wallet);

      const tx = await contract.approve(params.approvedAddress, params.tokenId);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
      };
    } catch (error) {
      console.error("EVM NFT approval error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export instances for each chain
export const ethereumNFTService = new EVMNFTService("ethereum");
export const polygonNFTService = new EVMNFTService("polygon");
export const metallicusNFTService = new EVMNFTService("metallicus");
