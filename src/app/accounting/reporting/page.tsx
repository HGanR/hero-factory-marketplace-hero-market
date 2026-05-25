"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAccount, useReadContract, useChainId } from "wagmi";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentUploadPanel from "@/components/reporting/DocumentUploadPanel";
import TransactionTaggingPanel from "@/components/reporting/TransactionTaggingPanel";
import BusinessSpreadsheetPanel from "@/components/reporting/BusinessSpreadsheetPanel";
import BankerSummaryPanel from "@/components/reporting/BankerSummaryPanel";
import MobileWalletButton from "@/components/MobileWalletButton";
import { AccountingComplianceBanner } from "@/components/accounting/AccountingComplianceBanner";

const EleanorAccountingChat = dynamic(
  () => import("@/components/accounting/EleanorAccountingChat").then((m) => m.EleanorAccountingChat),
  { ssr: false }
);

// Token gate constants (mirrors /accounting)
const REQUIRED_TROO_AMOUNT = 1_000_000;
const TROO_POLYGON_CONTRACT =
  "0xa7927231898293377Ce676CFC9bbD551Cb845695" as `0x${string}`;
const DEV_TREASURY_ADDRESS =
  "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF" as `0x${string}`;
const EXTRA_EVM_ADDRESSES: `0x${string}`[] = [DEV_TREASURY_ADDRESS];

const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-rpc.com",
  "https://1rpc.io/polygon",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-mainnet.blastapi.io",
  "https://rpc.ankr.com/polygon",
].filter(Boolean);

const pad32 = (hexNo0x: string) => hexNo0x.toLowerCase().padStart(64, "0");
const encodeBalanceOf = (addr: string) => {
  const selector = "70a08231";
  const addrNo0x = addr.replace(/^0x/i, "");
  return ("0x" + selector + pad32(addrNo0x)) as `0x${string}`;
};

async function ethCallPolygonSmart(
  to: string,
  data: `0x${string}`
): Promise<{ result: `0x${string}`; notes: string[] }> {
  const notes: string[] = [];
  for (const url of POLYGON_RPC_CANDIDATES) {
    try {
      const body = { jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method: "eth_call", params: [{ to, data }, "latest"] };
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { notes.push(`RPC ${url} → HTTP ${r.status}`); continue; }
      const j = await r.json();
      if ((j as any)?.error) { notes.push(`RPC ${url} → ${String((j as any)?.error?.message || "error")}`); continue; }
      const res = (j as any)?.result as `0x${string}`;
      if (typeof res === "string") { notes.push(`RPC ${url} → ok`); return { result: res, notes }; }
      notes.push(`RPC ${url} → empty`);
    } catch (e: any) { notes.push(`RPC ${url} → ${String(e?.message || e)}`); }
  }
  throw new Error(notes.join(" | "));
}

async function readPolygonDecimals(contract: string): Promise<{ value: number; notes: string[] }> {
  try {
    const { result, notes } = await ethCallPolygonSmart(contract, "0x313ce567");
    return { value: Number(BigInt(result)), notes };
  } catch (e: any) {
    return { value: 18, notes: [`decimals fallback to 18 (${String(e?.message || e)})`] };
  }
}

async function readPolygonBalance(contract: string, addr: string) {
  const { result, notes } = await ethCallPolygonSmart(contract, encodeBalanceOf(addr));
  return { value: BigInt(result || "0x0"), notes };
}

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function AccountingReportingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get("tab");
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isTokenHolder, setIsTokenHolder] = useState(false);
  const [walletType, setWalletType] = useState<"metamask" | null>(null);
  const [displayBalance, setDisplayBalance] = useState<number>(0);
  const [polyManual, setPolyManual] = useState<{
    sum: bigint;
    decimals: number;
    notes: string[];
    ts: number | null;
    loading: boolean;
    accounts: Array<{ addr: string; raw: bigint }>;
  }>({ sum: 0n, decimals: 18, notes: [], ts: null, loading: false, accounts: [] });

  // Soft app-session gate (matches the rest of this app)
  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  const { data: trooBalance } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 137,
    query: { enabled: Boolean(address && address.startsWith("0x")) },
  });

  const { data: tokenDecimals } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: 137,
  });

  const fetchAllEvmAccounts = useCallback(async (): Promise<string[]> => {
    if (typeof window === "undefined") return [];
    const mm = (window as any).ethereum;
    const base: string[] = [];
    if (address?.startsWith("0x")) base.push(address);
    base.push(...EXTRA_EVM_ADDRESSES);
    if (!mm) return Array.from(new Set(base.map((a) => a.toLowerCase())));
    try {
      const permitted = await mm.request({ method: "eth_accounts" });
      const list = Array.isArray(permitted) ? permitted : [];
      const set = new Set<string>(base.map((a) => a.toLowerCase()));
      list.forEach((a) => { if (typeof a === "string" && a.startsWith("0x")) set.add(a.toLowerCase()); });
      return [...set];
    } catch {
      return Array.from(new Set(base.map((a) => a.toLowerCase())));
    }
  }, [address]);

  const rescanPolygonManual = useCallback(async () => {
    const addrs = await fetchAllEvmAccounts();
    if (!addrs.length) {
      setPolyManual((p) => ({ ...p, sum: 0n, ts: Date.now(), loading: false, accounts: [] }));
      return;
    }
    setPolyManual((p) => ({ ...p, loading: true, notes: [], accounts: [] }));
    const notes: string[] = [];
    try {
      const { value: dec, notes: decNotes } = await readPolygonDecimals(TROO_POLYGON_CONTRACT);
      notes.push(...decNotes);
      let sum = 0n;
      const accounts: Array<{ addr: string; raw: bigint }> = [];
      for (const addr of addrs) {
        try {
          const { value: bal, notes: balNotes } = await readPolygonBalance(TROO_POLYGON_CONTRACT, addr);
          notes.push(...balNotes);
          notes.push(`Polygon ${addr.slice(0, 6)}...${addr.slice(-4)} → ${bal.toString()} (raw)`);
          sum += bal;
          accounts.push({ addr, raw: bal });
        } catch (e: any) {
          notes.push(`Polygon ${addr.slice(0, 6)}...${addr.slice(-4)} read error: ${String(e?.message || e)}`);
        }
      }
      setPolyManual({
        sum,
        decimals: Number.isFinite(dec) ? dec : 18,
        notes,
        ts: Date.now(),
        loading: false,
        accounts,
      });
    } catch (e: any) {
      notes.push(`Polygon manual scan failed: ${String(e?.message || e)}`);
      setPolyManual({ sum: 0n, decimals: 18, notes, ts: Date.now(), loading: false, accounts: [] });
    }
  }, [fetchAllEvmAccounts]);

  const checkTokenBalance = useCallback(async () => {
    if (!address || !isConnected) {
      setIsTokenHolder(false);
      setDisplayBalance(0);
      setWalletType(null);
      return;
    }

    setWalletType("metamask");

    if (address.toLowerCase() === DEV_TREASURY_ADDRESS.toLowerCase()) {
      setIsTokenHolder(true);
      setDisplayBalance(REQUIRED_TROO_AMOUNT);
      return;
    }

    try {
      let raw = (trooBalance ?? 0n) as bigint;
      let decimals = Number(tokenDecimals ?? 18);

      if (raw <= 0n) {
        await rescanPolygonManual();
      }

      raw = raw > 0n ? raw : polyManual.sum;
      decimals = raw > 0n ? decimals : polyManual.decimals;

      const balance = Number(raw) / Math.pow(10, Number.isFinite(decimals) ? decimals : 18);
      setDisplayBalance(balance);
      setIsTokenHolder(balance >= REQUIRED_TROO_AMOUNT);
    } catch (error) {
      console.error("Token balance check failed:", error);
      setIsTokenHolder(false);
      setDisplayBalance(0);
    }
  }, [address, isConnected, trooBalance, tokenDecimals, polyManual.sum, polyManual.decimals, rescanPolygonManual]);

  useEffect(() => {
    checkTokenBalance();
  }, [checkTokenBalance]);

  useEffect(() => {
    if (isConnected && address?.startsWith("0x")) {
      if (!polyManual.loading) checkTokenBalance();
    }
  }, [polyManual.loading, polyManual.sum, polyManual.decimals, isConnected, address, checkTokenBalance]);

  if (!isTokenHolder && address !== DEV_TREASURY_ADDRESS) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="max-w-md mx-auto p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">🔒 Token Gate</h1>
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-slate-300">Please connect your wallet with sufficient TROO tokens on Polygon.</p>
              <div className="flex justify-center">
                <MobileWalletButton />
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-300 mb-4">
                You need at least {REQUIRED_TROO_AMOUNT.toLocaleString()} TROO tokens to access reporting.
              </p>
              <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wallet:</span>
                    <span className="font-mono text-slate-200">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wallet Type:</span>
                    <span className="text-slate-200">{walletType ?? "unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Network:</span>
                    <span className={chainId === 137 ? "text-emerald-300" : "text-amber-300"}>
                      {chainId === 137 ? "Polygon" : `Chain ${chainId ?? "?"}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Your Balance:</span>
                    <span className={`font-bold ${displayBalance >= REQUIRED_TROO_AMOUNT ? "text-green-400" : "text-red-400"}`}>
                      {displayBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Required:</span>
                    <span className="font-bold text-blue-400">{REQUIRED_TROO_AMOUNT.toLocaleString()}</span>
                  </div>
                  {displayBalance < REQUIRED_TROO_AMOUNT && (
                    <div className="text-xs text-red-400 mt-2">
                      Need {(REQUIRED_TROO_AMOUNT - displayBalance).toLocaleString()} more TROO tokens
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { rescanPolygonManual(); checkTokenBalance(); }}
                    className="mt-3 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs hover:bg-slate-700"
                    disabled={polyManual.loading}
                  >
                    {polyManual.loading ? "Rescanning…" : "🔄 Rescan Polygon"}
                  </button>
                  <details className="mt-3 rounded-lg border border-slate-700 bg-slate-800/70 p-3 text-left text-xs text-slate-200">
                    <summary className="cursor-pointer text-cyan-300">Debug</summary>
                    <div className="mt-2 space-y-1">
                      <div>Raw (wagmi): {(trooBalance ?? 0n).toString()}</div>
                      <div>Raw (manual): {polyManual.sum.toString()}</div>
                      <div>Decimals: {Number(tokenDecimals ?? polyManual.decimals ?? 18)}</div>
                      {polyManual.accounts.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="font-semibold text-slate-100">Manual scan (accounts):</div>
                          {polyManual.accounts.map((a, i) => {
                            const dec = Number.isFinite(polyManual.decimals) ? polyManual.decimals : 18;
                            const val = Number(a.raw) / Math.pow(10, dec);
                            return (
                              <div key={i} className="flex justify-between gap-2">
                                <span className="font-mono">{a.addr.slice(0, 6)}...{a.addr.slice(-4)}</span>
                                <span>{val.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {polyManual.notes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {polyManual.notes.map((n, i) => <div key={i}>{n}</div>)}
                        </div>
                      )}
                      {polyManual.ts && <div>Manual scan: {new Date(polyManual.ts).toLocaleTimeString()}</div>}
                    </div>
                  </details>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <AccountingComplianceBanner />
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-bold">Reporting</div>
            <div className="mt-1 text-sm text-slate-300">
              Document uploads and transaction tagging for compliance reporting.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Home
            </Button>
            <Button variant="secondary" onClick={() => router.push("/payroll")}>
              Payroll
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue={tabFromUrl === "banker" ? "banker" : "documents"}
          className="space-y-4"
        >
          <TabsList className="bg-slate-950">
            <TabsTrigger value="documents">Document Upload</TabsTrigger>
            <TabsTrigger value="transactions">Transaction Tagging</TabsTrigger>
            <TabsTrigger value="spreadsheet">Business Spreadsheet</TabsTrigger>
            <TabsTrigger value="banker">Banker Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <DocumentUploadPanel />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionTaggingPanel />
          </TabsContent>
          <TabsContent value="spreadsheet">
            <BusinessSpreadsheetPanel />
          </TabsContent>
          <TabsContent value="banker">
            <BankerSummaryPanel />
          </TabsContent>
        </Tabs>

        <EleanorAccountingChat />

        <div className="fixed bottom-4 right-4 hidden">
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function AccountingReportingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 p-6 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <AccountingReportingContent />
    </Suspense>
  );
}
