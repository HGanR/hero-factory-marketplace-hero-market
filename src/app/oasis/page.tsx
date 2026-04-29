"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import MobileWalletButton from "@/components/MobileWalletButton";

// -----------------------------
// Token Gate (match Trust page behavior)
// -----------------------------

const TROO_POLYGON_CONTRACT = "0xa7927231898293377Ce676CFC9bbD551Cb845695" as `0x${string}`;
const EXTRA_EVM_ADDRESSES: `0x${string}`[] = ["0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF"];
const REQUIRED_TROO_AMOUNT = 1_000_000; // matches Trust page gate display

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-rpc.com",
  "https://1rpc.io/polygon",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-mainnet.blastapi.io",
  "https://rpc.ankr.com/polygon",
].filter(Boolean);

function pad32(hexNo0x: string) {
  return hexNo0x.toLowerCase().padStart(64, "0");
}
function encodeBalanceOf(addr: string) {
  const selector = "70a08231";
  const addrNo0x = addr.replace(/^0x/i, "");
  return ("0x" + selector + pad32(addrNo0x)) as `0x${string}`;
}
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

type Category = { id: number; name: string; slug: string };
type ElementRow = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  assetUri: string;
  previewImageUri: string | null;
  price?: string;
  currency?: string;
  createdAt: string;
};

function toGateway(ipfsUri: string | null | undefined) {
  if (!ipfsUri) return null;
  return ipfsUri.replace("ipfs://", "https://nftstorage.link/ipfs/");
}

export default function OasisPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);

  // Token gate state
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { data: trooDecimalsData, isLoading: trooDecimalsLoading } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: 137,
    query: { enabled: true },
  });

  const { data: trooBalanceData, isLoading: trooBalanceLoading } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address && address.startsWith("0x") ? [address as `0x${string}`] : undefined,
    chainId: 137,
    query: { enabled: Boolean(address && address.startsWith("0x")) },
  });

  const trooDecimals = Number(trooDecimalsData ?? 18);

  const [polyManual, setPolyManual] = useState<{
    sum: bigint;
    decimals: number;
    notes: string[];
    ts: number | null;
    loading: boolean;
  }>({ sum: 0n, decimals: 18, notes: [], ts: null, loading: false });

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
      setPolyManual((p) => ({ ...p, sum: 0n, ts: Date.now(), loading: false, notes: [] }));
      return;
    }
    setPolyManual((p) => ({ ...p, loading: true, notes: [] }));
    const notes: string[] = [];
    try {
      const { value: dec, notes: decNotes } = await readPolygonDecimals(TROO_POLYGON_CONTRACT);
      notes.push(...decNotes);
      let sum = 0n;
      for (const addr of addrs) {
        try {
          const { value: bal, notes: balNotes } = await readPolygonBalance(TROO_POLYGON_CONTRACT, addr);
          notes.push(...balNotes);
          notes.push(`Polygon ${addr.slice(0, 6)}...${addr.slice(-4)} → ${bal.toString()} (raw)`);
          sum += bal;
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
      });
    } catch (e: any) {
      notes.push(`Polygon manual scan failed: ${String(e?.message || e)}`);
      setPolyManual({ sum: 0n, decimals: 18, notes, ts: Date.now(), loading: false });
    }
  }, [fetchAllEvmAccounts]);

  useEffect(() => {
    if (!isConnected) return;
    if (!address?.startsWith("0x")) return;
    rescanPolygonManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const trooRawWagmi = (trooBalanceData ?? 0n) as bigint;
  const trooEffectiveRaw = trooRawWagmi > 0n ? trooRawWagmi : polyManual.sum;
  const trooEffectiveDecimals = trooRawWagmi > 0n ? trooDecimals : polyManual.decimals;
  const trooBalance = useMemo(() => {
    if (!address?.startsWith("0x")) return 0;
    const dec = Number.isFinite(trooEffectiveDecimals) ? trooEffectiveDecimals : 18;
    return Number(trooEffectiveRaw) / Math.pow(10, dec);
  }, [address, trooEffectiveDecimals, trooEffectiveRaw]);

  const meetsGate = isConnected && trooBalance >= REQUIRED_TROO_AMOUNT;

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
    async function load() {
      setLoading(true);
      try {
        const cRes = await fetch("/api/oasis/categories");
        const cData = await cRes.json();
        setCategories(Array.isArray(cData.categories) ? cData.categories : []);

        const eRes = await fetch("/api/oasis/elements");
        const eData = await eRes.json();
        setElements(Array.isArray(eData.elements) ? eData.elements : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (activeCategoryId === "all") return elements;
    return elements.filter((e) => e.categoryId === activeCategoryId);
  }, [elements, activeCategoryId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">OASIS</h1>
            <p className="text-sm text-slate-300">Custom World Elements</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/dashboard"
              className="text-slate-300 hover:text-cyan-200 underline hover:[text-shadow:0_0_12px_rgba(0,209,255,0.65)]"
            >
              Dashboard
            </Link>
            <Link
              href="/star-fleet"
              className="text-slate-300 hover:text-cyan-200 underline hover:[text-shadow:0_0_12px_rgba(0,209,255,0.65)]"
            >
              Star Fleet
            </Link>
            <Link
              href="/oasis-world"
              className="text-slate-300 hover:text-cyan-200 underline hover:[text-shadow:0_0_12px_rgba(0,209,255,0.65)]"
            >
              Enter OASIS World
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-cyan-400/50 bg-slate-950 p-6 transition-[box-shadow,border-color] duration-200 hover:border-cyan-300 hover:shadow-[0_0_28px_rgba(0,209,255,0.35)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Token Status</div>
              {isConnected ? (
                <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Wallet:</span>
                    <span className="font-mono">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Network:</span>
                    <span className={chainId === 137 ? "text-emerald-300" : "text-amber-200"}>
                      {chainId === 137 ? "✅ Polygon" : `⚠️ Chain ${chainId || "?"}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Contract:</span>
                    <span className="font-mono">{TROO_POLYGON_CONTRACT.slice(0, 6)}...{TROO_POLYGON_CONTRACT.slice(-4)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Token Balance:</span>
                    <span className={meetsGate ? "text-emerald-300" : "text-slate-200"}>
                      {trooDecimalsLoading || trooBalanceLoading || polyManual.loading ? "Checking..." : `${trooBalance.toLocaleString()} TROO`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Gate:</span>
                    <span className={meetsGate ? "text-emerald-300" : "text-slate-300"}>
                      need ≥ {REQUIRED_TROO_AMOUNT.toLocaleString()} — {meetsGate ? "met" : "not met"}
                    </span>
                  </div>
                  {meetsGate ? (
                    <div className="mt-2 text-xs font-semibold text-emerald-300">✓ Gate Passed</div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-300">
                      Hold TROO on Polygon to unlock holder-gated experiences (same as Trust page).
                    </div>
                  )}

                  <details className="mt-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                    <summary className="cursor-pointer text-xs text-cyan-200">Debug</summary>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div>Decimals: {Number.isFinite(trooEffectiveDecimals) ? trooEffectiveDecimals : "—"}</div>
                      <div className="break-all">Raw (effective): {trooEffectiveRaw.toString()}</div>
                      <div className="break-all">Raw (wagmi): {trooRawWagmi.toString()}</div>
                      <div className="break-all">Raw (manual): {polyManual.sum.toString()}</div>
                      {polyManual.ts ? <div>Manual scan: {new Date(polyManual.ts).toLocaleTimeString()}</div> : null}
                      {polyManual.notes.length ? (
                        <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                          {polyManual.notes.map((n, i) => <div key={i}>{n}</div>)}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => rescanPolygonManual()}
                        className="mt-2 rounded-lg bg-slate-800 px-2 py-1 text-xs text-cyan-200 hover:bg-slate-700"
                      >
                        🔄 Rescan Balance
                      </button>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-300">
                  Connect a wallet to check TROO holdings on Polygon.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isConnected ? <MobileWalletButton /> : null}
              <a
                href={`https://polygonscan.com/token/${TROO_POLYGON_CONTRACT}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-cyan-300 underline hover:text-cyan-200 hover:[text-shadow:0_0_12px_rgba(0,209,255,0.65)]"
              >
                View Contract
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">World Elements</div>
          <div className="text-sm text-slate-300 mt-2">
            Browse elements by category. Categories are managed from the Admin “OASIS ELEMENTS” tool.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1.5 rounded-xl border text-sm ${
              activeCategoryId === "all" ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
            }`}
            onClick={() => setActiveCategoryId("all")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`px-3 py-1.5 rounded-xl border text-sm ${
                activeCategoryId === c.id ? "bg-slate-700 border-slate-500" : "border-slate-700 hover:border-slate-600"
              }`}
              onClick={() => setActiveCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-300">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-slate-300">
            No elements yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const preview = toGateway(e.previewImageUri);
              const priceLabel =
                e.price && e.currency ? `${e.price} ${e.currency.replace("_", " ")}` : null;
              return (
                <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="h-44 bg-slate-800/50">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt={e.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-400 text-sm">No preview</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{e.name}</div>
                      {priceLabel ? (
                        <div className="shrink-0 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                          {priceLabel}
                        </div>
                      ) : null}
                    </div>
                    {e.description ? <div className="text-sm text-slate-300 mt-2">{e.description}</div> : null}
                    <div className="text-xs text-slate-400 mt-3 break-all">Asset: {e.assetUri}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

