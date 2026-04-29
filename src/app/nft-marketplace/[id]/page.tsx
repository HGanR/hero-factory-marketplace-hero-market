"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";

const ELECTRIC_BLUE = "#00D1FF";

interface NFTDetail {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: string;
  contractAddress: string;
  ownerAddress: string;
  creatorAddress: string;
  isListed: boolean;
  listPrice?: number;
  listCurrency?: string;
  listingId?: string;
  royaltyPercentage: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export default function NFTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const id = (params?.id as string) || "";
  
  if (!id) {
    return <div>NFT ID not found</div>;
  }

  const [nft, setNft] = useState<NFTDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showListModal, setShowListModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<"buy" | "sell">("buy");
  const [activeDetailTab, setActiveDetailTab] = useState<"details" | "orders" | "activity">("details");

  useEffect(() => {
    if (id) {
      fetchNFTDetails();
    }
  }, [id]);

  const fetchNFTDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nft-marketplace/nft/${id}`);
      if (response.ok) {
        const data = await response.json();
        setNft(data.nft);
      }
    } catch (error) {
      console.error("Error fetching NFT details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">NFT Not Found</h2>
          <Button asChild>
            <Link href="/nft-marketplace">Back to Marketplace</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = isConnected && address?.toLowerCase() === nft.ownerAddress.toLowerCase();
  const isCreator = isConnected && address?.toLowerCase() === nft.creatorAddress.toLowerCase();
  const tokenStandard = "ERC1155";
  const itemFloor = nft.isListed && nft.listPrice ? `${nft.listPrice} ${nft.listCurrency}` : "—";
  const thumbnails = useMemo(() => [nft.imageUrl, nft.imageUrl, nft.imageUrl, nft.imageUrl], [nft.imageUrl]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Button variant="outline" size="sm" asChild className="mb-6">
          <Link href="/nft-marketplace">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8">
          <div>
            <div className="mb-3 flex gap-2">
              {thumbnails.map((thumb, idx) => (
                <div key={idx} className="h-14 w-14 rounded-lg border border-white/10 bg-slate-800 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb || "https://via.placeholder.com/80"} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <Card className="bg-slate-800/40 border-white/10 p-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-700/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nft.imageUrl || "https://via.placeholder.com/800"} alt={nft.name} className="w-full h-full object-cover" />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">{nft.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span className="text-slate-200">Collection</span>
                <span>•</span>
                <span className="font-mono">
                  {nft.contractAddress ? `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}` : "—"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-200">{tokenStandard}</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-200">{nft.chain.toUpperCase()}</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-200">Token #{nft.tokenId}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 text-xs text-slate-400">
              <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="uppercase">Top Offer</div>
                <div className="mt-1 text-slate-200">—</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="uppercase">Collection Floor</div>
                <div className="mt-1 text-slate-200">—</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="uppercase">Item Floor</div>
                <div className="mt-1 text-slate-200">{itemFloor}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="uppercase">Total Supply</div>
                <div className="mt-1 text-slate-200">—</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div className="uppercase">Last Sale</div>
                <div className="mt-1 text-slate-200">—</div>
              </div>
            </div>

            <Card className="bg-slate-800/40 border-white/10 p-5 space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={activeActionTab === "buy" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveActionTab("buy")}
                >
                  Buy
                </Button>
                <Button
                  variant={activeActionTab === "sell" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveActionTab("sell")}
                  disabled={!isOwner}
                >
                  Sell
                </Button>
              </div>

              {activeActionTab === "buy" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs uppercase text-slate-400">Price</div>
                    <div className="text-lg font-semibold text-slate-100">
                      {nft.isListed && nft.listPrice ? `${nft.listPrice} ${nft.listCurrency}` : "Not listed"}
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowBuyModal(true)}
                    disabled={!nft.isListed || isOwner}
                    className="min-w-[180px]"
                    style={{
                      backgroundColor: "#06b6d4",
                      color: "#000",
                      border: `2px solid ${ELECTRIC_BLUE}`,
                    }}
                  >
                    {nft.isListed ? "Buy now" : "Not for sale"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setShowListModal(true)}
                    disabled={!isOwner}
                    className="min-w-[180px]"
                    style={{
                      backgroundColor: "#06b6d4",
                      color: "#000",
                      border: `2px solid ${ELECTRIC_BLUE}`,
                    }}
                  >
                    List 1 for sale
                  </Button>
                  {isCreator && (
                    <Button variant="outline" onClick={() => setShowTransferModal(true)} className="min-w-[140px]">
                      Send
                    </Button>
                  )}
                  {isCreator && (
                    <Button asChild variant="outline" className="min-w-[140px]">
                      <Link href="/nft-marketplace">Mint More</Link>
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <div className="flex gap-3 border-b border-white/10 pb-2 text-sm">
              {(["details", "orders", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                  className={`uppercase tracking-wide ${activeDetailTab === tab ? "text-white" : "text-slate-400"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeDetailTab === "details" && (
              <Card className="bg-slate-800/40 border-white/10 p-6 space-y-4">
                <p className="text-slate-300">{nft.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Token ID</p>
                    <p className="text-white font-mono text-sm">{nft.tokenId}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Royalty</p>
                    <p className="text-white">{nft.royaltyPercentage}%</p>
                  </div>
                  {nft.contractAddress && (
                    <div className="col-span-2">
                      <p className="text-slate-400 text-xs">Contract Address</p>
                      <p className="text-white font-mono text-xs break-all">{nft.contractAddress}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">Owner</p>
                    <p className="text-white font-mono text-xs break-all">{nft.ownerAddress}</p>
                  </div>
                </div>
                {nft.attributes && nft.attributes.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {nft.attributes.map((attr, index) => (
                      <div key={index} className="bg-slate-900/50 rounded-lg p-3 border border-cyan-500/10">
                        <p className="text-slate-400 text-xs mb-1">{attr.trait_type}</p>
                        <p className="text-white font-semibold">{String(attr.value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {activeDetailTab !== "details" && (
              <Card className="bg-slate-800/40 border-white/10 p-6 text-slate-300 text-sm">
                {activeDetailTab === "orders" ? "Orders will appear here." : "Activity will appear here."}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* List Modal */}
      {showListModal && nft && (
        <ListNFTModal
          nft={nft}
          onClose={() => setShowListModal(false)}
          onSuccess={() => {
            setShowListModal(false);
            fetchNFTDetails();
          }}
        />
      )}

      {/* Buy Modal */}
      {showBuyModal && nft && (
        <BuyNFTModal
          nft={nft}
          onClose={() => setShowBuyModal(false)}
          onSuccess={() => {
            setShowBuyModal(false);
            router.push("/nft-marketplace");
          }}
        />
      )}

      {showTransferModal && nft && (
        <TransferNFTModal
          nft={nft}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
            fetchNFTDetails();
          }}
        />
      )}
    </div>
  );
}

// List NFT Modal
function ListNFTModal({
  nft,
  onClose,
  onSuccess,
}: {
  nft: NFTDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("XRP");
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleList = async () => {
    if (!price || parseFloat(price) <= 0) {
      setError("Please enter a valid price");
      return;
    }

    setListing(true);
    setError(null);
    try {
      const response = await fetch("/api/nft-marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftId: nft.id,
          price: parseFloat(price),
          currency,
          listingType: "fixed",
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || "Failed to list NFT");
      }
    } catch (error) {
      console.error("Error listing NFT:", error);
      setError("Failed to list NFT");
    } finally {
      setListing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>List NFT for Sale</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="list-price" className="text-slate-300">
              Price
            </Label>
            <Input
              id="list-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <Label htmlFor="list-currency" className="text-slate-300">
              Currency
            </Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-1 bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XRP">XRP</SelectItem>
                <SelectItem value="SOL">SOL</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="MATIC">MATIC</SelectItem>
                <SelectItem value="USDC">USDC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleList}
            disabled={listing || !price}
            className="flex-1"
            style={{
              backgroundColor: "#06b6d4",
              color: "#000",
              border: `2px solid ${ELECTRIC_BLUE}`,
            }}
          >
            {listing ? "Listing..." : "List NFT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Buy NFT Modal
function BuyNFTModal({
  nft,
  onClose,
  onSuccess,
}: {
  nft: NFTDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");

  const handleBuy = async () => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    if (!txHash) {
      setError("Please provide transaction hash");
      return;
    }

    setBuying(true);
    setError(null);
    try {
      const response = await fetch("/api/nft-marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: nft.listingId,
          buyerAddress: address,
          txHash,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || "Failed to purchase NFT");
      }
    } catch (error) {
      console.error("Error buying NFT:", error);
      setError("Failed to purchase NFT");
    } finally {
      setBuying(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase NFT</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="bg-slate-900/50 rounded-lg p-6 mb-6">
          <p className="text-slate-400 text-sm mb-2">You will pay</p>
          <p className="text-3xl font-bold text-cyan-400">
            {nft.listPrice} {nft.listCurrency}
          </p>
        </div>

        <div>
          <Label htmlFor="tx-hash" className="text-slate-300">
            Transaction Hash
          </Label>
          <Input
            id="tx-hash"
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="mt-1 bg-slate-900 border-slate-700 text-white"
            placeholder="0x..."
          />
          <p className="text-xs text-slate-400 mt-1">Enter the transaction hash from your wallet</p>
        </div>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleBuy}
            disabled={buying || !txHash}
            className="flex-1"
            style={{
              backgroundColor: "#06b6d4",
              color: "#000",
              border: `2px solid ${ELECTRIC_BLUE}`,
            }}
          >
            {buying ? "Processing..." : "Confirm Purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransferNFTModal({
  nft,
  onClose,
  onSuccess,
}: {
  nft: NFTDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }
    if (!recipient.trim()) {
      setError("Enter a recipient address");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/nft-marketplace/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftId: nft.id,
          recipientAddress: recipient.trim(),
          senderAddress: address,
          txHash: txHash.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        onSuccess();
      } else {
        setError(data?.error?.message || data?.error || "Transfer failed");
      }
    } catch (err) {
      console.error("Transfer NFT error:", err);
      setError("Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Send NFT</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="transfer-recipient" className="text-slate-300">
              Recipient Address
            </Label>
            <Input
              id="transfer-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              placeholder="0x..."
            />
          </div>
          <div>
            <Label htmlFor="transfer-tx" className="text-slate-300">
              Transaction Hash (optional)
            </Label>
            <Input
              id="transfer-tx"
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700 text-white"
              placeholder="0x..."
            />
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={submitting || !recipient.trim()}
            className="flex-1"
            style={{
              backgroundColor: "#06b6d4",
              color: "#000",
              border: `2px solid ${ELECTRIC_BLUE}`,
            }}
          >
            {submitting ? "Sending..." : "Send NFT"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
