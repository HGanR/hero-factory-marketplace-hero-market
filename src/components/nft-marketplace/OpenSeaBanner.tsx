"use client";

import { useMemo, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChainIcon } from "./ChainIcon";

const ELECTRIC_BLUE = "#00D1FF";

interface ListedNFT {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: string;
  contractAddress: string;
  collection: string;
  tokenStandard: string;
  listPrice?: number;
  listCurrency?: string;
}

interface WalletNFT {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: string;
  ownerAddress: string;
  isListed: boolean;
  listPrice?: number;
  listCurrency?: string;
  contractAddress: string;
  attributes?: any;
}

interface OpenSeaBannerProps {
  walletNfts?: WalletNFT[];
  selectedChain?: string;
}

function shuffle<T>(items: T[]) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function OpenSeaBanner({ walletNfts = [], selectedChain = "all" }: OpenSeaBannerProps) {
  const { address, isConnected } = useAccount();
  const [listedNfts, setListedNfts] = useState<ListedNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchListedNFTs();
  }, [selectedChain]);

  // Update current index when NFTs change
  useEffect(() => {
    setCurrentIndex(0);
  }, [walletNfts, listedNfts]);

  const fetchListedNFTs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/nft-marketplace/listings?chain=${selectedChain}&limit=20`
      );
      if (response.ok) {
        const data: { nfts?: ListedNFT[] } = await response.json();
        const shuffled = shuffle(Array.isArray(data.nfts) ? data.nfts : []);
        setListedNfts(shuffled);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error fetching listed NFTs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Determine which NFTs to display
  const walletPool = useMemo(() => {
    if (!walletNfts.length) return [];
    if (selectedChain === "all") return walletNfts;
    return walletNfts.filter((nft) => nft.chain === selectedChain);
  }, [walletNfts, selectedChain]);

  const mergedListings = useMemo(() => {
    const walletKeys = new Set<string>();
    const walletList = shuffle(walletPool);
    for (const nft of walletList) {
      const key = nft.id || `${nft.contractAddress || ""}:${nft.tokenId || ""}`;
      walletKeys.add(key);
    }
    const remaining = listedNfts.filter((nft) => {
      const key = nft.id || `${nft.contractAddress || ""}:${nft.tokenId || ""}`;
      return !walletKeys.has(key);
    });
    return [...walletList, ...shuffle(remaining)];
  }, [listedNfts, walletPool]);

  const showWallet = isConnected && walletPool.length > 0;
  const displayNfts = isConnected ? mergedListings : listedNfts;
  const nftsToShow = displayNfts.map((nft: any) => ({
    id: nft.id,
    tokenId: nft.tokenId,
    name: nft.name,
    description: nft.description,
    imageUrl: nft.imageUrl,
    chain: nft.chain,
    contractAddress: nft.contractAddress,
    collection: showWallet ? `Wallet NFT` : (nft.collection || "Listed NFT"),
    tokenStandard: nft.tokenStandard || 'ERC-721',
    listPrice: nft.listPrice,
    listCurrency: nft.listCurrency,
    isWalletNft: showWallet && walletPool.some((w) => w.id === nft.id),
  }));

  const nextNFT = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(nftsToShow.length, 1));
  };

  const prevNFT = () => {
    setCurrentIndex((prev) => (prev - 1 + nftsToShow.length) % Math.max(nftsToShow.length, 1));
  };

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (nftsToShow.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % nftsToShow.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [nftsToShow.length]);

  if (!isConnected || !address) {
    return (
      <div className="w-full h-[400px] bg-slate-800/40 rounded-lg flex items-center justify-center border border-white/10">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-2">Connect your wallet to view NFTs</p>
          <p className="text-slate-500 text-sm">Select a network above to see your NFT collection</p>
        </div>
      </div>
    );
  }

  if (loading && !showWallet) {
    return (
      <div className="w-full h-[400px] bg-slate-800/40 rounded-lg flex items-center justify-center border border-white/10">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (nftsToShow.length === 0) {
    return (
      <div className="w-full h-[400px] bg-slate-800/40 rounded-lg flex items-center justify-center border border-white/10">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-2">
            {showWallet ? "No NFTs in your wallet" : "No public listings found yet"}
          </p>
          <p className="text-slate-500 text-sm">
            {showWallet
              ? `NFTs you own on ${selectedChain === "all" ? "all chains" : selectedChain} will appear here`
              : "Public NFTs for sale and NFTs created on this site will appear here once listed"
            }
          </p>
        </div>
      </div>
    );
  }

  const currentNFT = nftsToShow[currentIndex];

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {isConnected ? "My Wallet + Listings" : "Featured Listings"}
          </h2>
        </div>
        <Badge className="bg-black/70 backdrop-blur-sm text-cyan-300 border-cyan-500/50">
          {nftsToShow.length} NFT{nftsToShow.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="bg-slate-800/40 border-white/10 overflow-hidden">
        <div className="relative w-full h-[400px] flex items-center">
          {/* Previous Button */}
          {nftsToShow.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 bg-black/50 hover:bg-black/70 rounded-full h-12 w-12"
              onClick={prevNFT}
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </Button>
          )}

          {/* NFT Display */}
          <div className="flex-1 h-full flex items-center justify-center p-8">
            <div className="flex gap-8 items-center max-w-6xl w-full">
              {/* NFT Image */}
              <div className="flex-shrink-0 w-[300px] h-[300px] rounded-lg overflow-hidden bg-slate-700/40 border-2 border-cyan-500/30">
                {currentNFT.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentNFT.imageUrl}
                    alt={currentNFT.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/300/374151/FFFFFF?text=NFT";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    No Image
                  </div>
                )}
              </div>

              {/* NFT Details */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-3xl font-bold text-white mb-2">{currentNFT.name}</h3>
                  {currentNFT.collection && (
                    <p className="text-slate-400 text-lg mb-4">{currentNFT.collection}</p>
                  )}
                </div>

                {currentNFT.description && (
                  <p className="text-slate-300 text-sm line-clamp-3">{currentNFT.description}</p>
                )}

                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center gap-2">
                    <ChainIcon chain={currentNFT.chain} size={24} />
                    <span className="text-slate-300 text-sm">{currentNFT.chain.charAt(0).toUpperCase() + currentNFT.chain.slice(1)}</span>
                  </div>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {currentNFT.tokenStandard}
                  </Badge>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    asChild
                    style={{
                      backgroundColor: "#06b6d4",
                      color: "#000",
                      border: `2px solid ${ELECTRIC_BLUE}`,
                    }}
                  >
                    <a href={`/nft-marketplace/${currentNFT.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Listing
                    </a>
                  </Button>
                  {!showWallet && currentNFT.listPrice !== undefined ? (
                    <Badge className="bg-black/70 backdrop-blur-sm text-cyan-300 border-cyan-500/50">
                      {currentNFT.listPrice} {currentNFT.listCurrency || ""}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Next Button */}
          {nftsToShow.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full h-12 w-12"
              onClick={nextNFT}
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </Button>
          )}

          {/* Dots Indicator */}
          {nftsToShow.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              {nftsToShow.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? "w-8 bg-cyan-500"
                      : "w-2 bg-slate-600 hover:bg-slate-500"
                  }`}
                  aria-label={`Go to NFT ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
