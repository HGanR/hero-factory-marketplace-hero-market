"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import {
  loadStarFleetEntities,
  type StarFleetBlockchain,
  type StarFleetEntity,
} from "@/lib/starfleet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MintedToken = {
  id: string;
  entityId: string;
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  blockchain: StarFleetBlockchain;
  contractAddress: string;
  deploymentTxHash: string;
  createdAt: string;
};

const TOKENS_KEY = "starfleet_minted_tokens_v1";

function loadTokens(): MintedToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MintedToken[]) : [];
  } catch {
    return [];
  }
}

function saveTokens(tokens: MintedToken[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function mockEvmAddress() {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex}`;
}

function mockTxHash() {
  const hex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${hex}`;
}

const explorerBase: Record<StarFleetBlockchain, string> = {
  polygon: "https://polygonscan.com",
  ethereum: "https://etherscan.io",
  base: "https://basescan.org",
  xrp: "https://livenet.xrpl.org",
};

export default function StarFleetTokenMintingPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<StarFleetEntity[]>([]);
  const [entityId, setEntityId] = useState("");

  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [totalSupply, setTotalSupply] = useState("");
  const [blockchain, setBlockchain] = useState<StarFleetBlockchain>("polygon");
  const [ownerAddress, setOwnerAddress] = useState("");

  const [busy, setBusy] = useState(false);
  const [tokens, setTokens] = useState<MintedToken[]>([]);

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const e = loadStarFleetEntities();
    setEntities(e);
    if (!entityId && e[0]?.id) setEntityId(e[0].id);
    setTokens(loadTokens());
  }, [entityId]);

  const entityTokens = useMemo(() => {
    if (!entityId) return [];
    return tokens.filter((t) => t.entityId === entityId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [entityId, tokens]);

  function mint() {
    if (!entityId) return;
    if (!tokenName.trim() || !tokenSymbol.trim() || !totalSupply.trim()) return;
    if (blockchain !== "xrp" && !ownerAddress.trim()) return;

    setBusy(true);
    try {
      const next: MintedToken = {
        id: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        entityId,
        tokenName: tokenName.trim(),
        tokenSymbol: tokenSymbol.trim().toUpperCase(),
        totalSupply: totalSupply.trim(),
        blockchain,
        contractAddress: blockchain === "xrp" ? `r${Math.random().toString(36).slice(2, 28)}` : mockEvmAddress(),
        deploymentTxHash: mockTxHash(),
        createdAt: new Date().toISOString(),
      };
      const updated = [next, ...tokens];
      setTokens(updated);
      saveTokens(updated);
      setTokenName("");
      setTokenSymbol("");
      setTotalSupply("");
      setOwnerAddress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="h-6 w-6 text-yellow-300" />
              Token Minting (Demo)
            </h1>
            <p className="text-sm text-slate-300">Mock deploy a token for an entity to preview flows</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/star-fleet/plugins" className="text-slate-300 hover:text-white underline">
              Back to Plugins
            </Link>
            <Link href="/star-fleet" className="text-slate-300 hover:text-white underline">
              Star Fleet Home
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle>Select Entity</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger className="max-w-xl">
                <SelectValue placeholder={entities.length ? "Select an entity..." : "Create an entity first"} />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.jurisdiction})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Token Name</Label>
                <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="e.g., Acme Token" />
              </div>
              <div className="space-y-2">
                <Label>Token Symbol</Label>
                <Input
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., ACME"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Total Supply</Label>
                <Input value={totalSupply} onChange={(e) => setTotalSupply(e.target.value)} placeholder="e.g., 1000000" />
              </div>
              <div className="space-y-2">
                <Label>Blockchain</Label>
                <Select value={blockchain} onValueChange={(v) => setBlockchain(v as StarFleetBlockchain)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="xrp">XRP Ledger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {blockchain !== "xrp" ? (
              <div className="space-y-2">
                <Label>Owner Wallet Address</Label>
                <Input value={ownerAddress} onChange={(e) => setOwnerAddress(e.target.value)} placeholder="0x..." />
              </div>
            ) : null}

            <Button
              onClick={mint}
              disabled={
                busy ||
                !entityId ||
                !tokenName.trim() ||
                !tokenSymbol.trim() ||
                !totalSupply.trim() ||
                (blockchain !== "xrp" && !ownerAddress.trim())
              }
              className="w-full gap-2"
              size="lg"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Minting…
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" />
                  Mint Token (Demo)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {entityId ? (
          <Card>
            <CardHeader>
              <CardTitle>Minted Tokens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {entityTokens.length === 0 ? (
                <div className="text-sm text-slate-300">No tokens minted for this entity yet.</div>
              ) : (
                entityTokens.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold break-words">
                        {t.tokenName}{" "}
                        <span className="text-xs text-slate-300 border border-slate-700 rounded-full px-2 py-0.5 ml-2">
                          {t.tokenSymbol}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Supply: {Number(t.totalSupply || 0).toLocaleString()} • {t.blockchain}
                      </div>
                      <div className="mt-2 text-xs text-slate-300 font-mono break-all">
                        {t.contractAddress}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full bg-green-600/20 border border-green-600/40 px-3 py-1 text-xs text-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Deployed (Demo)
                      </div>
                      {t.blockchain !== "xrp" ? (
                        <Button asChild variant="secondary" className="h-9 gap-2">
                          <a
                            href={`${explorerBase[t.blockchain]}/address/${t.contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}


