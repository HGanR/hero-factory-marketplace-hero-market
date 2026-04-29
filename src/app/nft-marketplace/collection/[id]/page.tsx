"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileWalletButton from "@/components/MobileWalletButton";
import { useAccount } from "wagmi";

type CollectionRow = {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  imageUrl: string | null;
  chain: string;
  contractAddress: string | null;
};

type NftRow = {
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
  contractAddress?: string | null;
};

export default function CollectionDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { isConnected, address } = useAccount();
  const [collection, setCollection] = useState<CollectionRow | null>(null);
  const [nfts, setNfts] = useState<NftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"items" | "offers" | "holders" | "traits" | "activity">("items");
  const [statusFilter, setStatusFilter] = useState<"all" | "listed" | "owned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_low" | "price_high" | "name">("newest");

  const normalizedAddress = address?.toLowerCase() || "";
  const floorPrice = useMemo(() => {
    const prices = nfts
      .filter((n) => n.isListed && typeof n.listPrice === "number" && n.listPrice > 0)
      .map((n) => Number(n.listPrice));
    if (!prices.length) return null;
    return Math.min(...prices);
  }, [nfts]);

  const filteredNfts = useMemo(() => {
    let list = [...nfts];
    if (statusFilter === "listed") {
      list = list.filter((n) => n.isListed);
    } else if (statusFilter === "owned" && normalizedAddress) {
      list = list.filter((n) => n.ownerAddress?.toLowerCase() === normalizedAddress);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (n) => n.name?.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "price_low") {
      list.sort((a, b) => (Number(a.listPrice || 0) || 0) - (Number(b.listPrice || 0) || 0));
    } else if (sortBy === "price_high") {
      list.sort((a, b) => (Number(b.listPrice || 0) || 0) - (Number(a.listPrice || 0) || 0));
    }
    return list;
  }, [nfts, statusFilter, normalizedAddress, searchQuery, sortBy]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/nft-marketplace/collection/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (!j?.ok) {
          setError(j?.error || "Failed to load collection");
          return;
        }
        setCollection(j.collection);
        setNfts(Array.isArray(j.nfts) ? j.nfts : []);
      })
      .catch((e) => {
        if (active) setError(e?.message || "Failed to load collection");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/nft-marketplace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Marketplace
              </Link>
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {collection?.name || "Collection"}
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-slate-300">Loading collection…</div>
        ) : error ? (
          <div className="text-amber-200">{error}</div>
        ) : (
          <>
            <div className="mb-8 rounded-2xl border border-white/10 bg-slate-800/40 p-6">
              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="h-40 w-40 rounded-xl overflow-hidden border border-white/10 bg-slate-900/60 shrink-0">
                  {collection?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={collection.imageUrl} alt={collection.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-slate-400 text-xs">No image</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-bold">{collection?.name}</h2>
                    {collection?.chain ? (
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {collection.chain.toUpperCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-slate-300 mt-3 max-w-3xl">
                    {collection?.description || "No description provided."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{nfts.length} items</span>
                    <span>•</span>
                    <span>Floor: {floorPrice ? `${floorPrice} POL` : "—"}</span>
                    <span>•</span>
                    <span>Top offer: —</span>
                    <span>•</span>
                    <span>Total volume: 0.00 POL</span>
                  </div>
                  {collection?.contractAddress ? (
                    <div className="mt-3 text-xs text-slate-400">
                      Contract: {collection.contractAddress}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
              <aside className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                <div className="mb-4 text-sm font-semibold text-slate-200">Status</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={statusFilter === "all" ? "default" : "outline"}
                    onClick={() => setStatusFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "listed" ? "default" : "outline"}
                    onClick={() => setStatusFilter("listed")}
                  >
                    Listed
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === "owned" ? "default" : "outline"}
                    onClick={() => setStatusFilter("owned")}
                    disabled={!normalizedAddress}
                  >
                    Owned by you
                  </Button>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-sm font-semibold text-slate-200">
                  Rarity
                </div>
                <div className="mt-2 text-xs text-slate-400">Filters coming soon</div>

                <div className="mt-6 border-t border-white/10 pt-4 text-sm font-semibold text-slate-200">
                  Price
                </div>
                <div className="mt-2 text-xs text-slate-400">Set price range (coming soon)</div>

                <div className="mt-6 border-t border-white/10 pt-4 text-sm font-semibold text-slate-200">
                  Traits
                </div>
                <div className="mt-2 text-xs text-slate-400">Trait filters (coming soon)</div>
              </aside>

              <section>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {(["items", "offers", "holders", "traits", "activity"] as const).map((tab) => (
                    <Button
                      key={tab}
                      variant={activeTab === tab ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Button>
                  ))}
                </div>

                {activeTab !== "items" ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-300">
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view coming soon.
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[240px]">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search by item or trait"
                          className="bg-slate-900 border-slate-700 text-white"
                        />
                      </div>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                        <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="price_low">Price low to high</SelectItem>
                          <SelectItem value="price_high">Price high to low</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {nfts.length === 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <Card key={idx} className="bg-slate-800/40 border-white/10 overflow-hidden">
                            <div className="aspect-square bg-slate-900/60 grid place-items-center text-slate-500 text-xs">
                              Collection items appear here
                            </div>
                            <CardContent className="p-4">
                              <div className="h-4 w-2/3 rounded bg-slate-700/60" />
                              <div className="mt-2 h-3 w-1/3 rounded bg-slate-700/40" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : filteredNfts.length === 0 ? (
                      <div className="text-slate-400">No items match the current filters.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredNfts.map((nft) => (
                          <Card key={nft.id} className="bg-slate-800/40 border-white/10 overflow-hidden">
                            <div className="aspect-square bg-slate-900/60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={nft.imageUrl} alt={nft.name} className="h-full w-full object-cover" />
                            </div>
                            <CardContent className="p-4">
                              <div className="font-semibold truncate">{nft.name}</div>
                              <div className="text-xs text-slate-400 truncate">Token #{nft.tokenId}</div>
                              <div className="mt-3 flex gap-2">
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/nft-marketplace/${nft.id}`}>View Details</Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
