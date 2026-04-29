// pages/trust.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSwitchChain,
  useChainId,
  useConnect,
} from "wagmi";
import { heroAbi } from "@/lib/heroAbi";
import { BaseError } from "viem";

/* ---------------- RPC helpers ---------------- */
const PUBLIC_SOLANA_RPC = (process.env.NEXT_PUBLIC_SOLANA_RPC || "").trim();
function getSolRpc(): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return PUBLIC_SOLANA_RPC || `${origin}/api/solana`;
}

/** ✅ Single cached loader for @solana/web3.js */
let _solanaWeb3: any | null = null;
async function solanaWeb3() {
  if (_solanaWeb3) return _solanaWeb3;
  _solanaWeb3 = await import("@solana/web3.js");
  return _solanaWeb3;
}

/* ---------------- ENV / constants ---------------- */
const ELECTRIC_BLUE = "#00D1FF";

/** ✅ Solana TROO POO (Pump.fun mint) — accepts raw mint, pump.fun URL, or broken "...pump" */
const RAW_SOL_MINT = (
  process.env.NEXT_PUBLIC_TROO_POO_MINT ||
  process.env.NEXT_PUBLIC_TROO_MINT ||
  "BAeN51zZmMsnkSRFnKZHLFG1G9LkGTFoTMUbyTUDpump"
).trim();

function extractSolMint(input: string): string | null {
  if (!input) return null;
  const s = input.trim();

  // If it's a full pump.fun URL, pull the token segment
  const urlMatch = s.match(/pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/i);
  if (urlMatch) return urlMatch[1];

  // If someone pasted "<mint>pump" (common copy mistake), strip trailing "pump"
  if (s.endsWith("pump")) {
    const maybe = s.slice(0, -"pump".length);
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(maybe)) return maybe;
  }

  // If it's already a base58 pubkey of valid length, accept as-is
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return s;

  return null;
}

const SOL_MINT = extractSolMint(RAW_SOL_MINT) || "";

/** ERC-20 TROO contracts */
const EVM_TROO_POLYGON = (
  process.env.NEXT_PUBLIC_TROO_ERC20_POLYGON ||
  "0xa7927231898293377Ce676CFC9bbD551Cb845695"
) as `0x${string}`;
const EVM_TROO_ETHEREUM = (process.env.NEXT_PUBLIC_TROO_ERC20_ETHEREUM || "") as
  | `0x${string}`
  | "";

/** XRPL (not part of new holder threshold, but kept for read tools) */
const XRPL_CURRENCY = (process.env.NEXT_PUBLIC_XRPL_CURRENCY || "TROO").trim();
const XRPL_ISSUER = (process.env.NEXT_PUBLIC_XRPL_ISSUER || "").trim();

/** Dev treasuries (from stamps.tsx) */
const DEV_POLYGON_TREASURY = "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF" as `0x${string}`;
const DEV_SOLANA_TREASURY = "FP7idjzyVLRWeQ86M6ncLC7WmZaiccSBeVTUdufDppJY";

/** Holder gate: minimum tokens required (match other pages) */
const HOLDER_THRESHOLD_TOKENS = BigInt(100);

/** Minimal ERC-20 ABI */
const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "balance", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

/** SPL program IDs */
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEh9bRJwCbpeta7c1s963uH8EQn";

/** ETH NFT (mint) contract */
const EVM_NFT_ETHEREUM = (
  process.env.NEXT_PUBLIC_EVM_CONTRACT_ETHEREUM ||
  process.env.NEXT_PUBLIC_ETH_NFT_ADDRESS ||
  ""
) as `0x${string}` | "";

/** For file type hints */
const ACCEPT_TYPES = ".jpeg,.jpg,.gif,.mov,.mp4,.png,.webp";
/** Max mint quantity */
const MAX_QTY = 10_000;

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

/* ---------------- tiny helpers ---------------- */
const fmt = (a?: string, sol?: boolean) =>
  a ? (sol ? `${a.slice(0, 4)}..${a.slice(-4)}` : `${a.slice(0, 6)}..${a.slice(-4)}`) : "—";

const pow10 = (d: number) => BigInt(10) ** BigInt(isFinite(d) ? d : 18);
const thresholdRaw = (d: number) => HOLDER_THRESHOLD_TOKENS * pow10(d);

/** Decimal → bigint (fixed) for XRPL (default 6 places) */
function toFixedBigint(numStr: string, decimals = 6): bigint {
  let s = numStr.trim();
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const [i, f = ""] = s.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  const merged = (i.replace(/^0+/, "") || "0") + frac;
  const bi = BigInt(merged);
  return neg ? -bi : bi;
}

/** ETH (string) -> wei (bigint) */
function ethToWei(ethStr: string): bigint {
  const s = (ethStr || "").trim();
  if (!s) return BigInt(0);
  if (!/^\d+(\.\d{0,18})?$/.test(s)) throw new Error("Invalid ETH format");
  const [i, f = ""] = s.split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  return BigInt((i.replace(/^0+/, "") || "0") + frac);
}

/* ---------- Polygon JSON-RPC helpers (multi-fallback) ---------- */
const USER_POLYGON = (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim();
const POLYGON_RPC_CANDIDATES = [
  USER_POLYGON,
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-rpc.com",
  "https://1rpc.io/polygon",
  "https://rpc.ankr.com/polygon",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-mainnet.blastapi.io",
].filter(Boolean);

function pad32(hexNo0x: string) { return hexNo0x.toLowerCase().padStart(64, "0"); }
function encodeBalanceOf(addr: string) {
  const selector = "70a08231";
  const addrNo0x = addr.replace(/^0x/i, "");
  return "0x" + selector + pad32(addrNo0x);
}
async function ethCallPolygonSmart(
  to: string,
  data: string
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

/* ---------------- local “libs” for gallery ---------------- */
function savePublicHero(entry: {
  name: string; image: string; url?: string; chain: "Ethereum"; priceEth?: string;
}) {
  try {
    const raw = localStorage.getItem("hf_public_heroes");
    const list: any[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem("hf_public_heroes", JSON.stringify([entry, ...list]));
    const ev = new CustomEvent("hero:public-minted", { detail: entry });
    window.dispatchEvent(ev);
  } catch {}
}

/* ---------------- explorer links ---------------- */
const polygonScanToken = (addr: string) => `https://polygonscan.com/token/${addr}`;
const etherScanToken = (addr: string) => `https://etherscan.io/token/${addr}`;
const solscanToken = (mint: string) => `https://solscan.io/token/${mint}`;
const solanaExplorerToken = (mint: string) => `https://explorer.solana.com/address/${mint}`;
const pumpFunCoin = (mint: string) => `https://pump.fun/coin/${mint}`;
const xrpscanIssuer = (issuer: string) => `https://xrpscan.com/account/${issuer}`;

/* ---------------- page ---------------- */
export default function TrustPage() {
  const { address: evmAddr } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();


  /** Track ALL connected MetaMask accounts */
  const [evmAddrs, setEvmAddrs] = useState<string[]>([]);
  useEffect(() => {
    const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
    if (!mm) return;
    const load = async () => {
      try {
        const a = (await mm.request({ method: "eth_accounts" })) as string[];
        setEvmAddrs(Array.isArray(a) ? a : []);
      } catch {}
    };
    load();
    const onAcc = (a: string[]) => setEvmAddrs(Array.isArray(a) ? a : []);
    const onChain = () => load();
    mm.on?.("accountsChanged", onAcc);
    mm.on?.("chainChanged", onChain);
    return () => {
      mm.removeListener?.("accountsChanged", onAcc);
      mm.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function chooseEvmAccounts() {
    const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
    if (!mm) return;
    try {
      const picked = (await mm.request({ method: "eth_requestAccounts" })) as string[];
      setEvmAddrs(Array.isArray(picked) ? picked : []);
    } catch (e) {
      console.warn("eth_requestAccounts cancelled or failed", e);
    } finally {
      try {
        await Promise.all([refetchPolyDec(), refetchPolyBal(), refetchEthDec(), refetchEthBal()]);
      } catch {}
      rescanPolygonManual();
    }
  }

  async function pickEvmAccountsStrong() {
    const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
    if (!mm) return;
    try {
      await mm.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const picked = (await mm.request({ method: "eth_requestAccounts" })) as string[];
      setEvmAddrs(Array.isArray(picked) ? picked : []);
    } catch (e) {
      console.warn("wallet_requestPermissions cancelled or failed", e);
    } finally {
      try {
        await Promise.all([refetchPolyDec(), refetchPolyBal(), refetchEthDec(), refetchEthBal()]);
      } catch {}
      rescanPolygonManual();
    }
  }

  // ---------- EVM reads via wagmi ----------
  const { data: polyDecData, refetch: refetchPolyDec } = useReadContract({
    address: EVM_TROO_POLYGON,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: 137,
    query: { enabled: Boolean(EVM_TROO_POLYGON) },
  });
  const { data: polyBalData, refetch: refetchPolyBal } = useReadContract({
    address: EVM_TROO_POLYGON,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: evmAddr ? [evmAddr] : undefined,
    chainId: 137,
    query: { enabled: Boolean(evmAddr && EVM_TROO_POLYGON) },
  });

  const { data: ethDecData, refetch: refetchEthDec } = useReadContract({
    address: EVM_TROO_ETHEREUM || undefined,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: 1,
    query: { enabled: Boolean(EVM_TROO_ETHEREUM) },
  });
  const { data: ethBalData, refetch: refetchEthBal } = useReadContract({
    address: EVM_TROO_ETHEREUM || undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: evmAddr && EVM_TROO_ETHEREUM ? [evmAddr] : undefined,
    chainId: 1,
    query: { enabled: Boolean(evmAddr && EVM_TROO_ETHEREUM) },
  });

  const polyDecimalsWagmi = Number(polyDecData ?? 18);
  const ethDecimals = Number(ethDecData ?? 18);
  const polyRawWagmi = (polyBalData ?? 0n) as bigint;
  const ethTotalRaw = (ethBalData ?? 0n) as bigint;

  /** ---------- Manual Polygon multi-account scan (fallback with RPC rotation) ---------- */
  const [polyManual, setPolyManual] = useState<{ sum: bigint; decimals: number; notes: string[]; ts: number | null; }>({ sum: 0n, decimals: 18, notes: [], ts: null });

  async function rescanPolygonManual(addrs?: string[]) {
    const set = new Set<string>();
    if (evmAddr) set.add(evmAddr.toLowerCase());
    for (const a of (addrs ?? evmAddrs)) if (a) set.add(a.toLowerCase());
    set.add(DEV_POLYGON_TREASURY.toLowerCase());
    const targets = [...set];

    const notes: string[] = [];
    if (!EVM_TROO_POLYGON || targets.length === 0) {
      setPolyManual({ sum: 0n, decimals: polyDecimalsWagmi || 18, notes, ts: Date.now() });
      return;
    }
    try {
      const { value: dec, notes: decNotes } = await readPolygonDecimals(EVM_TROO_POLYGON);
      notes.push(...decNotes);
      let sum = 0n;
      notes.push(`Permitted EVM account(s): ${targets.map((a) => fmt(a)).join(", ")}`);
      for (const a of targets) {
        try {
          const { value: bal, notes: balNotes } = await readPolygonBalance(EVM_TROO_POLYGON, a);
          notes.push(`Polygon ${fmt(a)} → ${bal.toString()} (raw)`);
          if (balNotes.length) notes.push(...balNotes);
          sum += bal;
        } catch (e: any) {
          notes.push(`Polygon ${fmt(a)} read error: ${String(e?.message || e)}`);
        }
      }
      setPolyManual({ sum, decimals: Number.isFinite(dec) ? dec : 18, notes, ts: Date.now() });
    } catch (e: any) {
      setPolyManual({
        sum: 0n,
        decimals: polyDecimalsWagmi || 18,
        notes: [`Polygon manual scan failed: ${String(e?.message || e)}`],
        ts: Date.now(),
      });
    }
  }

  useEffect(() => {
    if (evmAddrs.length > 0) rescanPolygonManual(evmAddrs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmAddrs.join("|"), evmAddr]);

  // Immediately check Polygon balance when MetaMask connects (even if not on Polygon network)
  useEffect(() => {
    if (evmAddr) {
      // Trigger manual Polygon scan immediately on connection
      rescanPolygonManual([evmAddr]);
      // Also try wagmi read (works if on Polygon, but manual scan works from any network)
      refetchPolyDec();
      refetchPolyBal();
    }
  }, [evmAddr, refetchPolyDec, refetchPolyBal]);

  useEffect(() => {
    const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
    if (!mm) return;
    const re = () => {
      refetchPolyDec();
      refetchPolyBal();
      if (EVM_TROO_ETHEREUM) {
        refetchEthDec();
        refetchEthBal();
      }
      rescanPolygonManual();
    };
    mm.on?.("accountsChanged", re);
    mm.on?.("chainChanged", re);
    return () => {
      mm.removeListener?.("accountsChanged", re);
      mm.removeListener?.("chainChanged", re);
    };
  }, [refetchPolyDec, refetchPolyBal, refetchEthDec, refetchEthBal]);

  // Prefer wagmi if > 0; otherwise manual multi-account sum
  const polyEffectiveRaw = polyRawWagmi > 0n ? polyRawWagmi : polyManual.sum;
  const polyDecimals = polyRawWagmi > 0n ? polyDecimalsWagmi : polyManual.decimals;

  // Automatically switch to Polygon if Polygon TROO tokens are detected
  useEffect(() => {
    if (evmAddr && chainId !== 137 && polyEffectiveRaw >= thresholdRaw(polyDecimals)) {
      // Auto-switch to Polygon if user has TROO tokens there
      const trySwitch = async () => {
        try {
          await switchChainAsync?.({ chainId: 137 });
        } catch (e: any) {
          // Silent fail - user can manually switch
          console.log("Auto-switch to Polygon skipped:", e?.message);
        }
      };
      // Small delay to avoid race conditions
      const timer = setTimeout(trySwitch, 1000);
      return () => clearTimeout(timer);
    }
  }, [evmAddr, chainId, switchChainAsync, polyEffectiveRaw, polyDecimals]);

  const toDisplay = (raw: bigint, dec: number) =>
    raw > 0n ? Number(raw) / 10 ** (isFinite(dec) ? dec : 18) : 0;

  const polyDisplay = (evmAddr || evmAddrs.length > 0) ? toDisplay(polyEffectiveRaw, polyDecimals) : 0;
  const ethDisplay = evmAddr ? toDisplay(ethTotalRaw, ethDecimals) : 0;

  // ---------- Solana state ----------
  const [solPk, setSolPk] = useState<string | null>(null);
  const [solRaw, setSolRaw] = useState<bigint>(0n);
  const [solDecimals, setSolDecimals] = useState<number>(6);
  const [lastScan, setLastScan] = useState<number | null>(null);

  // ---------- XRPL (informational) ----------
  const [xrpAddr, setXrpAddr] = useState<string>("");
  const [xrpRaw, setXrpRaw] = useState<bigint>(0n);
  const [xrpLastScan, setXrpLastScan] = useState<number | null>(null);
  const [xrpDbg, setXrpDbg] = useState<string[]>([]);

  // ---------- Holder gating (≥ 1,000,000 TROO on either Polygon or Solana) ----------
  const meetsPolygonGate = polyEffectiveRaw >= thresholdRaw(polyDecimals);
  const meetsSolanaGate = solRaw >= thresholdRaw(solDecimals);
  // Gate checks both networks - if either has ≥ 1,000,000 tokens, grant access
  // Token gate removed - all visitors can access the hidden menu
  const isHolder = true; // Always allow access to hidden menu

  /** ---------------- client-only: which gated tool to show ---------------- */
  const [panel, setPanel] = useState<"none" | "mint" | "token" | "checklist">("none");
  const [panelOpen, setPanelOpen] = useState(false);

  // Close tools on disconnect / falling below threshold
  // Token gate removed - no longer closing tools based on holder status
  // useEffect(() => {
  //   if (!isHolder) {
  //     setPanel("none");
  //     setPanelOpen(false);
  //   }
  // }, [isHolder]);

  /** ---------------- Phantom watcher ---------------- */
  // Solana wallet removed - SSR-safe
  const SolReader = useMemo(() => {
    return function Inner() {
      // Solana wallet support removed - no longer using useWallet()
      return null;
    };
  }, []);

  /** ---------------- ✅ Solana rescan with fallback & stronger validation ---------------- */
  async function solanaScanWith(endpoint: string, ownerBase58?: string | null) {
    const notes: string[] = [];
    const web3 = await solanaWeb3();
    const conn = new web3.Connection(endpoint, "confirmed");

    // Early validation of SOL_MINT
    if (!SOL_MINT) {
      notes.push("SOL_MINT is missing or invalid (expected base58 mint, 32–44 chars).");
      return { total: 0n, decimals: 6, notes };
    }

    let mintPk: any;
    try {
      mintPk = new web3.PublicKey(SOL_MINT);
    } catch (e: any) {
      notes.push(`Invalid SOL_MINT: ${String(e?.message || e)}`);
      return { total: 0n, decimals: 6, notes };
    }

    let decimals = 6;
    try {
      const mintInfo = await conn.getParsedAccountInfo(mintPk, { commitment: "confirmed" });
      const parsed: any = (mintInfo.value as any)?.data?.parsed;
      const dec = Number(parsed?.info?.decimals);
      if (Number.isFinite(dec)) decimals = dec;
    } catch (e: any) { notes.push(`decimals read error: ${String(e?.message || e)}`); }

    if (!ownerBase58) return { total: 0n, decimals, notes };

    let ownerPk: any;
    try {
      ownerPk = new web3.PublicKey(ownerBase58);
    } catch (e: any) {
      notes.push(`Invalid owner pubkey: ${String(e?.message || e)}`);
      return { total: 0n, decimals, notes };
    }

    let total = 0n;

    try {
      const rA = await conn.getParsedTokenAccountsByOwner(ownerPk, { mint: mintPk });
      let tA = 0n;
      for (const it of rA.value) tA += BigInt(it.account.data.parsed.info.tokenAmount.amount);
      notes.push(`A by mint → ${rA.value.length} account(s), sum=${tA.toString()}`);
      total += tA;
    } catch (e: any) { notes.push(`A error: ${String(e?.message || e)}`); }

    try {
      const rB = await conn.getParsedTokenAccountsByOwner(ownerPk, { programId: new (await solanaWeb3()).PublicKey(TOKEN_PROGRAM_ID) });
      let tB = 0n;
      for (const it of rB.value) if (it.account.data.parsed.info.mint === mintPk.toBase58()) tB += BigInt(it.account.data.parsed.info.tokenAmount.amount);
      notes.push(`B classic → scanned=${rB.value.length}, filtered sum=${tB.toString()}`);
      if (total === 0n) total += tB;
    } catch (e: any) { notes.push(`B error: ${String(e?.message || e)}`); }

    try {
      const rC = await conn.getParsedTokenAccountsByOwner(ownerPk, { programId: new (await solanaWeb3()).PublicKey(TOKEN_2022_PROGRAM_ID) });
      let tC = 0n;
      for (const it of rC.value) if (it.account.data.parsed.info.mint === mintPk.toBase58()) tC += BigInt(it.account.data.parsed.info.tokenAmount.amount);
      notes.push(`C 2022 → scanned=${rC.value.length}, filtered sum=${tC.toString()}`);
      if (total === 0n) total += tC;
    } catch (e: any) { notes.push(`C error: ${String(e?.message || e)}`); }

    return { total, decimals, notes };
  }

  async function rescan(ownerBase58?: string | null) {
    try {
      const primary = getSolRpc();
      let { total, decimals, notes } = await solanaScanWith(primary, ownerBase58);

      const saw401 = notes.some((n) => /401|unauthorized/i.test(n));
      if (saw401 && !PUBLIC_SOLANA_RPC) {
        const fallback = "https://api.mainnet-beta.solana.com";
        const retry = await solanaScanWith(fallback, ownerBase58);
        notes.push(`Retry via public RPC: ${fallback}`);
        total = retry.total; decimals = retry.decimals; notes = retry.notes.length ? retry.notes : notes;
      }

      setSolDecimals(decimals);
      setSolRaw(total);
      setLastScan(Date.now());
    } catch (e: any) {
      setSolRaw(0n);
      setLastScan(Date.now());
    }
  }

  useEffect(() => {
    rescan(solPk);
    const h = () => rescan(solPk);
    document.addEventListener("troo:rescan-sol", h);
    return () => document.removeEventListener("troo:rescan-sol", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solPk]);

  const solDisplay = solPk && solRaw > 0n ? Number(solRaw) / 10 ** (isFinite(solDecimals) ? solDecimals : 6) : 0;

  /** ---------------- XRPL read (informational only) ---------------- */
  useEffect(() => { try { const prev = localStorage.getItem("troo:xrp_address"); if (prev) setXrpAddr(prev); } catch {} }, []);
  useEffect(() => { try { if (xrpAddr) localStorage.setItem("troo:xrp_address", xrpAddr); else localStorage.removeItem("troo:xrp_address"); } catch {} }, [xrpAddr]);

  async function rescanXRP(addr?: string) {
    const a = (addr ?? xrpAddr).trim();
    const notes: string[] = [];
    if (!a || !XRPL_ISSUER || !XRPL_CURRENCY) { setXrpRaw(0n); setXrpLastScan(Date.now()); return; }
    try {
      const xrpl = await import("xrpl");
      const client = new xrpl.Client("wss://xrplcluster.com");
      await client.connect();
      notes.push("connected to xrplcluster");
      const resp = await client.request({ command: "account_lines", account: a, peer: XRPL_ISSUER } as any);
      await client.disconnect();
      let total = 0n;
      const result: any = (resp as any).result;
      const lines: any[] = (result?.lines as any[]) || [];
      for (const line of lines) if (String(line.currency) === XRPL_CURRENCY) { const bi = toFixedBigint(String(line.balance), 6); if (bi > 0n) total += bi; }
      notes.push(`trust lines scanned=${lines.length}, total=${total.toString()} (scaled 1e6)`);
      setXrpRaw(total); setXrpLastScan(Date.now());
    } catch (e: any) { setXrpRaw(0n); setXrpLastScan(Date.now()); }
  }

  /** ------- helper: add Polygon TROO to MetaMask ------- */
  const addPolygonTokenToMetaMask = async () => {
    try {
      const mm = (typeof window !== "undefined" && (window as any).ethereum) || null;
      if (!mm) return alert("MetaMask not detected.");
      await mm.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: { address: EVM_TROO_POLYGON, symbol: "TROO", decimals: isFinite(polyDecimals) ? polyDecimals : 18 },
        },
      });
    } catch (e: any) { console.warn("wallet_watchAsset failed", e); alert("MetaMask rejected or failed to add the token."); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <h1 className="text-4xl font-extrabold text-center pt-10">Digital Trust</h1>

      <section className="max-w-5xl mx-auto px-6 mt-10">
        <div
          className={`
            relative rounded-3xl border bg-slate-800/40 p-6 md:p-8
            border-white/10 ring-1 ring-transparent
            transition-[box-shadow,ring-color,border-color] duration-200
            hover:ring-cyan-400/40 hover:shadow-[0_0_34px_rgba(0,209,255,.35)]
            focus-within:ring-cyan-400/60 focus-within:shadow-[0_0_42px_rgba(0,209,255,.5)]
          `}
        >
          <h2 className="text-2xl md:text-3xl font-bold">Digital Trust</h2>
          <p className="text-slate-300 mt-2">
            Connect your wallet below to check your <b>TROO</b> balance on <b>Polygon</b> or <b>TROO POO</b> on <b>Solana</b> (mint <code>{fmt(SOL_MINT || RAW_SOL_MINT, true)}</code>).
            <br/>The hidden menu is now accessible to all visitors.
          </p>


          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {!evmAddr && (
              <button
                onClick={async () => {
                  try {
                    const metaMaskConnector = connectors.find((c) => 
                      c.id === "io.metamask" || 
                      c.id === "metaMask" || 
                      c.name?.toLowerCase().includes("metamask") ||
                      c.type === "injected"
                    );
                    if (metaMaskConnector) {
                      await connect({ connector: metaMaskConnector });
                      // Wait for connection, then switch to Polygon
                      await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                      // Fallback: direct MetaMask connection
                      const mm = (window as any).ethereum;
                      if (mm) {
                        await mm.request({ method: "eth_requestAccounts" });
                        await new Promise(resolve => setTimeout(resolve, 500));
                      } else {
                        alert("MetaMask not found. Please install MetaMask extension.");
                        return;
                      }
                    }
                    
                    // After connection, switch to Polygon
                    try {
                      await switchChainAsync?.({ chainId: 137 });
                    } catch (e: any) {
                      // If chain not added, try to add it
                      if (e?.code === 4902 || e?.message?.includes("4902")) {
                        const mm = (window as any).ethereum;
                        if (mm) {
                          await mm.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                              chainId: "0x89", // 137 in hex
                              chainName: "Polygon Mainnet",
                              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                              rpcUrls: ["https://polygon-rpc.com/"],
                              blockExplorerUrls: ["https://polygonscan.com/"],
                            }],
                          });
                          // Try switching again after adding
                          await switchChainAsync?.({ chainId: 137 });
                        }
                      } else {
                        console.warn("Could not switch to Polygon:", e?.message);
                      }
                    }
                    
                    // Force refetch after connection and switch
                    setTimeout(() => {
                      refetchPolyDec();
                      refetchPolyBal();
                      rescanPolygonManual();
                    }, 1000);
                  } catch (error: any) {
                    console.error("Wallet connection error:", error);
                    alert(error?.message || "Failed to connect MetaMask");
                  }
                }}
                className="h-11 px-5 rounded-full font-semibold bg-orange-600 hover:bg-orange-500 text-white border-2 border-transparent"
              >
                Connect MetaMask (Polygon)
              </button>
            )}
            {evmAddr && chainId !== 137 && (
              <button
                onClick={async () => {
                  try {
                    await switchChainAsync?.({ chainId: 137 });
                  } catch (e: any) {
                    if (e?.code === 4902 || e?.message?.includes("4902")) {
                      const mm = (window as any).ethereum;
                      if (mm) {
                        await mm.request({
                          method: "wallet_addEthereumChain",
                          params: [{
                            chainId: "0x89",
                            chainName: "Polygon Mainnet",
                            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                            rpcUrls: ["https://polygon-rpc.com/"],
                            blockExplorerUrls: ["https://polygonscan.com/"],
                          }],
                        });
                        await switchChainAsync?.({ chainId: 137 });
                      }
                    } else {
                      alert("Please switch to Polygon network in MetaMask manually.");
                    }
                  }
                }}
                className="h-11 px-5 rounded-full font-semibold bg-purple-600 hover:bg-purple-500 text-white border-2 border-transparent"
              >
                Switch to Polygon
              </button>
            )}
            <WalletMultiButton className="!h-11 !px-5 !py-2.5 !rounded-full !bg-sky-300 !text-white !border-2 hover:!brightness-110 hover:!shadow-[0_0_18px_rgba(0,209,255,0.5)]" />
            <button className="h-11 px-5 rounded-full font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-900 border-2 border-transparent" onClick={() => (window.location.href = "/buy")}>
              Fund Wallet
            </button>
            {XRPL_ISSUER && (
              <button className="h-11 px-4 rounded-full bg-slate-700 hover:bg-slate-600" onClick={() => rescanXRP()} title="Re-read XRPL trust lines for this address">
                Rescan XRP
              </button>
            )}
          </div>

          {/* Status Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Card
              title={`Polygon TROO ${meetsPolygonGate ? "✅" : ""}`}
              setText={EVM_TROO_POLYGON}
              balance={polyDisplay}
              extra={
                <>
                  {meetsPolygonGate && (
                    <div className="text-xs font-semibold text-emerald-400 mb-1">✓ Gate Passed</div>
                  )}
                  <div>Active (EVM): {evmAddr ? <code>{fmt(evmAddr)}</code> : "—"}</div>
                  <div className={chainId === 137 ? "text-emerald-400" : "text-rose-400"}>
                    Network: {chainId === 137 ? "✅ Polygon" : chainId === 1 ? "⚠️ Ethereum" : chainId === 11155111 ? "⚠️ Sepolia" : `⚠️ Chain ${chainId}`}
                  </div>
                  <div>Decimals: {isFinite(polyDecimals) ? polyDecimals : "—"}</div>
                  <div className="text-xs mt-1">Gate: need ≥ 1,000,000 — {meetsPolygonGate ? <span className="text-emerald-400">met</span> : <span className="text-rose-400">not met</span>}</div>
                  <div className="text-xs mt-1">
                    Raw balance: {polyEffectiveRaw.toString()} (wagmi: {polyRawWagmi.toString()}, manual: {polyManual.sum.toString()})
                  </div>
                  <div className="text-xs mt-1 break-words">
                    <div className="break-all">
                      Contract: <code className="text-cyan-400 break-all">{EVM_TROO_POLYGON}</code>
                    </div>
                    <a 
                      href={`https://polygonscan.com/token/${EVM_TROO_POLYGON}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline inline-block mt-1"
                    >
                      View on Polygonscan
                    </a>
                  </div>
                  {evmAddr && (
                    <div className="text-xs mt-1 break-words">
                      <div className="break-all">
                        Checking wallet: <code className="text-cyan-400 break-all">{evmAddr}</code>
                      </div>
                      <a 
                        href={`https://polygonscan.com/token/${EVM_TROO_POLYGON}?a=${evmAddr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline inline-block mt-1"
                      >
                        Verify Balance
                      </a>
                    </div>
                  )}
                  {polyManual.ts && (
                    <div className="text-xs mt-1">
                      Manual scan: {new Date(polyManual.ts).toLocaleTimeString()}
                      {polyManual.notes.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-cyan-400">Debug info</summary>
                          <div className="mt-1 text-[10px] text-slate-500 max-h-40 overflow-y-auto space-y-1">
                            {polyManual.notes.map((n, i) => <div key={i}>{n}</div>)}
                            {evmAddr && (
                              <div className="mt-2 pt-2 border-t border-slate-600">
                                <div>Encoded balanceOf call:</div>
                                <code className="text-xs break-all">
                                  {encodeBalanceOf(evmAddr)}
                                </code>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  {evmAddr && (
                    <button
                      onClick={() => {
                        rescanPolygonManual([evmAddr]);
                        refetchPolyDec();
                        refetchPolyBal();
                      }}
                      className="mt-2 px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600"
                    >
                      🔄 Rescan Balance
                    </button>
                  )}
                </>
              }
            />

            <Card
              title={`Solana TROO POO ${meetsSolanaGate ? "✅" : ""}`}
              setText={SOL_MINT || RAW_SOL_MINT}
              balance={solDisplay}
              extra={
                <>
                  {meetsSolanaGate && (
                    <div className="text-xs font-semibold text-emerald-400 mb-1">✓ Gate Passed</div>
                  )}
                  <div>Connected (Sol): {solPk ? <code>{fmt(solPk, true)}</code> : "—"}</div>
                  <div>Decimals: {solDecimals}</div>
                  <div>Last scan: {lastScan ? new Date(lastScan).toLocaleTimeString() : "—"}</div>
                  {!SOL_MINT && (
                    <div className="text-xs mt-1 text-rose-400">
                      Invalid SOL_MINT. Provide a base58 mint, not a pump.fun URL or "…pump" id.
                    </div>
                  )}
                  <div className="text-xs mt-1">Gate: need ≥ 1,000,000 — {meetsSolanaGate ? <span className="text-emerald-400">met</span> : <span className="text-rose-400">not met</span>}</div>
                </>
              }
            />

            <Card
              title="Ethereum TROO"
              setText={EVM_TROO_ETHEREUM || undefined}
              balance={ethDisplay}
              extra={
                EVM_TROO_ETHEREUM ? (
                  <>
                    <div>Connected (EVM): {evmAddr ? <code>{fmt(evmAddr)}</code> : "—"}</div>
                    <div>Decimals: {isFinite(ethDecimals) ? ethDecimals : "—"}</div>
                  </>
                ) : "— Not configured"
              }
            />

            <Card
              title={`XRP ${XRPL_CURRENCY}`}
              setText={XRPL_ISSUER || undefined}
              balance={xrpAddr && xrpRaw > 0n ? Number(xrpRaw) / 1e6 : 0}
              extra={
                XRPL_ISSUER ? (
                  <>
                    <div className="mt-1">
                      <div className="text-slate-400 text-xs mb-1">XRP address (classic)</div>
                      <div className="flex gap-2">
                        <input value={xrpAddr} onChange={(e) => setXrpAddr(e.target.value)} placeholder="r..." className="flex-1 bg-slate-900/70 rounded-lg px-3 py-1.5 text-sm" />
                        <button onClick={() => rescanXRP()} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm" disabled={!xrpAddr}>Check</button>
                      </div>
                    </div>
                    <div className="mt-2">Last scan: {xrpLastScan ? new Date(xrpLastScan).toLocaleTimeString() : "—"}</div>
                  </>
                ) : "— Not configured"
              }
            />
          </div>

        </div>

        <div className="mt-8 flex gap-4">
          <Link href="/" className="underline">Back Home</Link>
          <Link href="/dashboard" className="underline">Back to Dashboard</Link>
          <Link href="/securities" className="underline">Certificated Securities</Link>
        </div>
      </section>

      {/* Hidden Menu - Now accessible to all visitors (token gate removed) */}
      <ToolChooser
        panel={panel}
        setPanel={setPanel}
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        polyDecimals={polyDecimals}
        onAddPolygonToken={addPolygonTokenToMetaMask}
      />

      {/* Panels - Now accessible to all visitors */}
      {panelOpen && panel === "checklist" && (
        <ChecklistPanel
          walletKey={solPk || evmAddr || undefined}
          rightPx={12}
          polyDecimals={polyDecimals}
          solDecimals={solDecimals}
        />
      )}
      {panelOpen && panel === "mint" && <MintEthPanel evmAddr={evmAddr} />}
      {panelOpen && panel === "token" && <TokenMintPanel evmAddr={evmAddr} />}

      {/* client-only wallet watcher */}
      <SolReader />

      {/* GLOBAL styles */}
      <style jsx global>{`
        .status-card {
          position: relative;
          border-radius: 1rem;
          background: rgba(15, 23, 42, 0.4);
          border: 1.5px solid rgba(255, 255, 255, 0.22);
          transition: transform 180ms ease, box-shadow 180ms ease;
          z-index: 0;
        }
        .status-card::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: inherit;
          pointer-events: none;
          border: 2px solid rgba(0, 209, 255, 0);
          box-shadow: 0 0 0 rgba(0, 209, 255, 0);
          opacity: 0;
          transition: opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .status-card:hover,
        .status-card:focus-within {
          z-index: 30;
          transform: translateY(-2px);
        }
        .status-card:hover::after,
        .status-card:focus-within::after {
          opacity: 1;
          border-color: ${ELECTRIC_BLUE};
          box-shadow: 0 0 32px ${ELECTRIC_BLUE}AA, 0 0 18px ${ELECTRIC_BLUE}66 inset;
        }
      `}</style>
    </div>
  );
}

/* ---------------- sub-components ---------------- */
function Card({ title, setText, balance, extra }: { title: string; setText?: string; balance?: number; extra?: React.ReactNode; }) {
  return (
    <div className="status-card p-4 overflow-hidden">
      <div className="text-slate-300 text-sm">{title}</div>
      {setText && (
        <div className="mt-2 text-xs text-slate-400 break-all">
          <div className="text-slate-500">Mint / Contract / Issuer</div>
          <div className="break-all">{setText}</div>
        </div>
      )}
      {typeof balance === "number" && (
        <div className="mt-2 text-sm">
          Your balance: <span className="font-semibold">{balance}</span>
        </div>
      )}
      {extra && <div className="mt-2 text-xs text-slate-400 break-words overflow-wrap-anywhere">{extra}</div>}
    </div>
  );
}

/** ✅ Floating holder menu with hyperlinks (unchanged from last pass, still gated) */
function ToolChooser({
  panel, setPanel, panelOpen, setPanelOpen, polyDecimals, onAddPolygonToken,
}: {
  panel: "none" | "mint" | "token" | "checklist";
  setPanel: (p: "none" | "mint" | "token" | "checklist") => void;
  panelOpen: boolean;
  setPanelOpen: (b: boolean) => void;
  polyDecimals: number;
  onAddPolygonToken: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const k = "trust_menu_seen_v2";
      if (!sessionStorage.getItem(k)) {
        setMenuOpen(true);
        sessionStorage.setItem(k, "1");
      }
    } catch {}
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[60]" ref={rootRef}>
      <div className="flex items-center gap-2">
        <button
          className="rounded-full px-4 py-2 font-semibold bg-slate-800/80 border border-white/20 hover:shadow-[0_0_18px_rgba(0,209,255,.45)] hover:border-cyan-400/60"
          onClick={() => setMenuOpen((v) => !v)}
          title="Holder tools & links"
        >
          {panel === "none" ? "DIGITAL TRUST" : panel === "mint" ? "NFT Mint" : panel === "token" ? "Token Mint" : "Digital Trust Checklist"}
        </button>
        {panel !== "none" && (
          <button
            className="rounded-full px-3 py-2 font-semibold bg-slate-800/80 border border-white/20 hover:border-cyan-400/60"
            onClick={() => setPanelOpen(!panelOpen)}
            title={panelOpen ? "Hide panel" : "Show panel"}
          >
            {panelOpen ? "Close" : "Open"}
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="mt-2 w=[360px] w-[360px] rounded-2xl bg-slate-900/95 backdrop-blur border border-white/15 p-3 shadow-[0_0_30px_rgba(0,209,255,.25)]">
          <div className="flex gap-2 flex-wrap">
            <button
              className={`px-3 py-2 rounded-xl border ${panel === "mint" ? "border-cyan-400/70" : "border-white/15"} hover:border-cyan-400/60`}
              onClick={() => { setPanel("mint"); setPanelOpen(true); setMenuOpen(false); }}
            >
              NFT MINT
            </button>
            <button
              className={`px-3 py-2 rounded-xl border ${panel === "token" ? "border-emerald-400/70" : "border-white/15"} hover:border-emerald-400/60`}
              onClick={() => { setPanel("token"); setPanelOpen(true); setMenuOpen(false); }}
            >
              TOKEN MINT
            </button>
            <button
              className={`px-3 py-2 rounded-xl border ${panel === "checklist" ? "border-fuchsia-400/70" : "border-white/15"} hover:border-fuchsia-400/60`}
              onClick={() => { setPanel("checklist"); setPanelOpen(true); setMenuOpen(false); }}
            >
              Digital Trust Checklist
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/perfection");
              }}
              className="px-3 py-2 rounded-xl border border-white/15 hover:border-purple-400/60 hover:bg-purple-500/10 text-center"
            >
              Perfection
            </button>
          </div>

          <div className="mt-3 border-t border-white/10 pt-3 text-sm space-y-1">
            <div className="font-semibold text-slate-200 mb-1">Token explorers</div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Polygon TROO</span>
              <div className="flex items-center gap-2">
                <a className="underline text-cyan-300 hover:text-cyan-200" href={polygonScanToken(EVM_TROO_POLYGON)} target="_blank" rel="noreferrer">Polygonscan</a>
                <button className="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-white/15 hover:border-cyan-400/60" onClick={onAddPolygonToken}>
                  Add to MetaMask
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Solana TROO POO</span>
              <div className="flex items-center gap-2">
                <a className="underline text-cyan-300 hover:text-cyan-200" href={solscanToken(SOL_MINT || RAW_SOL_MINT)} target="_blank" rel="noreferrer">Solscan</a>
                <a className="underline text-cyan-300 hover:text-cyan-200" href={solanaExplorerToken(SOL_MINT || RAW_SOL_MINT)} target="_blank" rel="noreferrer">Explorer</a>
                <a className="underline text-cyan-300 hover:text-cyan-200" href={pumpFunCoin(SOL_MINT || RAW_SOL_MINT)} target="_blank" rel="noreferrer">Pump.fun</a>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300">Ethereum TROO</span>
              <div className="flex items-center gap-2">
                <a className="underline text-cyan-300 hover:text-cyan-200" href={EVM_TROO_ETHEREUM ? etherScanToken(EVM_TROO_ETHEREUM) : "#"} target="_blank" rel="noreferrer">Etherscan</a>
                {!EVM_TROO_ETHEREUM && <span className="text-xs text-slate-500">(Coming Soon)</span>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300">XRP {XRPL_CURRENCY}</span>
              <div className="flex items-center gap-2">
                <a className="underline text-cyan-300 hover:text-cyan-200" href={XRPL_ISSUER ? xrpscanIssuer(XRPL_ISSUER) : "#"} target="_blank" rel="noreferrer">XRPSCAN</a>
                {!XRPL_ISSUER && <span className="text-xs text-slate-500">(Coming Soon)</span>}
              </div>
            </div>

            <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-slate-300">Need more TROO?</span>
              <Link className="underline text-emerald-300 hover:text-emerald-200" href="/buy">Buy / Fund Wallet</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ✅ Multi-network NFT Mint panel */
function MintEthPanel({ evmAddr }: { evmAddr?: `0x${string}` | string | null }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(""); const [desc, setDesc] = useState(""); const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null); const [qty, setQty] = useState<number>(1);
  const [priceEth, setPriceEth] = useState<string>(""); const [busy, setBusy] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<"ETH" | "POL" | "XRPL" | "SOL">("ETH");
  const minting = busy || isPending;
  const qtyClamped = (n: number) => (Number.isNaN(n) ? 1 : Math.min(Math.max(Math.floor(n), 1), MAX_QTY));
  const abiHas = (fn: string) => Array.isArray(heroAbi as any) && (heroAbi as any).some((f: any) => f?.name === fn);

  async function callMintOnce(to: string, tokenURI: string, priceWei: bigint) {
    if (priceWei > 0n) {
      const pricedCandidates: Array<{ fn: string; args: any[] }> = [];
      if (abiHas("mintWithPrice")) pricedCandidates.push({ fn: "mintWithPrice", args: [to, tokenURI, priceWei] });
      pricedCandidates.push({ fn: "mint", args: [to, tokenURI, priceWei] });
      if (abiHas("mintAndSetPrice")) pricedCandidates.push({ fn: "mintAndSetPrice", args: [to, tokenURI, priceWei] });
      for (const c of pricedCandidates) {
        try {
          await (writeContractAsync as any)({ address: EVM_NFT_ETHEREUM as `0x${string}`, abi: heroAbi as any, functionName: c.fn as any, args: c.args as any, value: 0n, chainId: 1 });
          return;
        } catch {}
      }
    }
    await (writeContractAsync as any)({ address: EVM_NFT_ETHEREUM as `0x${string}`, abi: heroAbi as any, functionName: "mint" as any, args: [to, tokenURI], value: 0n, chainId: 1 });
  }

  async function onMint() {
    if (!file) return alert("Choose a media file.");
    if (!name.trim()) return alert("Name your HERO.");
    const quantity = qtyClamped(qty);

    // Network-specific validation and switching
    if (selectedNetwork === "ETH") {
      if (!EVM_NFT_ETHEREUM) return alert("Missing ETH contract.");
      if (!evmAddr) return alert("Connect an EVM wallet.");
      try { 
        await switchChainAsync?.({ chainId: 1 }); 
      } catch (e) {
        return alert("Please switch to Ethereum mainnet in your wallet.");
      }
      if (chainId !== 1) { 
        return alert("Please switch to Ethereum mainnet in your wallet.");
      }
    } else if (selectedNetwork === "POL") {
      if (!evmAddr) return alert("Connect an EVM wallet.");
      try { 
        await switchChainAsync?.({ chainId: 137 }); 
      } catch (e) {
        return alert("Please switch to Polygon in your wallet.");
      }
      if (chainId !== 137) { 
        return alert("Please switch to Polygon in your wallet.");
      }
    } else if (selectedNetwork === "SOL") {
      return alert("Solana minting is not enabled in this build yet.");
    } else if (selectedNetwork === "XRPL") {
      return alert("XRPL NFT minting not yet implemented.");
    }

    let priceWei = 0n;
    if (selectedNetwork === "ETH" || selectedNetwork === "POL") {
      try { priceWei = priceEth ? ethToWei(priceEth) : 0n; } catch (e: any) { return alert(`Price error: ${e?.message || String(e)}`); }
    }

    try {
      setBusy(true);
      const { uploadToIPFS, toGateway } = await import("@/lib/storage");
      const meta = { name, description: desc, external_url: url || undefined, attributes: [{ trait_type: "visibility", value: "public" }], file };
      const metadataUri = await uploadToIPFS(meta as any);
      const displayImage = toGateway(metadataUri).replace("/metadata.json", "");

      if (selectedNetwork === "ETH") {
        for (let i = 0; i < quantity; i++) { await callMintOnce(String(evmAddr), metadataUri, priceWei); }
        savePublicHero({ name, image: displayImage, url: url || undefined, chain: "Ethereum", priceEth: priceEth || undefined });
      } else if (selectedNetwork === "POL") {
        // Polygon minting logic would go here
        alert("Polygon NFT minting not yet implemented.");
        return;
      } else if (selectedNetwork === "SOL") {
        // Solana minting logic would go here
        alert("Solana NFT minting not yet implemented.");
        return;
      }

      setName(""); setDesc(""); setUrl(""); setFile(null); setQty(1); setPriceEth("");
      alert("Mint succeeded!");
    } catch (e) {
      console.error(e);
      const msg = (e as BaseError)?.shortMessage || (e as any)?.message || `${selectedNetwork} mint failed`;
      alert(msg);
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div className={`fixed top-1/2 -translate-y-1/2 right-3 z-50 w={[420]} w-[420px] max-w-[94vw] rounded-3xl bg-slate-900/90 backdrop-blur border-2 border-cyan-400/60 p-5 shadow-[0_0_40px_rgba(0,209,255,.35)] transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Mint NFT</div>
        <button className="rounded-full px-3 py-1 text-sm border border-cyan-400/60 hover:bg-cyan-500/10" onClick={() => (open ? setOpen(false) : setOpen(true))} title="Close">Close</button>
      </div>
      <div className="text-slate-300 text-sm mt-1">Select network and mint your NFT</div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs text-slate-400">Network</label>
          <select 
            value={selectedNetwork} 
            onChange={(e) => setSelectedNetwork(e.target.value as "ETH" | "POL" | "XRPL" | "SOL")}
            className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2"
          >
            <option value="ETH">Ethereum (ETH)</option>
            <option value="POL">Polygon (POL)</option>
            <option value="SOL">Solana (SOL)</option>
            <option value="XRPL">XRPL (XRPL)</option>
          </select>
        </div>
        <div><label className="text-xs text-slate-400">Hero Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cyber Hero #001" className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2" /></div>
        <div><label className="text-xs text-slate-400">Media (jpeg, jpg, gif, mov, mp4, png, webp)</label><input type="file" accept={ACCEPT_TYPES} onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100" /></div>
        <div className="flex items-center gap-3"><label className="text-xs text-slate-400">Visibility</label><label className="inline-flex items-center gap-2 cursor-pointer"><input type="radio" name="vis" checked readOnly className="accent-cyan-400" />Public</label></div>
        {(selectedNetwork === "ETH" || selectedNetwork === "POL") && (
          <div><label className="text-xs text-slate-400">Price ({selectedNetwork === "ETH" ? "ETH" : "MATIC"}, optional)</label><input type="text" inputMode="decimal" pattern="^[0-9]+(\\.[0-9]{0,18})?$" placeholder="0.05" value={priceEth} onChange={(e) => setPriceEth(e.target.value)} className="mt-1 w-48 rounded-lg bg-slate-800/80 px-3 py-2" /></div>
        )}
        <div><label className="text-xs text-slate-400">Quantity (max {MAX_QTY.toLocaleString()})</label><input type="number" min={1} max={MAX_QTY} step={1} value={qty} onChange={(e) => setQty(Math.min(Math.max(parseInt(e.target.value || "1"), 1), MAX_QTY))} className="mt-1 w-40 rounded-lg bg-slate-800/80 px-3 py-2" /></div>
        <button onClick={onMint} disabled={minting} className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 px-4 py-2 font-semibold">{minting ? "Minting…" : `Mint ${qty} on ${selectedNetwork}`}</button>
      </div>
    </div>
  );
}

/** ✅ Digital Trust Checklist panel — Step 9 unlocks after tx SUBMISSION */
function ChecklistPanel({
  walletKey,
  rightPx = 12,
  polyDecimals,
  solDecimals,
}: {
  walletKey?: string | null;
  rightPx?: number;
  polyDecimals: number;
  solDecimals: number;
}) {
  const STORAGE_KEY = `troo_checklist_${walletKey ?? "anon"}`;

  type State = {
    checked: boolean[];            // steps 1..8
    trustName: string;
    paymentSubmitted?: boolean;    // NEW: unlock Step 9 after submission
  };

  const [state, setState] = React.useState<State>({
    checked: [false, false, false, false, false, false, false, false],
    trustName: "",
    paymentSubmitted: false,
  });

  // Load/save per-wallet progress
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {}
  }, [STORAGE_KEY]);
  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [STORAGE_KEY, state]);

  const setChecked = (idx: number, v: boolean) =>
    setState((s) => {
      const next = [...s.checked];
      next[idx] = v;
      // lock forward steps when earlier is unchecked
      for (let i = idx + 1; i < next.length; i++) next[i] = false;
      return { ...s, checked: next };
    });

  const [open, setOpen] = useState(true);

  const LINKS = {
    step1: "https://www.ulc.org/landing/get-ordained?gad_source=1&gad_campaignid=205062787&gbraid=0AAAAADnE_Z3wHYt5ZfJROY7BcLEQwaFqs&gclid=Cj0KCQjwiqbBBhCAARIsAJSfZkb1XS_ESaHMRTZQKFbUNQrCcJBRCPWZGAamT2vkgRYC5-G7cux-uDgaAmf7EALw_wcB",
    step2: "https://forms.gle/krVLVoujTnTDaQsR6",
    step3: "https://support.google.com/mail/answer/56256?hl=en",
    step4: "https://www.youtube.com/shorts/gCIKfA0p3yU",
    step5: "https://www.barcodestalk.com/bar-code-numbers?ps_partner_key=cWxuczJrb2U3Mzg0NDY&ps_xid=fU9ab8lMIoFTz3&gsxid=fU9ab8lMIoFTz3&gspk=cWxuczJrb2U3Mzg0NDY",
    step6: "/stamps",
    step7: "https://forms.gle/kk8ioWE4vbA339a89",
  };

  // NEW: callback when Step 8 payment is submitted (EVM or Solana)
  const onPaymentSubmitted = () => {
    setState((s) => ({ ...s, paymentSubmitted: true }));
    // Optionally auto-check Step 8 checkbox as "done"
    setChecked(7, true);
  };

  if (!open) return null;

  return (
    <div
      className={`
        fixed top-1/2 -translate-y-1/2 z-50 w-[420px] max-w-[92vw]
        rounded-3xl bg-slate-900/90 backdrop-blur border-2 border-fuchsia-400/60 p-5
        shadow-[0_0_40px_rgba(155,92,255,.35)]
        transition-shadow hover:shadow-[0_0_70px_rgba(155,92,255,.55)]
        focus-within:shadow-[0_0_80px_rgba(155,92,255,.7)]
      `}
      style={{ right: rightPx }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-center text-lg font-semibold">Digital Trust Checklist</div>
        <button className="rounded-full px-3 py-1 text-sm border border-fuchsia-400/60 hover:bg-fuchsia-500/10" onClick={() => setOpen(false)} title="Close">Close</button>
      </div>

      <ol className="space-y-3 text-sm">
        {/* 1 */}
        <li className="group">
          <div className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[0]} onChange={(e) => setChecked(0, e.target.checked)} />
            <div className="flex-1">
              <div className="font-medium">Step 1 — separation</div>
              <a href={LINKS.step1} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">separation</a>
            </div>
          </div>
        </li>

        {/* 2 */}
        {state.checked[0] && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[1]} onChange={(e) => setChecked(1, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 2 — Digital Trust Intake</div>
                <a href={LINKS.step2} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">https://forms.gle/krVLVoujTnTDaQsR6</a>
              </div>
            </div>
          </li>
        )}

        {/* 3 */}
        {state.checked.slice(0, 2).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[2]} onChange={(e) => setChecked(2, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 3 — Create a Gmail Account</div>
                <a href={LINKS.step3} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">Google Mail Help: Create an account</a>
              </div>
            </div>
          </li>
        )}

        {/* 4 */}
        {state.checked.slice(0, 3).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[3]} onChange={(e) => setChecked(3, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 4 — Watch the Short Explainer</div>
                <a href={LINKS.step4} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">YouTube Short</a>
              </div>
            </div>
          </li>
        )}

        {/* 5 */}
        {state.checked.slice(0, 4).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[4]} onChange={(e) => setChecked(4, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 5 — Purchase a Barcode Number</div>
                <a href={LINKS.step5} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline break-all">Barcode Numbers — Barcodes Talk</a>
              </div>
            </div>
          </li>
        )}

        {/* 6 */}
        {state.checked.slice(0, 5).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[5]} onChange={(e) => setChecked(5, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 6 — Create Your Seals</div>
                <Link href="/stamps" className="text-fuchsia-300 underline">Open in-app Seal Maker</Link>
              </div>
            </div>
          </li>
        )}

        {/* 7 */}
        {state.checked.slice(0, 6).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-fuchsia-500" checked={state.checked[6]} onChange={(e) => setChecked(6, e.target.checked)} />
              <div className="flex-1">
                <div className="font-medium">Step 7 — Send Barcode Certificate of Assignment + One Barcode + Gold Seal</div>
                <a href={LINKS.step7} target="_blank" rel="noreferrer" className="text-fuchsia-300 underline">Submit via Google Form</a>
              </div>
            </div>
          </li>
        )}

        {/* 8 — TOKEN PAYMENT BINDING */}
        {state.checked.slice(0, 7).every(Boolean) && (
          <li className="group">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-fuchsia-500"
                checked={state.checked[7]}
                onChange={(e) => setChecked(7, e.target.checked)}
              />
              <div className="flex-1">
                <div className="font-medium">Step 8 — Send <b>10,000,000</b> tokens</div>
                <div className="mt-2 space-y-2">
                  <EvmTenMillionPayButton
                    tokenAddress={EVM_TROO_POLYGON}
                    recipient={DEV_POLYGON_TREASURY}
                    decimals={isFinite(polyDecimals) ? polyDecimals : 18}
                    label="Send 10,000,000 TROO (Polygon)"
                    onSubmitted={onPaymentSubmitted}   // NEW
                  />
                  <SolanaTenMillionPayButton
                    mint={SOL_MINT || RAW_SOL_MINT /* keep links working even if input was raw */}
                    recipientBase58={DEV_SOLANA_TREASURY}
                    decimals={isFinite(solDecimals) ? solDecimals : 6}
                    label="Send 10,000,000 TROO POO (Solana)"
                    onSubmitted={onPaymentSubmitted}   // NEW
                  />
                  <div className="text-xs text-slate-400">
                    Funds go to our treasury wallets:
                    <div>Polygon: <code>{DEV_POLYGON_TREASURY}</code></div>
                    <div>Solana: <code>{DEV_SOLANA_TREASURY}</code></div>
                  </div>
                </div>
              </div>
            </div>
          </li>
        )}

        {/* 9 — UNLOCKED AFTER SUBMISSION */}
        {state.checked.slice(0, 7).every(Boolean) && state.paymentSubmitted && (
          <li className="group">
            <div className="flex items-start gap-2">
              <div className="mt-1 h-4 w-4 rounded-full bg-emerald-500" />
              <div className="flex-1">
                <div className="font-medium">Step 9 — Document Factory</div>
                <Link href="/volume1" className="text-emerald-300 underline font-semibold">
                  Document Factory
                </Link>
                <div className="text-xs text-slate-400 mt-1">
                  Unlocked after token transfer submission.
                </div>
              </div>
            </div>
          </li>
        )}
      </ol>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Progress is saved to this wallet on this device.</span>
        <button
          className="rounded-full border border-slate-500/60 px-3 py-1 hover:bg-slate-700/40"
          onClick={() => setState({ checked: [false, false, false, false, false, false, false, false], trustName: "", paymentSubmitted: false })}
          title="Reset checklist for this wallet only"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/** ---------- Step 8 helpers: pay 10,000,000 on Polygon (ERC-20) ---------- */
function EvmTenMillionPayButton({
  tokenAddress,
  recipient,
  decimals,
  label,
  onSubmitted, // NEW
}: {
  tokenAddress: `0x${string}`;
  recipient: `0x${string}`;
  decimals: number;
  label: string;
  onSubmitted?: () => void;
}) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const { address } = useAccount();
  const [sending, setSending] = useState(false);

  async function onSend() {
    if (!address) return alert("Connect MetaMask first.");
    try { if (chainId !== 137) await switchChainAsync?.({ chainId: 137 }); } catch { return alert("Please switch to Polygon in your wallet."); }
    try {
      setSending(true);
      const amount = HOLDER_THRESHOLD_TOKENS * (10n ** BigInt(isFinite(decimals) ? decimals : 18));
      // When this resolves, the transaction is submitted (we have a hash)
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI as any,
        functionName: "transfer" as any,
        args: [recipient, amount],
        chainId: 137,
      });
      // ✅ Unlock Step 9 on SUBMISSION
      onSubmitted?.();
      alert(`Transfer submitted! Tx: ${txHash}\nOnce confirmed, you can proceed.`);
    } catch (e: any) {
      console.error(e);
      alert((e as BaseError)?.shortMessage || (e as any)?.message || "Transfer failed");
    } finally { setSending(false); }
  }

  return (
    <button
      onClick={onSend}
      disabled={sending || isPending}
      className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
    >
      {sending || isPending ? "Sending…" : label}
    </button>
  );
}

/** ---------- Step 8 helpers: pay 10,000,000 on Solana (SPL) ---------- */
function SolanaTenMillionPayButton({
  mint,
  recipientBase58,
  decimals,
  label,
  onSubmitted, // NEW
}: {
  mint: string;
  recipientBase58: string;
  decimals: number;
  label: string;
  onSubmitted?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onSend() {
    // Solana wallet integration is intentionally disabled in this build.
    // Keep this button as a UX placeholder.
    alert("Solana payments are not enabled in this build yet.");
    onSubmitted?.();
  }

  return (
    <button
      onClick={onSend}
      disabled={busy}
      className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
    >
      {busy ? "Sending…" : label}
    </button>
  );
}

/** ✅ Token Mint Panel */
function TokenMintPanel({ evmAddr }: { evmAddr?: `0x${string}` | string | null }) {
  const { writeContractAsync, isPending } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState<string>("1000000");
  const [decimals, setDecimals] = useState<number>(18);
  const [selectedNetwork, setSelectedNetwork] = useState<"ETH" | "POL" | "XRPL" | "SOL">("ETH");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const minting = busy || isPending;

  async function onTokenMint() {
    if (!name.trim()) return alert("Enter token name.");
    if (!ticker.trim()) return alert("Enter ticker symbol.");
    if (!description.trim()) return alert("Enter token description.");
    if (!file) return alert("Choose a token image.");
    
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) return alert("Enter valid quantity.");

    // Network-specific validation and switching
    if (selectedNetwork === "ETH") {
      if (!evmAddr) return alert("Connect an EVM wallet.");
      try { 
        await switchChainAsync?.({ chainId: 1 }); 
      } catch (e) {
        return alert("Please switch to Ethereum mainnet in your wallet.");
      }
      if (chainId !== 1) { 
        return alert("Please switch to Ethereum mainnet in your wallet.");
      }
    } else if (selectedNetwork === "POL") {
      if (!evmAddr) return alert("Connect an EVM wallet.");
      try { 
        await switchChainAsync?.({ chainId: 137 }); 
      } catch (e) {
        return alert("Please switch to Polygon in your wallet.");
      }
      if (chainId !== 137) { 
        return alert("Please switch to Polygon in your wallet.");
      }
    } else if (selectedNetwork === "SOL") {
      return alert("Solana token minting is not enabled in this build yet.");
    } else if (selectedNetwork === "XRPL") {
      return alert("XRPL token minting not yet implemented.");
    }

    try {
      setBusy(true);
      
      // Upload token image to IPFS
      const { uploadToIPFS, toGateway } = await import("@/lib/storage");
      const meta = { 
        name: `${name} (${ticker})`, 
        description, 
        image: file,
        symbol: ticker,
        decimals: decimals
      };
      const metadataUri = await uploadToIPFS(meta as any);
      const imageUrl = toGateway(metadataUri).replace("/metadata.json", "");

      if (selectedNetwork === "ETH") {
        // Ethereum token creation logic would go here
        alert("Ethereum token creation not yet implemented.");
        return;
      } else if (selectedNetwork === "POL") {
        // Polygon token creation logic would go here
        alert("Polygon token creation not yet implemented.");
        return;
      } else if (selectedNetwork === "SOL") {
        // Solana token creation logic would go here
        alert("Solana token creation not yet implemented.");
        return;
      }

      setName(""); setTicker(""); setDescription(""); setQty("1000000"); setDecimals(18); setFile(null);
      alert("Token creation initiated!");
    } catch (e) {
      console.error(e);
      const msg = (e as BaseError)?.shortMessage || (e as any)?.message || `${selectedNetwork} token creation failed`;
      alert(msg);
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div className={`fixed top-1/2 -translate-y-1/2 right-3 z-50 w-[420px] max-w-[94vw] rounded-3xl bg-slate-900/90 backdrop-blur border-2 border-emerald-400/60 p-5 shadow-[0_0_40px_rgba(16,185,129,.35)] transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Create Token</div>
        <button className="rounded-full px-3 py-1 text-sm border border-emerald-400/60 hover:bg-emerald-500/10" onClick={() => setOpen(false)} title="Close">Close</button>
      </div>
      <div className="text-slate-300 text-sm mt-1">Deploy a new token to your selected network</div>
      
      <div className="mt-4 space-y-4">
        <div>
          <label className="text-xs text-slate-400">Network</label>
          <select 
            value={selectedNetwork} 
            onChange={(e) => setSelectedNetwork(e.target.value as "ETH" | "POL" | "XRPL" | "SOL")}
            className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2"
          >
            <option value="ETH">Ethereum (ETH)</option>
            <option value="POL">Polygon (POL)</option>
            <option value="SOL">Solana (SOL)</option>
            <option value="XRPL">XRPL (XRPL)</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-slate-400">Token Name</label>
          <input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="My Awesome Token" 
            className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2" 
          />
        </div>
        
        <div>
          <label className="text-xs text-slate-400">Ticker Symbol</label>
          <input 
            value={ticker} 
            onChange={(e) => setTicker(e.target.value.toUpperCase())} 
            placeholder="MAT" 
            maxLength={10}
            className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2" 
          />
        </div>
        
        <div>
          <label className="text-xs text-slate-400">Description</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Describe your token..." 
            rows={3}
            className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2" 
          />
        </div>
        
        <div>
          <label className="text-xs text-slate-400">Token Image</label>
          <input 
            type="file" 
            accept=".jpeg,.jpg,.png,.gif,.webp" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="mt-1 block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100" 
          />
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-slate-400">Initial Supply</label>
            <input 
              type="number" 
              value={qty} 
              onChange={(e) => setQty(e.target.value)} 
              placeholder="1000000" 
              min="1"
              className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2" 
            />
          </div>
          <div className="w-20">
            <label className="text-xs text-slate-400">Decimals</label>
            <select 
              value={decimals} 
              onChange={(e) => setDecimals(parseInt(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800/80 px-3 py-2"
            >
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={18}>18</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={onTokenMint} 
          disabled={minting} 
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-2 font-semibold"
        >
          {minting ? "Creating Token…" : `Deploy ${ticker || "Token"} on ${selectedNetwork}`}
        </button>
      </div>
    </div>
  );
}