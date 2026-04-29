// src/hooks/useNFTContract.ts
import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { BrowserProvider } from 'ethers';
import { ContractIntegration, SupportedChain } from '@/lib/contracts/contract-integration';
import { uploadFileToIPFS, uploadJSONToIPFS } from '@/lib/marketplace/pinata';

export interface MintNFTParams {
  name: string;
  description: string;
  image: File | string; // Can be File or URL string
  attributes?: Array<{ trait_type: string; value: string }>;
  royaltyPercentage: number;
}

export interface ListNFTParams {
  tokenId: string;
  price: string;
}

export function useNFTContract(chain: SupportedChain) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const integration = new ContractIntegration(
    ContractIntegration.getChainConfig(chain)
  );

  // Get signer from wallet client
  const getSigner = async () => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }
    // Convert wallet client to ethers signer
    const provider = new BrowserProvider(walletClient as any);
    return await provider.getSigner();
  };

  /**
   * Mint a new NFT
   */
  const mintNFT = async (params: MintNFTParams): Promise<string | null> => {
    if (!address || !walletClient) {
      setError('Wallet not connected');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrl: string;
      
      // Handle image upload - if it's a File, upload to IPFS; if it's a string, use it directly
      if (params.image instanceof File) {
        // Convert File to Buffer for upload
        const arrayBuffer = await params.image.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadResult = await uploadFileToIPFS(
          buffer,
          params.image.name || 'nft-image',
          params.image.type || 'image/jpeg'
        );
        imageUrl = uploadResult.ipfsUrl;
      } else {
        imageUrl = params.image;
      }

      // Create metadata
      const metadata = {
        name: params.name,
        description: params.description,
        image: imageUrl,
        attributes: params.attributes || [],
      };

      // Upload metadata to IPFS
      const metadataUpload = await uploadJSONToIPFS(metadata);
      const metadataUrl = metadataUpload.ipfsUrl;

      // Mint NFT on blockchain
      let tokenId: string;

      if (chain === 'solana' || chain === 'xrpl') {
        // Solana and XRPL use existing API routes
        throw new Error(`${chain} minting should use API routes`);
      } else {
        // EVM chains - use smart contract
        const signer = await getSigner();
        tokenId = await integration.mintNFTEVM(
          signer,
          metadataUrl,
          params.royaltyPercentage
        );
      }

      setLoading(false);
      return tokenId;
    } catch (err: any) {
      setError(err.message || 'Failed to mint NFT');
      setLoading(false);
      return null;
    }
  };

  /**
   * List an NFT for sale
   */
  const listNFT = async (params: ListNFTParams): Promise<string | null> => {
    if (!address || !walletClient) {
      setError('Wallet not connected');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let listingId: string;

      if (chain === 'solana' || chain === 'xrpl') {
        // Solana and XRPL use existing API routes
        throw new Error(`${chain} listing should use API routes`);
      } else {
        // EVM chains - use smart contract
        const signer = await getSigner();
        listingId = await integration.listNFTEVM(
          signer,
          params.tokenId,
          params.price
        );
      }

      setLoading(false);
      return listingId;
    } catch (err: any) {
      setError(err.message || 'Failed to list NFT');
      setLoading(false);
      return null;
    }
  };

  /**
   * Buy an NFT
   */
  const buyNFT = async (listingId: string): Promise<boolean> => {
    if (!address || !walletClient) {
      setError('Wallet not connected');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      if (chain === 'solana' || chain === 'xrpl') {
        // Solana and XRPL use existing API routes
        throw new Error(`${chain} buying should use API routes`);
      } else {
        // EVM chains - use smart contract
        const signer = await getSigner();
        await integration.buyNFTEVM(signer, listingId);
      }

      setLoading(false);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to buy NFT');
      setLoading(false);
      return false;
    }
  };

  /**
   * Get NFT details
   */
  const getNFTDetails = async (tokenId: string) => {
    setLoading(true);
    setError(null);

    try {
      const details = await integration.getNFTDetails(tokenId);
      setLoading(false);
      return details;
    } catch (err: any) {
      setError(err.message || 'Failed to get NFT details');
      setLoading(false);
      return null;
    }
  };

  return {
    mintNFT,
    listNFT,
    buyNFT,
    getNFTDetails,
    loading,
    error,
  };
}
