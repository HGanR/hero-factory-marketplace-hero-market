// src/lib/contracts/contract-integration.ts
import { ethers } from 'ethers';

/**
 * Contract Integration Utility
 * Provides a unified interface for interacting with smart contracts across all networks
 */

export type SupportedChain = 'ethereum' | 'polygon' | 'metallicus' | 'solana' | 'xrpl';

export interface ContractConfig {
  chain: SupportedChain;
  nftContract?: string;
  marketplaceContract?: string;
  programId?: string;
  rpcUrl: string;
}

// Full ABI for TrooNFT contract (updated from contracts/TrooNFT.sol)
const TrooNFTABI = [
  // Functions
  'function mintNFT(address to, string memory uri, uint96 royaltyPercentage) external payable returns (uint256)',
  'function mintingFee() external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string memory)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function approve(address to, uint256 tokenId) external',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
  'function totalSupply() external view returns (uint256)',
  'function getCreator(uint256 tokenId) external view returns (address)',
  'function platformWallet() external view returns (address)',
  'function setMintingFee(uint256 newFee) external',
  'function setPlatformWallet(address newWallet) external',
  // Events
  'event NFTMinted(uint256 indexed tokenId, address indexed creator, address indexed owner, string tokenURI, uint96 royaltyPercentage)',
  'event MintingFeeUpdated(uint256 oldFee, uint256 newFee)',
  'event PlatformWalletUpdated(address oldWallet, address newWallet)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];

// Full ABI for TrooMarketplace contract (updated from contracts/TrooMarketplace.sol)
const TrooMarketplaceABI = [
  // Functions
  'function listNFT(address nftContract, uint256 tokenId, uint256 price) external returns (uint256)',
  'function buyNFT(uint256 listingId) external payable',
  'function cancelListing(uint256 listingId) external',
  'function listings(uint256 listingId) external view returns (address seller, address nftContract, uint256 tokenId, uint256 price, bool active)',
  'function listingCounter() external view returns (uint256)',
  'function platformWallet() external view returns (address)',
  'function platformFee() external view returns (uint256)',
  'function discountedFee() external view returns (uint256)',
  'function trooTokenAddress() external view returns (address)',
  'function minTrooBalance() external view returns (uint256)',
  'function setPlatformFee(uint256 newFee) external',
  'function setDiscountedFee(uint256 newFee) external',
  'function setPlatformWallet(address newWallet) external',
  'function setTrooTokenAddress(address newAddress) external',
  'function setMinTrooBalance(uint256 newBalance) external',
  // Events
  'event Listed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)',
  'event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 platformFeeAmount, uint256 royaltyAmount)',
  'event ListingCancelled(uint256 indexed listingId)',
  'event PlatformFeeUpdated(uint256 oldFee, uint256 newFee)',
  'event DiscountedFeeUpdated(uint256 oldFee, uint256 newFee)',
];

export class ContractIntegration {
  private config: ContractConfig;

  constructor(config: ContractConfig) {
    this.config = config;
  }

  /**
   * Get contract configuration for a specific chain
   */
  static getChainConfig(chain: SupportedChain): ContractConfig {
    const configs: Record<SupportedChain, ContractConfig> = {
      ethereum: {
        chain: 'ethereum',
        nftContract: process.env.NEXT_PUBLIC_ETHEREUM_NFT_CONTRACT,
        marketplaceContract: process.env.NEXT_PUBLIC_ETHEREUM_MARKETPLACE_CONTRACT,
        rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth-mainnet.g.alchemy.com/v2/demo',
      },
      polygon: {
        chain: 'polygon',
        nftContract: process.env.NEXT_PUBLIC_POLYGON_NFT_CONTRACT,
        marketplaceContract: process.env.NEXT_PUBLIC_POLYGON_MARKETPLACE_CONTRACT,
        rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
      },
      metallicus: {
        chain: 'metallicus',
        nftContract: process.env.NEXT_PUBLIC_METALLICUS_NFT_CONTRACT,
        marketplaceContract: process.env.NEXT_PUBLIC_METALLICUS_MARKETPLACE_CONTRACT,
        rpcUrl: process.env.NEXT_PUBLIC_METALLICUS_RPC || '',
      },
      solana: {
        chain: 'solana',
        programId: process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID,
        rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      },
      xrpl: {
        chain: 'xrpl',
        rpcUrl: process.env.NEXT_PUBLIC_XRPL_RPC || 'wss://xrplcluster.com',
      },
    };

    return configs[chain];
  }

  /**
   * Mint NFT on EVM chains (Ethereum, Polygon, Metallicus)
   */
  async mintNFTEVM(
    signer: ethers.Signer,
    metadataURI: string,
    royaltyPercentage: number
  ): Promise<string> {
    if (!this.config.nftContract) {
      throw new Error('NFT contract address not configured');
    }

    const contract = new ethers.Contract(
      this.config.nftContract,
      TrooNFTABI,
      signer
    );

    // Get minting fee
    const mintingFee = await contract.mintingFee();

    // Get signer address
    const signerAddress = await signer.getAddress();

    // Mint NFT (to signer's address)
    const tx = await contract.mintNFT(signerAddress, metadataURI, royaltyPercentage, {
      value: mintingFee,
    });

    const receipt = await tx.wait();

    // Extract token ID from event
    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed && parsed.name === 'NFTMinted');

    if (!event || !event.args) {
      throw new Error('Failed to extract token ID from mint transaction');
    }

    const tokenId = event.args.tokenId.toString();
    return tokenId;
  }

  /**
   * List NFT for sale on EVM chains
   */
  async listNFTEVM(
    signer: ethers.Signer,
    tokenId: string,
    price: string
  ): Promise<string> {
    if (!this.config.marketplaceContract || !this.config.nftContract) {
      throw new Error('Contract addresses not configured');
    }

    const marketplace = new ethers.Contract(
      this.config.marketplaceContract,
      TrooMarketplaceABI,
      signer
    );

    const nftContract = new ethers.Contract(
      this.config.nftContract,
      TrooNFTABI,
      signer
    );

    // Check if already approved
    const approved = await nftContract.getApproved(tokenId);
    const signerAddress = await signer.getAddress();
    const isApprovedForAll = await nftContract.isApprovedForAll(signerAddress, this.config.marketplaceContract);

    // Approve marketplace to transfer NFT if not already approved
    if (approved !== this.config.marketplaceContract && !isApprovedForAll) {
      const approveTx = await nftContract.approve(
        this.config.marketplaceContract,
        tokenId
      );
      await approveTx.wait();
    }

    // List NFT
    const listTx = await marketplace.listNFT(
      this.config.nftContract,
      tokenId,
      ethers.parseEther(price)
    );

    const receipt = await listTx.wait();

    // Extract listing ID from event
    const event = receipt.logs
      .map((log: any) => {
        try {
          return marketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed && parsed.name === 'Listed');

    if (!event || !event.args) {
      throw new Error('Failed to extract listing ID from list transaction');
    }

    const listingId = event.args.listingId.toString();
    return listingId;
  }

  /**
   * Buy NFT on EVM chains
   */
  async buyNFTEVM(
    signer: ethers.Signer,
    listingId: string
  ): Promise<void> {
    if (!this.config.marketplaceContract) {
      throw new Error('Marketplace contract address not configured');
    }

    const marketplace = new ethers.Contract(
      this.config.marketplaceContract,
      TrooMarketplaceABI,
      signer
    );

    // Get listing details (using listings mapping - returns a struct)
    const listing = await marketplace.listings(listingId);

    // listing is a struct: { seller, nftContract, tokenId, price, active }
    if (!listing.active) {
      throw new Error('Listing is not active');
    }

    // Buy NFT with the listing price
    const tx = await marketplace.buyNFT(listingId, {
      value: listing.price,
    });

    await tx.wait();
  }

  /**
   * Get NFT details from contract
   */
  async getNFTDetails(tokenId: string): Promise<any> {
    if (this.config.chain === 'solana' || this.config.chain === 'xrpl') {
      // Solana and XRPL use existing services
      throw new Error(`${this.config.chain} NFT details should be fetched via existing services`);
    }

    // EVM chains
    if (!this.config.nftContract) {
      throw new Error('NFT contract address not configured');
    }

    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    const contract = new ethers.Contract(
      this.config.nftContract,
      TrooNFTABI,
      provider
    );

    const [tokenURI, owner] = await Promise.all([
      contract.tokenURI(tokenId),
      contract.ownerOf(tokenId),
    ]);

    return {
      tokenId,
      tokenURI,
      owner,
    };
  }
}

/**
 * Hook for using contract integration in React components
 */
export function useContractIntegration(chain: SupportedChain) {
  const config = ContractIntegration.getChainConfig(chain);
  return new ContractIntegration(config);
}
