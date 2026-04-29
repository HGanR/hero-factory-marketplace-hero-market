"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import MobileWalletButton from "@/components/MobileWalletButton";
import { useAccount } from "wagmi";

type CollectionInfo = {
  name: string;
  description: string;
  imageUrl: string;
  bannerImageUrl: string;
  chain: string;
  externalUrl?: string;
  openseaUrl?: string;
  slug: string;
};

type CollectionNft = {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  chain: string;
  contractAddress: string;
  openseaUrl?: string;
  tokenStandard?: string;
};

export default function CollectionPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const { isConnected, address } = useAccount();
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [nfts, setNfts] = useState<CollectionNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/opensea/collection?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (!j?.ok) {
          setError(j?.error?.message || "Failed to load collection");
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
  }, [slug]);

  const heroTitle = useMemo(() => collection?.name || slug, [collection, slug]);

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
              {heroTitle}
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
            <Card className="bg-slate-800/40 border-white/10 p-6 mb-8">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="h-40 w-40 rounded-xl overflow-hidden border border-white/10 bg-slate-900/60 shrink-0">
                  {collection?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={collection.imageUrl} alt={collection.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-slate-400 text-xs">No image</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold">{collection?.name}</h2>
                    {collection?.chain ? (
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {collection.chain.toUpperCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-slate-300 mt-2 max-w-2xl">
                    {collection?.description || "No description provided."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {collection?.openseaUrl ? (
                      <Button asChild variant="outline">
                        <a href={collection.openseaUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View on OpenSea
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {nfts.length === 0 ? (
                <div className="text-slate-400">No items found in this collection.</div>
              ) : (
                nfts.map((nft) => (
                  <Card key={nft.id} className="bg-slate-800/40 border-white/10 overflow-hidden">
                    <div className="aspect-square bg-slate-900/60">
                      {nft.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={nft.imageUrl} alt={nft.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-slate-500 text-xs">No image</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="font-semibold truncate">{nft.name}</div>
                      <div className="text-xs text-slate-400 truncate">Token #{nft.tokenId}</div>
                      <div className="mt-3 flex gap-2">
                        {nft.openseaUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={nft.openseaUrl} target="_blank" rel="noreferrer">
                              View on OpenSea
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
