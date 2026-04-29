"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { OpenSeaBanner } from "@/components/nft-marketplace/OpenSeaBanner";
import { ChainIcon } from "@/components/nft-marketplace/ChainIcon";
import { useNFTContract } from "@/hooks/useNFTContract";
import { useWriteContract, useSwitchChain, useChainId, usePublicClient } from "wagmi";
import { BaseError, decodeEventLog, parseEther, formatEther } from "viem";
import MobileWalletButton from "@/components/MobileWalletButton";

const ELECTRIC_BLUE = "#00D1FF";

interface NFT {
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
  contractAddress?: string;
  attributes?: Array<{ trait_type?: string; value?: string }>;
}

const ACCEPT_TYPES = ".jpeg,.jpg,.gif,.mov,.mp4,.png,.webp";
const MAX_QTY = 10_000;

// EVM NFT contract addresses
const EVM_NFT_ETHEREUM = (
  process.env.NEXT_PUBLIC_EVM_CONTRACT_ETHEREUM ||
  process.env.NEXT_PUBLIC_ETH_NFT_ADDRESS ||
  process.env.NEXT_PUBLIC_ETHEREUM_NFT_CONTRACT ||
  ""
) as `0x${string}` | "";

const EVM_NFT_POLYGON = (
  process.env.NEXT_PUBLIC_POLYGON_NFT_CONTRACT ||
  ""
) as `0x${string}` | "";

const EVM_NFT_METALLICUS = (
  process.env.NEXT_PUBLIC_METALLICUS_NFT_CONTRACT ||
  ""
) as `0x${string}` | "";

const EVM_NFT_FACTORY_POLYGON = (
  process.env.NEXT_PUBLIC_POLYGON_NFT_FACTORY ||
  ""
) as `0x${string}` | "";

const EVM_NFT_FACTORY_DEPLOY_FEE_WEI =
  process.env.NEXT_PUBLIC_POLYGON_NFT_FACTORY_DEPLOY_FEE_WEI || "0";

const TROO_NFT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string", name: "uri", type: "string" },
      { internalType: "uint96", name: "royaltyPercentage", type: "uint96" },
    ],
    name: "mintNFT",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string[]", name: "uris", type: "string[]" },
      { internalType: "uint96", name: "royaltyPercentage", type: "uint96" },
    ],
    name: "mintNFTBatch",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "mintingFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TROO_FACTORY_ABI = [
  {
    inputs: [],
    name: "deploymentFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "name_", type: "string" },
      { internalType: "string", name: "symbol_", type: "string" },
      { internalType: "uint256", name: "mintPriceWei", type: "uint256" },
      { internalType: "uint96", name: "defaultRoyaltyBps", type: "uint96" },
    ],
    name: "createCollection",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
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

const TROO_COLLECTION_ABI = [
  {
    inputs: [],
    name: "mintPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string", name: "uri", type: "string" },
      { internalType: "uint96", name: "royaltyBps", type: "uint96" },
    ],
    name: "mintTo",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string", name: "uri", type: "string" },
      { internalType: "uint96", name: "royaltyBps", type: "uint96" },
    ],
    name: "ownerMintTo",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string[]", name: "uris", type: "string[]" },
      { internalType: "uint96", name: "royaltyBps", type: "uint96" },
    ],
    name: "mintBatchTo",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "string[]", name: "uris", type: "string[]" },
      { internalType: "uint96", name: "royaltyBps", type: "uint96" },
    ],
    name: "ownerMintBatchTo",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function readJsonSafe(response: Response) {
  const raw = await response.text();
  if (!raw) return { ok: false, error: "Empty response from server" };
  try {
    return JSON.parse(raw);
  } catch {
    return { ok: false, error: `Non-JSON response (${response.status}): ${raw.slice(0, 200)}` };
  }
}

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

async function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) return file;
  const img = await loadImageFromFile(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) return file;

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const targetType =
    file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const targetName =
    targetType === file.type ? file.name : file.name.replace(/\.(png|jpe?g|webp)$/i, ".jpg");

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, targetType, targetType === "image/png" ? undefined : 0.82)
  );
  if (!blob) return file;
  return new File([blob], targetName, { type: targetType });
}

async function prepareUploadFile(file: File, label: string) {
  let output = file;
  if (file.type.startsWith("image/")) {
    output = await compressImageFile(file);
  }
  if (output.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${label} is too large (${formatSize(output.size)}). Use an image under 3MB.`);
  }
  return output;
}

function sanitizeSyncMessage(message: string | undefined, fallback: string) {
  const raw = (message || "").toLowerCase();
  if (!raw) return fallback;
  if (raw.includes("rpc request failed") || raw.includes("block range is too large")) {
    return "Sync temporarily unavailable. Please try again later.";
  }
  return message || fallback;
}

export default function NFTMarketplacePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"browse" | "deploy" | "collection">("browse");
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [walletNfts, setWalletNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletNftsLoading, setWalletNftsLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>("polygon");
  const [showWalletNfts, setShowWalletNfts] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_low" | "price_high" | "name">("newest");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [publicCollections, setPublicCollections] = useState<
    Array<{ id: string; name: string; symbol: string; imageUrl?: string | null; chain?: string; contractAddress?: string | null }>
  >([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionSyncing, setCollectionSyncing] = useState(false);
  const [collectionSyncStatus, setCollectionSyncStatus] = useState<string>("");
  const [nftSyncing, setNftSyncing] = useState(false);
  const [nftSyncStatus, setNftSyncStatus] = useState("");
  const lastSyncedAddressRef = useRef<string>("");

  useEffect(() => {
    if (activeTab === "browse") {
      fetchNFTs();
      if (isConnected && address) {
        fetchWalletNFTs();
      }
    }
  }, [selectedChain, activeTab, isConnected, address, searchQuery, sortBy, collectionFilter]);

  useEffect(() => {
    if (!isConnected || !address) return;
    const normalized = address.toLowerCase();
    if (lastSyncedAddressRef.current === normalized) return;
    lastSyncedAddressRef.current = normalized;
    setCollectionSyncing(true);
    setCollectionSyncStatus("Syncing collections…");
    fetch("/api/nft-marketplace/collections/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorAddress: normalized }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setCollectionSyncStatus(`Synced ${j.inserted ?? 0} of ${j.total ?? 0} collections.`);
        } else {
          setCollectionSyncStatus(sanitizeSyncMessage(j?.error, "Collection sync failed."));
        }
        // refresh collection list after sync
        if (activeTab === "browse") {
          setCollectionsLoading(true);
          const url = `/api/nft-marketplace/collections?creator=${normalized}`;
          fetch(url)
            .then((r) => r.json())
            .then((resp) => {
              if (resp?.success && Array.isArray(resp?.collections)) {
                setPublicCollections((prev) => {
                  const byId = new Map<string, { id: string; name: string; symbol: string; imageUrl?: string | null; chain?: string; contractAddress?: string | null }>();
                  for (const c of prev) byId.set(String(c.id), c);
                  for (const c of resp.collections) {
                    if (c?.id && !byId.has(String(c.id))) {
                      byId.set(String(c.id), {
                        id: String(c.id),
                        name: c.name,
                        symbol: c.symbol,
                        imageUrl: c.imageUrl ?? null,
                        chain: c.chain,
                        contractAddress: c.contractAddress ?? null,
                      });
                    }
                  }
                  return Array.from(byId.values());
                });
              }
            })
            .finally(() => setCollectionsLoading(false));
        }
      })
      .catch(() => {
        setCollectionSyncStatus("Collection sync failed.");
      })
      .finally(() => setCollectionSyncing(false));
  }, [isConnected, address, activeTab]);

  useEffect(() => {
    if (activeTab !== "browse") return;
    let active = true;
    setCollectionsLoading(true);
    const publicUrl = `/api/nft-marketplace/public-collections?chain=${selectedChain}`;
    const creatorUrl =
      isConnected && address
        ? selectedChain === "all"
          ? `/api/nft-marketplace/collections?creator=${address}`
          : `/api/nft-marketplace/collections?creator=${address}&chain=${selectedChain}`
        : null;

    Promise.all([
      fetch(publicUrl).then((r) => r.json()).catch(() => ({ ok: false, collections: [] })),
      creatorUrl
        ? fetch(creatorUrl).then((r) => r.json()).catch(() => ({ success: false, collections: [] }))
        : Promise.resolve({ success: true, collections: [] }),
    ])
      .then(([publicRes, creatorRes]) => {
        if (!active) return;
        const publicCols = publicRes?.ok && Array.isArray(publicRes?.collections) ? publicRes.collections : [];
        const creatorCols = Array.isArray(creatorRes?.collections) ? creatorRes.collections : [];
        const byId = new Map<string, { id: string; name: string; symbol: string; imageUrl?: string | null; chain?: string; contractAddress?: string | null }>();
        for (const c of publicCols) {
          if (c?.id)
            byId.set(String(c.id), {
              id: String(c.id),
              name: c.name,
              symbol: c.symbol,
              imageUrl: c.imageUrl ?? null,
              chain: c.chain,
              contractAddress: c.contractAddress ?? null,
            });
        }
        for (const c of creatorCols) {
          if (c?.id && !byId.has(String(c.id))) {
            byId.set(String(c.id), {
              id: String(c.id),
              name: c.name,
              symbol: c.symbol,
              imageUrl: c.imageUrl ?? null,
              chain: c.chain,
              contractAddress: c.contractAddress ?? null,
            });
          }
        }
        setPublicCollections(Array.from(byId.values()));
      })
      .catch(() => setPublicCollections([]))
      .finally(() => {
        if (active) setCollectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, selectedChain, isConnected, address]);

  const fetchNFTs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("chain", selectedChain);
      params.set("sort", sortBy);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (collectionFilter !== "all") params.set("collectionId", collectionFilter);
      const response = await fetch(`/api/nft-marketplace/public-assets?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNfts(data.nfts || []);
      }
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletNFTs = async () => {
    if (!isConnected || !address) return;

    setWalletNftsLoading(true);
    try {
      console.log("Fetching wallet NFTs for address:", address, "on chain:", selectedChain);
      await fetch("/api/nft-marketplace/nfts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress: address.toLowerCase() }),
      }).catch(() => null);
      const response = await fetch(`/api/nft-marketplace/wallet-nfts?address=${address}&chain=${selectedChain}`);
      console.log("Wallet NFT response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Wallet NFT data:", data);
        setWalletNfts(data.nfts || []);
      } else {
        console.error("Failed to fetch wallet NFTs:", response.status, response.statusText);
        setWalletNfts([]);
      }
    } catch (error) {
      console.error("Error fetching wallet NFTs:", error);
      setWalletNfts([]);
    } finally {
      setWalletNftsLoading(false);
    }
  };

  const handleWalletConnect = () => {
    setShowWalletConnect(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              NFT Marketplace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <Badge className="bg-black/70 backdrop-blur-sm text-cyan-300 border-cyan-500/50">
                {address.slice(0, 6)}…{address.slice(-4)}
              </Badge>
            ) : null}
            <MobileWalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* NFT Banner Carousel */}
        <OpenSeaBanner
          walletNfts={walletNfts as any}
          selectedChain={selectedChain}
        />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "deploy" | "collection")} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8">
            <TabsTrigger value="browse">Browse NFTs</TabsTrigger>
            <TabsTrigger value="deploy">Deploy NFT</TabsTrigger>
            <TabsTrigger value="collection">Deploy Collection</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <BrowseNFTs
              nfts={nfts}
              walletNfts={walletNfts}
              loading={loading}
              walletNftsLoading={walletNftsLoading}
              selectedChain={selectedChain}
              onChainChange={setSelectedChain}
              isConnected={isConnected}
              address={address}
              showWalletNfts={showWalletNfts}
              onToggleWalletNfts={setShowWalletNfts}
              onWalletConnect={handleWalletConnect}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
              collectionFilter={collectionFilter}
              onCollectionChange={setCollectionFilter}
              publicCollections={publicCollections}
              collectionsLoading={collectionsLoading}
              collectionSyncing={collectionSyncing}
              collectionSyncStatus={collectionSyncStatus}
              nftSyncing={nftSyncing}
              nftSyncStatus={nftSyncStatus}
              onSyncCollections={(wallet) => {
                setCollectionSyncing(true);
                setCollectionSyncStatus("Syncing collections…");
                fetch("/api/nft-marketplace/collections/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ creatorAddress: wallet.toLowerCase() }),
                })
                  .then((r) => r.json())
                  .then((j) => {
                if (j?.ok) {
                  setCollectionSyncStatus(`Synced ${j.inserted ?? 0} of ${j.total ?? 0} collections.`);
                } else {
                  setCollectionSyncStatus(sanitizeSyncMessage(j?.error, "Collection sync failed."));
                }
                  })
              .catch(() => setCollectionSyncStatus("Collection sync failed."))
                  .finally(() => setCollectionSyncing(false));
              }}
              onSyncNfts={() => {
                setNftSyncing(true);
                setNftSyncStatus("Syncing NFTs…");
                fetch("/api/nft-marketplace/nfts/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                })
                  .then((r) => r.json())
                  .then((j) => {
                if (j?.ok) {
                  setNftSyncStatus(`Synced ${j.inserted ?? 0} new, ${j.updated ?? 0} updated.`);
                } else {
                  setNftSyncStatus(sanitizeSyncMessage(j?.error, "NFT sync failed."));
                }
                  })
              .catch(() => setNftSyncStatus("NFT sync failed."))
                  .finally(() => setNftSyncing(false));
              }}
            />
          </TabsContent>

          <TabsContent value="deploy">
            <DeployNFT onDeploySuccess={fetchNFTs} />
          </TabsContent>

          <TabsContent value="collection">
            <DeployCollection onDeploySuccess={fetchNFTs} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Wallet Connect Modal */}
      {showWalletConnect && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-cyan-500/20 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Connect Your Wallet</h3>
            <p className="text-slate-300 mb-6">
              To view your NFTs on the {selectedChain === "all" ? "selected network" : selectedChain + " network"}, please connect your wallet.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowWalletConnect(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <div className="flex-1">
                <MobileWalletButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Browse NFTs Component
function BrowseNFTs({
  nfts,
  walletNfts,
  loading,
  walletNftsLoading,
  selectedChain,
  onChainChange,
  isConnected,
  address,
  showWalletNfts,
  onToggleWalletNfts,
  onWalletConnect,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  collectionFilter,
  onCollectionChange,
  publicCollections,
  collectionsLoading,
  collectionSyncing,
  collectionSyncStatus,
  nftSyncing,
  nftSyncStatus,
  onSyncCollections,
  onSyncNfts,
}: {
  nfts: NFT[];
  walletNfts: NFT[];
  loading: boolean;
  walletNftsLoading: boolean;
  selectedChain: string;
  onChainChange: (chain: string) => void;
  isConnected: boolean;
  address?: string;
  showWalletNfts: boolean;
  onToggleWalletNfts: (show: boolean) => void;
  onWalletConnect?: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: "newest" | "price_low" | "price_high" | "name";
  onSortChange: (value: "newest" | "price_low" | "price_high" | "name") => void;
  collectionFilter: string;
  onCollectionChange: (value: string) => void;
  publicCollections: Array<{ id: string; name: string; symbol: string; imageUrl?: string | null; chain?: string; contractAddress?: string | null }>;
  collectionsLoading: boolean;
  collectionSyncing: boolean;
  collectionSyncStatus: string;
  nftSyncing: boolean;
  nftSyncStatus: string;
  onSyncCollections: (address: string) => void;
  onSyncNfts: () => void;
}) {
  const chains = ["all", "xrpl", "solana", "ethereum", "polygon", "metallicus"];

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <Label className="text-slate-300">Search</Label>
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, description, or collection..."
            className="mt-1 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <div>
          <Label className="text-slate-300">Sort</Label>
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as any)}>
            <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price_low">Price: Low to High</SelectItem>
              <SelectItem value="price_high">Price: High to Low</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6">
        <Label className="text-slate-300">Collection</Label>
        <Select value={collectionFilter} onValueChange={(v) => onCollectionChange(v)}>
          <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
            <SelectValue placeholder={collectionsLoading ? "Loading..." : "All collections"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {publicCollections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} • {c.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {publicCollections.length > 0 ? (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Collections</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{publicCollections.length}</span>
              {isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={collectionSyncing}
                  onClick={() => {
                    if (!address) return;
                    onSyncCollections(address);
                  }}
                >
                  {collectionSyncing ? "Syncing…" : "Sync Collections"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={nftSyncing}
                onClick={onSyncNfts}
              >
                {nftSyncing ? "Syncing NFTs…" : "Sync All NFTs"}
              </Button>
            </div>
          </div>
          {collectionSyncStatus ? (
            <div className="mb-3 text-xs text-slate-400">{collectionSyncStatus}</div>
          ) : null}
          {nftSyncStatus ? (
            <div className="mb-3 text-xs text-slate-400">{nftSyncStatus}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {publicCollections.map((c) => (
              <Card key={c.id} className="bg-slate-800/40 border-white/10 overflow-hidden">
                <div className="aspect-square bg-slate-900/60">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-slate-500 text-xs">No image</div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 truncate">{c.symbol}</div>
                  <div className="mt-3 flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/nft-marketplace/collection/${c.id}`}>View Collection</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* Chain Filter */}
      <div className="mb-8 flex gap-3 flex-wrap items-center">
        {chains.map((chain) => {
          if (chain === "all") {
            return (
              <Button
                key={chain}
                variant={selectedChain === chain ? "default" : "outline"}
                onClick={() => {
                  if (showWalletNfts && !isConnected && onWalletConnect) {
                    // If viewing wallet NFTs and not connected, prompt for wallet connection
                    onWalletConnect();
                  } else {
                    onChainChange(chain);
                  }
                }}
                style={
                  selectedChain === chain
                    ? {
                        backgroundColor: "#06b6d4",
                        color: "#000",
                        border: `2px solid ${ELECTRIC_BLUE}`,
                      }
                    : {}
                }
              >
                All Chains
              </Button>
            );
          }
          return (
            <Button
              key={chain}
              variant={selectedChain === chain ? "default" : "outline"}
              onClick={() => {
                if (showWalletNfts && !isConnected && onWalletConnect) {
                  // If viewing wallet NFTs and not connected, prompt for wallet connection
                  onWalletConnect();
                } else {
                  onChainChange(chain);
                }
              }}
              className="flex items-center gap-2 px-3 py-2"
              style={
                selectedChain === chain
                  ? {
                      backgroundColor: "#06b6d4",
                      color: "#000",
                      border: `2px solid ${ELECTRIC_BLUE}`,
                    }
                  : {
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }
              }
            >
              <ChainIcon chain={chain} size={20} />
            </Button>
          );
        })}
      </div>

      {/* Network Selection Helper */}
      {!isConnected && showWalletNfts && (
        <div className="mb-6 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg">
          <div className="text-center">
            <p className="text-slate-300 mb-3">Select a network above and connect your wallet to view your NFTs</p>
          </div>
        </div>
      )}

      {/* NFT Source Toggle */}
      {isConnected && (
        <div className="mb-6 flex gap-2">
          <Button
            variant={!showWalletNfts ? "default" : "outline"}
            onClick={() => onToggleWalletNfts(false)}
            style={
              !showWalletNfts
                ? {
                    backgroundColor: "#06b6d4",
                    color: "#000",
                    border: `2px solid ${ELECTRIC_BLUE}`,
                  }
                : {}
            }
          >
            🏪 Marketplace NFTs
          </Button>
          <Button
            variant={showWalletNfts ? "default" : "outline"}
            onClick={() => onToggleWalletNfts(true)}
            style={
              showWalletNfts
                ? {
                    backgroundColor: "#06b6d4",
                    color: "#000",
                    border: `2px solid ${ELECTRIC_BLUE}`,
                  }
                : {}
            }
          >
            👛 My Wallet NFTs ({walletNfts.length})
          </Button>
        </div>
      )}

      {/* NFT Grid - Public library vs wallet */}
      {!showWalletNfts && (
        <>
          {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg">No NFTs found</p>
          <p className="text-slate-500 text-sm mt-2">Be the first to list an NFT!</p>
        </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <NFTCard key={nft.id} nft={nft} />
            ))}
          </div>
        )}
        </>
      )}

      {showWalletNfts && (
        <>
          {walletNftsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          ) : walletNfts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-400 text-lg">No NFTs found in this wallet</p>
              <p className="text-slate-500 text-sm mt-2">Try another chain or mint one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {walletNfts.map((nft) => (
                <NFTCard key={nft.id} nft={nft} isWalletNft />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// NFT Card Component
function NFTCard({ nft, isWalletNft = false }: { nft: NFT; isWalletNft?: boolean }) {
  return (
    <Card className={`bg-slate-800/40 border-white/10 hover:border-cyan-500/50 transition-all hover:scale-105 ${isWalletNft ? 'ring-2 ring-green-500/50' : ''}`}>
      <div className="aspect-square bg-slate-700/40 relative overflow-hidden rounded-t-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={nft.imageUrl || "https://via.placeholder.com/400"}
          alt={nft.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://via.placeholder.com/400/374151/FFFFFF?text=NFT";
          }}
        />
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full p-1 border border-cyan-500/50">
          <ChainIcon chain={nft.chain} size={28} />
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-bold text-white">{nft.name}</h3>
          <Badge
            variant={nft.attributes?.some?.((a: any) => String(a?.trait_type || "").toLowerCase() === "visibility" && String(a?.value || "").toLowerCase() === "hidden") ? "outline" : "secondary"}
          >
            {nft.attributes?.some?.((a: any) => String(a?.trait_type || "").toLowerCase() === "visibility" && String(a?.value || "").toLowerCase() === "hidden") ? "Hidden" : "Public"}
          </Badge>
        </div>
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">{nft.description}</p>
        {isWalletNft ? (
          // Wallet NFT - show ownership actions
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                👛 Owned by You
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/nft-marketplace/${nft.id}`}>View Details</Link>
              </Button>
              {!nft.isListed && (
                <Button
                  size="sm"
                  style={{
                    backgroundColor: "#06b6d4",
                    color: "#000",
                    border: `2px solid ${ELECTRIC_BLUE}`,
                  }}
                  asChild
                >
                  <Link href={`/nft-marketplace/${nft.id}?action=list`}>List for Sale</Link>
                </Button>
              )}
              {nft.isListed && nft.listPrice && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-slate-500">Listed for</p>
                  <p className="text-sm font-bold text-cyan-400">
                    {nft.listPrice} {nft.listCurrency}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Marketplace NFT - show buying actions
          <>
            {nft.isListed && nft.listPrice && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Price</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {nft.listPrice} {nft.listCurrency}
                  </p>
                </div>
                <Button
                  asChild
                  style={{
                    backgroundColor: "#06b6d4",
                    color: "#000",
                    border: `2px solid ${ELECTRIC_BLUE}`,
                  }}
                >
                  <Link href={`/nft-marketplace/${nft.id}`}>Buy Now</Link>
                </Button>
              </div>
            )}
            {!nft.isListed && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/nft-marketplace/${nft.id}`}>View Details</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Mint NFT Component
function MintNFT({ onMintSuccess }: { onMintSuccess: () => void }) {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
    chain: "polygon",
    royaltyPercentage: 5,
  });
  const [isVisible, setIsVisible] = useState(true);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSmartContract, setUseSmartContract] = useState(false);

  // Initialize contract hook for EVM chains (only when needed)
  const isEVMChain = formData.chain === "ethereum" || formData.chain === "polygon" || formData.chain === "metallicus";
  const contractHook = isEVMChain ? useNFTContract(formData.chain as any) : null;

  // Check if smart contracts are configured for the selected chain
  const checkContractAvailable = (chain: string): boolean => {
    if (chain === "solana" || chain === "xrpl") {
      return false; // Use API routes for Solana and XRPL
    }
    return isEVMChain;
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      setError("Please connect your wallet");
      return;
    }

    setMinting(true);
    setError(null);

    try {
      // Use smart contract if available and enabled
      const contractAvailable = checkContractAvailable(formData.chain);
      
      const visibilityAttribute = { trait_type: "visibility", value: isVisible ? "public" : "hidden" };
      if (contractAvailable && useSmartContract && contractHook) {
        // Convert image URL to File if needed
        let imageFile: File;
        if (formData.image.startsWith("http")) {
          try {
            const response = await fetch(formData.image);
            const blob = await response.blob();
            imageFile = new File([blob], "nft-image.jpg", { type: blob.type || "image/jpeg" });
          } catch (err) {
            setError("Failed to fetch image. Please ensure the URL is accessible.");
            setMinting(false);
            return;
          }
        } else {
          setError("Please provide a valid image URL for smart contract minting");
          setMinting(false);
          return;
        }

        const tokenId = await contractHook.mintNFT({
          name: formData.name,
          description: formData.description,
          image: imageFile,
          royaltyPercentage: formData.royaltyPercentage,
          attributes: [visibilityAttribute],
        });

        if (tokenId) {
          const contractAddress =
            formData.chain === "ethereum"
              ? EVM_NFT_ETHEREUM
              : formData.chain === "polygon"
                ? EVM_NFT_POLYGON
                : formData.chain === "metallicus"
                  ? EVM_NFT_METALLICUS
                  : "";
          if (contractAddress) {
            await fetch("/api/nft-marketplace/record", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokenId,
                name: formData.name,
                description: formData.description,
                imageUrl: formData.image,
                chain: formData.chain,
                contractAddress,
                ownerAddress: address,
                creatorAddress: address,
                royaltyPercentage: formData.royaltyPercentage,
                attributes: [visibilityAttribute],
              }),
            }).catch(() => {});
          }
          alert(`NFT minted successfully! Token ID: ${tokenId}`);
          setFormData({
            name: "",
            description: "",
            image: "",
            chain: "polygon",
            royaltyPercentage: 5,
          });
          setIsVisible(true);
          onMintSuccess();
        } else {
          setError(contractHook.error || "Failed to mint NFT via smart contract");
        }
      } else {
        // Use API route (existing flow)
        const response = await fetch("/api/nft-marketplace/mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: formData.chain,
            ownerAddress: address,
            royaltyPercentage: formData.royaltyPercentage,
            metadata: {
              name: formData.name,
              description: formData.description,
              image: formData.image,
              attributes: [visibilityAttribute],
            },
          }),
        });

        const data = await response.json();
        if (data.success) {
          alert("NFT minted successfully!");
          setFormData({
            name: "",
            description: "",
            image: "",
            chain: "polygon",
            royaltyPercentage: 5,
          });
          setIsVisible(true);
          onMintSuccess();
        } else {
          setError(data.error || "Failed to mint NFT");
        }
      }
    } catch (error: any) {
      console.error("Error minting NFT:", error);
      setError(error.message || "Failed to mint NFT");
    } finally {
      setMinting(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-800/40 border-white/10 p-8">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">Please connect your wallet to mint NFTs</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const contractAvailable = checkContractAvailable(formData.chain);

  return (
    <Card className="max-w-2xl mx-auto bg-slate-800/40 border-white/10 p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Mint New NFT</h2>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {contractAvailable && (
        <div className="mb-4 rounded-md border border-cyan-500/50 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSmartContract}
              onChange={(e) => setUseSmartContract(e.target.checked)}
              className="rounded"
            />
            <span>Use Smart Contract (Direct on-chain minting)</span>
          </label>
          <p className="text-xs text-cyan-400/80 mt-1">
            When enabled, NFT will be minted directly on the blockchain using TrooNFT contract
          </p>
        </div>
      )}

      <form onSubmit={handleMint} className="space-y-6">
        {/* Name */}
        <div>
          <Label htmlFor="name" className="text-slate-300">
            Name
          </Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 bg-slate-900 border-slate-700 text-white"
            required
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-slate-300">
            Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="mt-1 bg-slate-900 border-slate-700 text-white h-32"
            required
          />
        </div>

        {/* Image URL */}
        <div>
          <Label htmlFor="image" className="text-slate-300">
            Image URL
          </Label>
          <Input
            id="image"
            type="url"
            value={formData.image}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            className="mt-1 bg-slate-900 border-slate-700 text-white"
            required
          />
        </div>

        {/* Chain */}
        <div>
          <Label htmlFor="chain" className="text-slate-300">
            Blockchain
          </Label>
          <Select value={formData.chain} onValueChange={(v) => setFormData({ ...formData, chain: v })}>
            <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xrpl">XRPL</SelectItem>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="polygon">Polygon</SelectItem>
              <SelectItem value="metallicus">Metallicus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Royalty */}
        <div>
          <Label htmlFor="royalty" className="text-slate-300">
            Royalty Percentage: {formData.royaltyPercentage}%
          </Label>
          <Input
            id="royalty"
            type="range"
            min="0"
            max="20"
            value={formData.royaltyPercentage}
            onChange={(e) => setFormData({ ...formData, royaltyPercentage: parseInt(e.target.value) })}
            className="mt-1"
          />
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-3">
          <Label className="text-slate-300">Visibility</Label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="rounded"
            />
            <span className="text-slate-300">{isVisible ? "Public" : "Hidden"}</span>
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={minting}
          className="w-full"
          style={{
            backgroundColor: "#06b6d4",
            color: "#000",
            border: `2px solid ${ELECTRIC_BLUE}`,
          }}
        >
          {minting ? "Minting..." : "Mint NFT"}
        </Button>
      </form>
    </Card>
  );
}

// Deploy NFT Component (similar to trust page)
function DeployNFT({ onDeploySuccess }: { onDeploySuccess: () => void }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<"ETH" | "POL" | "XRPL" | "SOL">("POL");
  const [isVisible, setIsVisible] = useState(true);
  const [collectionAddress, setCollectionAddress] = useState("");
  const [collectionSelection, setCollectionSelection] = useState("platform");
  const [collections, setCollections] = useState<Array<{ id: string; name: string; contractAddress: string | null }>>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  
  const minting = busy || isPending;
  const qtyClamped = (n: number) => (Number.isNaN(n) ? 1 : Math.min(Math.max(Math.floor(n), 1), MAX_QTY));
  const isCreatorCollectionAddress = (addr: string) =>
    collections.some((c) => String(c.contractAddress || "").toLowerCase() === addr.toLowerCase());
  const resolveCollectionAddress = () => {
    if (selectedNetwork === "POL") {
      if (collectionSelection === "platform") return "";
      if (collectionSelection === "custom") {
        const trimmed = collectionAddress.trim();
        return trimmed ? (trimmed as `0x${string}`) : "";
      }
      const selected = collectionSelection.trim();
      return selected ? (selected as `0x${string}`) : "";
    }
    const trimmed = collectionAddress.trim();
    return trimmed ? (trimmed as `0x${string}`) : "";
  };

  useEffect(() => {
    if (!address) {
      setCollections([]);
      return;
    }
    if (selectedNetwork !== "POL") {
      setCollections([]);
      return;
    }
    let active = true;
    setCollectionsLoading(true);
    fetch(`/api/nft-marketplace/collections?creator=${address}&chain=polygon`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j?.success && Array.isArray(j?.collections)) {
          setCollections(j.collections);
        } else {
          setCollections([]);
        }
      })
      .catch(() => setCollections([]))
      .finally(() => {
        if (active) setCollectionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [address, selectedNetwork]);

  useEffect(() => {
    if (selectedNetwork !== "POL") return;
    if (collectionSelection !== "platform") return;
    const first = collections.find((c) => c.contractAddress)?.contractAddress;
    if (first) {
      setCollectionSelection(first);
    }
  }, [collections, selectedNetwork, collectionSelection]);

  async function mintOnEvm(
    contractAddress: `0x${string}`,
    tokenUri: string,
    chain: "ETH" | "POL",
    quantity: number
  ) {
    if (!publicClient) throw new Error("Wallet client unavailable");
    const royaltyBps = 0;
    const targetChainId = chain === "ETH" ? 1 : 137;
    const collectionAddr = resolveCollectionAddress();
    const count = Math.max(1, Math.floor(quantity || 1));
    const uris = Array.from({ length: count }, () => tokenUri);

    if (collectionAddr) {
      try {
        if (count > 1) {
          await (writeContractAsync as any)({
            address: collectionAddr,
            abi: TROO_COLLECTION_ABI,
            functionName: "ownerMintBatchTo",
            args: [address, uris, royaltyBps],
            value: 0n,
            chainId: targetChainId,
          });
        } else {
          await (writeContractAsync as any)({
            address: collectionAddr,
            abi: TROO_COLLECTION_ABI,
            functionName: "ownerMintTo",
            args: [address, tokenUri, royaltyBps],
            value: 0n,
            chainId: targetChainId,
          });
        }
        return;
      } catch {}

      let mintPrice = 0n;
      try {
        mintPrice = (await publicClient.readContract({
          address: collectionAddr,
          abi: TROO_COLLECTION_ABI,
          functionName: "mintPrice",
        })) as bigint;
      } catch {}

      if (count > 1) {
        await (writeContractAsync as any)({
          address: collectionAddr,
          abi: TROO_COLLECTION_ABI,
          functionName: "mintBatchTo",
          args: [address, uris, royaltyBps],
          value: mintPrice * BigInt(count),
          chainId: targetChainId,
        });
      } else {
        await (writeContractAsync as any)({
          address: collectionAddr,
          abi: TROO_COLLECTION_ABI,
          functionName: "mintTo",
          args: [address, tokenUri, royaltyBps],
          value: mintPrice,
          chainId: targetChainId,
        });
      }
      return;
    }

    const mintingFee = (await publicClient.readContract({
      address: contractAddress,
      abi: TROO_NFT_ABI,
      functionName: "mintingFee",
    })) as bigint;

    if (count > 1) {
      await (writeContractAsync as any)({
        address: contractAddress,
        abi: TROO_NFT_ABI,
        functionName: "mintNFTBatch",
        args: [address, uris, royaltyBps],
        value: mintingFee * BigInt(count),
        chainId: targetChainId,
      });
    } else {
      await (writeContractAsync as any)({
        address: contractAddress,
        abi: TROO_NFT_ABI,
        functionName: "mintNFT",
        args: [address, tokenUri, royaltyBps],
        value: mintingFee,
        chainId: targetChainId,
      });
    }
  }

  async function onDeploy() {
    if (!file) {
      setError("Choose a media file.");
      return;
    }
    if (!name.trim()) {
      setError("Name your NFT.");
      return;
    }
    const quantity = qtyClamped(qty);

    // Network-specific validation and switching
    if (selectedNetwork === "ETH") {
      if (!EVM_NFT_ETHEREUM && !resolveCollectionAddress()) {
        setError("Missing ETH contract or collection address.");
        return;
      }
      if (!address) {
        setError("Connect an EVM wallet.");
        return;
      }
      try { 
        await switchChainAsync?.({ chainId: 1 }); 
      } catch (e) {
        setError("Please switch to Ethereum mainnet in your wallet.");
        return;
      }
      if (chainId !== 1) { 
        setError("Please switch to Ethereum mainnet in your wallet.");
        return;
      }
    } else if (selectedNetwork === "POL") {
      if (!EVM_NFT_POLYGON && !resolveCollectionAddress()) {
        setError("No collection address found. Deploy a collection first.");
        return;
      }
      const selectedCollection = resolveCollectionAddress();
      if (selectedCollection && !isCreatorCollectionAddress(selectedCollection)) {
        setError("Select a collection you created (sync collections if needed).");
        return;
      }
      if (!address) {
        setError("Connect an EVM wallet.");
        return;
      }
      try { 
        await switchChainAsync?.({ chainId: 137 }); 
      } catch (e) {
        setError("Please switch to Polygon in your wallet.");
        return;
      }
      if (chainId !== 137) { 
        setError("Please switch to Polygon in your wallet.");
        return;
      }
    } else if (selectedNetwork === "SOL") {
      setError("Solana minting is not enabled in this build yet.");
      return;
    } else if (selectedNetwork === "XRPL") {
      setError("XRPL NFT minting not yet implemented.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      
      const visibilityAttribute = { trait_type: "visibility", value: isVisible ? "public" : "hidden" };
      const uploadFile = await prepareUploadFile(file, "NFT image");
      const uploadForm = new FormData();
      uploadForm.append("file", uploadFile);
      uploadForm.append("name", name);
      uploadForm.append("description", desc);
      uploadForm.append("attributes", JSON.stringify([visibilityAttribute]));

      const uploadRes = await fetch("/api/nft-marketplace/upload", {
        method: "POST",
        body: uploadForm,
      });
      const uploadJson = await readJsonSafe(uploadRes);
      if (!uploadRes.ok || !uploadJson?.ok) {
        throw new Error(uploadJson?.error || "Failed to upload metadata to IPFS");
      }
      const metadataUri = uploadJson.metadataIpfsUrl as string;
      const displayImage = (uploadJson.imageGatewayUrl || uploadJson.imageIpfsUrl) as string;

      if (selectedNetwork === "ETH") {
        const baseTokenId = Date.now();
        const contractAddress = (resolveCollectionAddress() || EVM_NFT_ETHEREUM) as `0x${string}`;
        await mintOnEvm(contractAddress, metadataUri, "ETH", quantity);
        for (let i = 0; i < quantity; i++) {
        await fetch("/api/nft-marketplace/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenId: `${baseTokenId + i}`,
              name,
              description: desc,
              imageUrl: displayImage,
              chain: "ethereum",
              contractAddress,
              ownerAddress: address,
              creatorAddress: address,
              royaltyPercentage: 0,
              attributes: [visibilityAttribute],
              metadataUrl: metadataUri,
            }),
          }).catch(() => {});
        }
      } else if (selectedNetwork === "POL") {
        const baseTokenId = Date.now();
        const contractAddress = (resolveCollectionAddress() || EVM_NFT_POLYGON) as `0x${string}`;
        await mintOnEvm(contractAddress, metadataUri, "POL", quantity);
        for (let i = 0; i < quantity; i++) {
        await fetch("/api/nft-marketplace/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenId: `${baseTokenId + i}`,
              name,
              description: desc,
              imageUrl: displayImage,
              chain: "polygon",
              contractAddress,
              ownerAddress: address,
              creatorAddress: address,
              royaltyPercentage: 0,
              attributes: [visibilityAttribute],
              metadataUrl: metadataUri,
            }),
          }).catch(() => {});
        }
      } else if (selectedNetwork === "SOL") {
        setError("Solana NFT minting not yet implemented.");
        return;
      }

      setName(""); 
      setDesc(""); 
      setFile(null); 
      setQty(1); 
      setIsVisible(true);
      setCollectionAddress("");
      setCollectionSelection("platform");
      alert("Deploy succeeded!");
      onDeploySuccess();
    } catch (e) {
      console.error(e);
      const msg = (e as BaseError)?.shortMessage || (e as any)?.message || `${selectedNetwork} deploy failed`;
      setError(msg);
    } finally { 
      setBusy(false); 
    }
  }

  if (!isConnected) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-800/40 border-white/10 p-8">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">Please connect your wallet to deploy NFTs</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-slate-800/40 border-white/10 p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Deploy NFT</h2>
      <p className="text-slate-400 text-sm mb-6">Select network and deploy your NFT</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <Label className="text-slate-300">Network</Label>
          <Select 
            value={selectedNetwork} 
            onValueChange={(v) => setSelectedNetwork(v as "ETH" | "POL" | "XRPL" | "SOL")}
          >
            <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
              <SelectItem value="POL">Polygon (POL)</SelectItem>
              <SelectItem value="SOL">Solana (SOL)</SelectItem>
              <SelectItem value="XRPL">XRPL (XRPL)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-300">NFT Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cyber Hero #001"
            className="mt-1 bg-slate-900 border-slate-700 text-white"
          />
        </div>

        <div>
          <Label className="text-slate-300">Description (optional)</Label>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe your NFT"
            className="mt-1 bg-slate-900 border-slate-700 text-white h-24"
          />
        </div>

        <div>
          <Label className="text-slate-300">Media (jpeg, jpg, gif, mov, mp4, png, webp)</Label>
          <Input
            type="file"
            accept={ACCEPT_TYPES}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100"
          />
        </div>

        {selectedNetwork === "POL" ? (
          <div>
            <Label className="text-slate-300">Mint To</Label>
            <Select
              value={collectionSelection}
              onValueChange={(v) => setCollectionSelection(v)}
            >
              <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder={collectionsLoading ? "Loading..." : "Choose a collection"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">Platform collection</SelectItem>
                {collections
                  .filter((c) => c.contractAddress)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.contractAddress as string}>
                      {c.name}
                    </SelectItem>
                  ))}
                <SelectItem value="custom">Custom address…</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Choose one of your deployed collections or the platform default.
            </p>
            {collectionSelection === "custom" ? (
              <div className="mt-3">
                <Label className="text-slate-300">Custom Collection Address</Label>
                <Input
                  value={collectionAddress}
                  onChange={(e) => setCollectionAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            ) : null}
          </div>
        ) : (
          (selectedNetwork === "ETH") && (
            <div>
              <Label className="text-slate-300">Collection Contract (optional)</Label>
              <Input
                value={collectionAddress}
                onChange={(e) => setCollectionAddress(e.target.value)}
                placeholder="0x..."
                className="mt-1 bg-slate-900 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave empty to mint into the platform collection.
              </p>
            </div>
          )
        )}

        <div className="flex items-center gap-3">
          <Label className="text-slate-300">Visibility</Label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="accent-cyan-400"
            />
            <span className="text-slate-300">{isVisible ? "Public" : "Hidden"}</span>
          </label>
        </div>

        <div>
          <Label className="text-slate-300">Quantity (max {MAX_QTY.toLocaleString()})</Label>
          <Input
            type="number"
            min={1}
            max={MAX_QTY}
            step={1}
            value={qty}
            onChange={(e) => setQty(Math.min(Math.max(parseInt(e.target.value || "1"), 1), MAX_QTY))}
            className="mt-1 w-40 bg-slate-900 border-slate-700 text-white"
          />
        </div>

        <Button
          onClick={onDeploy}
          disabled={minting}
          className="w-full"
          style={{
            backgroundColor: "#06b6d4",
            color: "#000",
            border: `2px solid ${ELECTRIC_BLUE}`,
          }}
        >
          {minting ? "Deploying…" : `Deploy ${qty} NFT${qty > 1 ? "s" : ""} on ${selectedNetwork}`}
        </Button>
      </div>
    </Card>
  );
}

// Deploy Collection Component
function DeployCollection({ onDeploySuccess }: { onDeploySuccess: () => void }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  
  const [collectionData, setCollectionData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
    chain: "polygon" as "ethereum" | "polygon" | "metallicus" | "solana" | "xrpl",
    royaltyPercentage: 5,
    isPublic: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mintPrice, setMintPrice] = useState<string>("");
  const [collectionImageFile, setCollectionImageFile] = useState<File | null>(null);
  const [collectionImageUploading, setCollectionImageUploading] = useState(false);
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [lastDeployedCollection, setLastDeployedCollection] = useState<{
    contractAddress: string;
    creatorAddress: string;
  } | null>(null);
  const [batchItems, setBatchItems] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      imageUrl: string;
      file: File | null;
      quantity: number;
      isVisible: boolean;
    }>
  >([]);
  const [factoryFeeWei, setFactoryFeeWei] = useState<bigint>(() => {
    try {
      return BigInt(EVM_NFT_FACTORY_DEPLOY_FEE_WEI || "0");
    } catch {
      return 0n;
    }
  });

  useEffect(() => {
    if (!publicClient || !EVM_NFT_FACTORY_POLYGON) return;
    publicClient
      .readContract({
        address: EVM_NFT_FACTORY_POLYGON,
        abi: TROO_FACTORY_ABI,
        functionName: "deploymentFee",
      })
      .then((fee) => setFactoryFeeWei(fee as bigint))
      .catch(() => {});
  }, [publicClient]);

  const deploying = busy || isPending;
  const clampQty = (n: number) => {
    const safe = Number.isFinite(n) ? n : 1;
    return Math.min(Math.max(Math.floor(safe), 1), 10000);
  };
  const totalBatchMints = batchItems.reduce((sum, item) => sum + clampQty(item.quantity), 0);

  const handleDeployCollection = async () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet");
      return;
    }

    if (!collectionData.name.trim()) {
      setError("Collection name is required");
      return;
    }

    if (!collectionData.symbol.trim()) {
      setError("Collection symbol is required");
      return;
    }

      if (!collectionData.imageUrl.trim() && !collectionImageFile) {
      setError("Collection image URL or upload is required");
      return;
    }

      if (batchEnabled) {
        if (batchItems.length === 0) {
          setError("Add at least one NFT variant to batch deploy.");
          return;
        }
        if (batchItems.length > 60) {
          setError("Batch deploy supports up to 60 NFT variants.");
          return;
        }
        for (const item of batchItems) {
          if (!item.name.trim()) {
            setError("Each batch item needs a name.");
            return;
          }
          if (!item.description.trim()) {
            setError("Each batch item needs a description.");
            return;
          }
          if (!item.imageUrl.trim() && !item.file) {
            setError("Each batch item needs an image URL or upload.");
            return;
          }
        }
        if (totalBatchMints > 10000) {
          setError("Batch minting is capped at 10,000 total NFTs per deploy.");
          return;
        }
      }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      if (collectionData.chain !== "polygon") {
        setError("Creator collections are currently deployed on Polygon only.");
        return;
      }
      if (!EVM_NFT_FACTORY_POLYGON) {
        setError("Missing Polygon NFT factory address.");
        return;
      }
      try {
        await switchChainAsync?.({ chainId: 137 });
      } catch {
        setError("Please switch to Polygon in your wallet.");
        return;
      }
      if (chainId !== 137) {
        setError("Please switch to Polygon in your wallet.");
        return;
      }

      let mintPriceWei = 0n;
      try {
        mintPriceWei = mintPrice ? parseEther(mintPrice) : 0n;
      } catch {
        setError("Invalid mint price");
        return;
      }

      let resolvedImageUrl = collectionData.imageUrl.trim();
      if (!resolvedImageUrl && collectionImageFile) {
        setCollectionImageUploading(true);
        const uploadFile = await prepareUploadFile(collectionImageFile, "Collection image");
        const uploadForm = new FormData();
        uploadForm.append("file", uploadFile);
        uploadForm.append("name", collectionData.name || "Collection Image");
        uploadForm.append("description", collectionData.description || "");
        const uploadRes = await fetch("/api/nft-marketplace/upload", {
          method: "POST",
          body: uploadForm,
        });
        const uploadJson = await readJsonSafe(uploadRes);
        if (!uploadRes.ok || !uploadJson?.ok) {
          throw new Error(uploadJson?.error || "Failed to upload collection image");
        }
        resolvedImageUrl = (uploadJson.imageGatewayUrl || uploadJson.imageIpfsUrl) as string;
      }

      const royaltyBps = Math.round((collectionData.royaltyPercentage || 0) * 100);
      const txHash = await (writeContractAsync as any)({
        address: EVM_NFT_FACTORY_POLYGON,
        abi: TROO_FACTORY_ABI,
        functionName: "createCollection",
        args: [collectionData.name, collectionData.symbol, mintPriceWei, royaltyBps],
        value: factoryFeeWei,
        chainId: 137,
      });

      if (!publicClient) {
        throw new Error("Wallet client unavailable");
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      let deployedAddress = "";
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: TROO_FACTORY_ABI,
            data: log.data,
            topics: log.topics,
          }) as any;
          if (decoded?.eventName === "CollectionDeployed") {
            deployedAddress = decoded.args.collection as string;
            break;
          }
        } catch {}
      }
      if (!deployedAddress) {
        throw new Error("Collection deployed but address was not found in logs.");
      }

      // Create collection record in database
      const collectionResponse = await fetch("/api/nft-marketplace/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: collectionData.name,
          symbol: collectionData.symbol,
          description: collectionData.description,
          chain: collectionData.chain,
          creatorAddress: address,
          royaltyPercentage: collectionData.royaltyPercentage,
          imageUrl: resolvedImageUrl,
          contractAddress: deployedAddress,
          isPublic: collectionData.isPublic,
        }),
      });

      const collectionResult = await readJsonSafe(collectionResponse);
      if (!collectionResult.success) {
        throw new Error(collectionResult.error || "Failed to create collection");
      }

      if (batchEnabled) {
        const collectionAddress = deployedAddress as `0x${string}`;
        const visibilityFor = (isVisible: boolean) => [{ trait_type: "visibility", value: isVisible ? "public" : "hidden" }];
        const mintedUris: string[] = [];
        const mintedItems: Array<{ metadataUri: string; imageUrl: string; name: string; description: string; quantity: number }> = [];

        for (const item of batchItems) {
          const uploadForm = new FormData();
          if (item.file) uploadForm.append("file", item.file);
          if (!item.file && item.imageUrl) uploadForm.append("imageUrl", item.imageUrl);
          uploadForm.append("name", item.name);
          uploadForm.append("description", item.description);
          uploadForm.append("attributes", JSON.stringify(visibilityFor(item.isVisible)));

          const uploadRes = await fetch("/api/nft-marketplace/upload", {
            method: "POST",
            body: uploadForm,
          });
          const uploadJson = await readJsonSafe(uploadRes);
          if (!uploadRes.ok || !uploadJson?.ok) {
            throw new Error(uploadJson?.error || `Failed to upload metadata for ${item.name}`);
          }

          const metadataUri = uploadJson.metadataIpfsUrl as string;
          const imageUrl = (uploadJson.imageGatewayUrl || uploadJson.imageIpfsUrl) as string;
          const count = clampQty(item.quantity);
          mintedItems.push({ metadataUri, imageUrl, name: item.name, description: item.description, quantity: count });
          for (let i = 0; i < count; i += 1) mintedUris.push(metadataUri);
        }

        const targetChainId = 137;
        const chunkSize = 50;
        for (let i = 0; i < mintedUris.length; i += chunkSize) {
          const chunk = mintedUris.slice(i, i + chunkSize);
          try {
            await (writeContractAsync as any)({
              address: collectionAddress,
              abi: TROO_COLLECTION_ABI,
              functionName: "ownerMintBatchTo",
              args: [address, chunk, 0],
              value: 0n,
              chainId: targetChainId,
            });
          } catch {
            const mintPrice = (await publicClient!.readContract({
              address: collectionAddress,
              abi: TROO_COLLECTION_ABI,
              functionName: "mintPrice",
            })) as bigint;
            await (writeContractAsync as any)({
              address: collectionAddress,
              abi: TROO_COLLECTION_ABI,
              functionName: "mintBatchTo",
              args: [address, chunk, 0],
              value: mintPrice * BigInt(chunk.length),
              chainId: targetChainId,
            });
          }
        }

        let tokenCounter = Date.now();
        for (const minted of mintedItems) {
          for (let i = 0; i < minted.quantity; i += 1) {
            await fetch("/api/nft-marketplace/record", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokenId: `${tokenCounter++}`,
                name: minted.name,
                description: minted.description,
                imageUrl: minted.imageUrl,
                chain: "polygon",
                contractAddress: collectionAddress,
                ownerAddress: address,
                creatorAddress: address,
                royaltyPercentage: 0,
                attributes: visibilityFor(true),
                metadataUrl: minted.metadataUri,
                collectionId: collectionResult.collectionId,
              }),
            }).catch(() => {});
          }
        }
      }

      setSuccess(`Collection deployed at ${deployedAddress}.`);
      setLastDeployedCollection({ contractAddress: deployedAddress, creatorAddress: address });

      // Reset form
      setCollectionData({
        name: "",
        symbol: "",
        description: "",
        imageUrl: "",
        chain: "polygon",
        royaltyPercentage: 5,
        isPublic: true,
      });
      setMintPrice("");
      setCollectionImageFile(null);
      setBatchItems([]);
      setBatchEnabled(false);
      onDeploySuccess();
    } catch (err: any) {
      console.error("Collection deployment error:", err);
      setError(err.message || "Failed to deploy collection");
    } finally {
      setCollectionImageUploading(false);
      setBusy(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="max-w-4xl mx-auto bg-slate-800/40 border-white/10 p-8">
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-4">Please connect your wallet to deploy collections</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto bg-slate-800/40 border-white/10 p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Deploy NFT Collection</h2>
      <p className="text-slate-400 text-sm mb-2">
        Create a creator-owned collection on Polygon using the factory contract.
      </p>
      {factoryFeeWei > 0n ? (
        <p className="text-xs text-slate-500 mb-6">
          Factory deploy fee: {formatEther(factoryFeeWei)} MATIC
        </p>
      ) : (
        <p className="text-xs text-slate-500 mb-6">Factory deploy fee: 0 MATIC</p>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {success && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>
      )}
      {lastDeployedCollection ? (
        <div className="mb-6 rounded-md border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs text-cyan-200">
          <div>
            Deployer wallet: {lastDeployedCollection.creatorAddress.slice(0, 6)}…{lastDeployedCollection.creatorAddress.slice(-4)}
          </div>
          <div className="mt-1">
            Contract: {lastDeployedCollection.contractAddress}
          </div>
          <div className="mt-2 text-cyan-100">
            This collection will appear under the deployer wallet on OpenSea once indexed.
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {/* Collection Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Collection Name *</Label>
            <Input
              value={collectionData.name}
              onChange={(e) => setCollectionData({ ...collectionData, name: e.target.value })}
              placeholder="My Awesome Collection"
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              required
            />
          </div>

          <div>
            <Label className="text-slate-300">Collection Symbol *</Label>
            <Input
              value={collectionData.symbol}
              onChange={(e) => setCollectionData({ ...collectionData, symbol: e.target.value.toUpperCase().slice(0, 10) })}
              placeholder="MAC"
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              maxLength={10}
              required
            />
          </div>
        </div>

        <div>
          <Label className="text-slate-300">Description</Label>
          <Textarea
            value={collectionData.description}
            onChange={(e) => setCollectionData({ ...collectionData, description: e.target.value })}
            placeholder="Describe your collection..."
            className="mt-1 bg-slate-900 border-slate-700 text-white h-24"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Collection Image *</Label>
            <Input
              type="url"
              value={collectionData.imageUrl}
              onChange={(e) => setCollectionData({ ...collectionData, imageUrl: e.target.value })}
              placeholder="https://... or upload below"
              className="mt-1 bg-slate-900 border-slate-700 text-white"
            />
            <div className="mt-2">
              <Input
                type="file"
                accept={ACCEPT_TYPES}
                onChange={(e) => setCollectionImageFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Paste a URL or upload a file. Uploads are stored on IPFS via Pinata.
            </p>
          </div>

          <div>
            <Label className="text-slate-300">Blockchain</Label>
            <Select 
              value={collectionData.chain} 
              onValueChange={(v) => setCollectionData({ ...collectionData, chain: v as any })}
            >
              <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polygon">Polygon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-slate-300">Visibility</Label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={collectionData.isPublic}
              onChange={(e) => setCollectionData({ ...collectionData, isPublic: e.target.checked })}
              className="accent-cyan-400"
            />
            <span className="text-slate-300">{collectionData.isPublic ? "Public Library" : "Private"}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Default Royalty: {collectionData.royaltyPercentage}%</Label>
            <Input
              type="range"
              min="0"
              max="20"
              value={collectionData.royaltyPercentage}
              onChange={(e) => setCollectionData({ ...collectionData, royaltyPercentage: parseInt(e.target.value) })}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-slate-300">Mint Price (MATIC)</Label>
            <Input
              type="text"
              inputMode="decimal"
              pattern="^[0-9]+(\\.[0-9]{0,18})?$"
              placeholder="0.00"
              value={mintPrice}
              onChange={(e) => setMintPrice(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700 text-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 text-sm text-slate-400">
          After deploy, mint NFTs from the Mint tab using the collection contract address.
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Batch Create NFTs</div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={batchEnabled}
                onChange={(e) => setBatchEnabled(e.target.checked)}
                className="accent-cyan-400"
              />
              Enable
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Create up to 60 NFT variants during deploy. Each variant can mint up to 10,000 editions.
          </p>

          {batchEnabled ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Variants: {batchItems.length} / 60 • Total editions: {totalBatchMints}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (batchItems.length >= 60) return;
                    setBatchItems((prev) => [
                      ...prev,
                      {
                        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        name: "",
                        description: "",
                        imageUrl: "",
                        file: null,
                        quantity: 1,
                        isVisible: true,
                      },
                    ]);
                  }}
                >
                  Add Variant
                </Button>
              </div>

              {batchItems.map((item, idx) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Variant #{idx + 1}</div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBatchItems((prev) => prev.filter((v) => v.id !== item.id))}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300">Name *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          setBatchItems((prev) =>
                            prev.map((v) => (v.id === item.id ? { ...v, name: e.target.value } : v))
                          )
                        }
                        className="mt-1 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Quantity *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={item.quantity}
                        onChange={(e) =>
                          setBatchItems((prev) =>
                            prev.map((v) =>
                              v.id === item.id ? { ...v, quantity: clampQty(Number(e.target.value) || 1) } : v
                            )
                          )
                        }
                        className="mt-1 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Description *</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) =>
                        setBatchItems((prev) =>
                          prev.map((v) => (v.id === item.id ? { ...v, description: e.target.value } : v))
                        )
                      }
                      className="mt-1 bg-slate-900 border-slate-700 text-white h-24"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300">Image URL</Label>
                      <Input
                        type="url"
                        value={item.imageUrl}
                        onChange={(e) =>
                          setBatchItems((prev) =>
                            prev.map((v) => (v.id === item.id ? { ...v, imageUrl: e.target.value } : v))
                          )
                        }
                        placeholder="https://... or upload below"
                        className="mt-1 bg-slate-900 border-slate-700 text-white"
                      />
                      <Input
                        type="file"
                        accept={ACCEPT_TYPES}
                        onChange={(e) =>
                          setBatchItems((prev) =>
                            prev.map((v) =>
                              v.id === item.id ? { ...v, file: e.target.files?.[0] || null } : v
                            )
                          )
                        }
                        className="mt-2 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100"
                      />
                      <p className="text-xs text-slate-500 mt-1">Provide URL or upload a file.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-slate-300">Visibility</Label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isVisible}
                          onChange={(e) =>
                            setBatchItems((prev) =>
                              prev.map((v) => (v.id === item.id ? { ...v, isVisible: e.target.checked } : v))
                            )
                          }
                          className="accent-cyan-400"
                        />
                        <span className="text-slate-300">{item.isVisible ? "Public" : "Hidden"}</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Button
          onClick={handleDeployCollection}
          disabled={deploying || collectionImageUploading}
          className="w-full"
          style={{
            backgroundColor: "#06b6d4",
            color: "#000",
            border: `2px solid ${ELECTRIC_BLUE}`,
          }}
        >
          {deploying || collectionImageUploading ? "Deploying Collection..." : "Deploy Collection"}
        </Button>
      </div>
    </Card>
  );
}
