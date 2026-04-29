"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import MobileWalletButton from "@/components/MobileWalletButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  accountAssetToTrustRecordsAsset,
  deleteAccountAsset,
  loadAccountAssets,
  setLastActiveAccountId,
  subscribeAccountAssets,
  trustRecordsAssetToAccountAsset,
  upsertAccountAsset,
} from "@/lib/accountAssets";
import { createTrust, isUuidLike, loadLatestTrustDraft, saveTrustDraft } from "@/lib/trusts/client";
import {
  ArrowLeft,
  FilePlus2,
  ShieldCheck,
  FileSignature,
  Database,
  Stamp,
  Image as ImageIcon,
  ClipboardList,
  Scale,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Hash,
  Trash2,
  Landmark,
} from "lucide-react";

/**
 * Trust Certificates Console (single-file TSX)
 *
 * What this is:
 * - Front-end console to issue trust certificates (unitized interests), record minutes, create resolutions and amendments,
 *   and maintain Asset + Certificate registries.
 * - Seal + watermark upload, applied to certificate rendering.
 *
 * What this is NOT:
 * - A legal validation engine; it cannot determine whether an issuance is lawful for a given trust.
 * - A securities compliance layer.
 *
 * Storage:
 * - Uses localStorage for a self-contained demo. Swap `store` with API calls for production.
 */

// -----------------------------
// Types
// -----------------------------

type UUID = string;

type AssetType =
  | "Cash"
  | "Real Estate"
  | "Security"
  | "Promissory Note"
  | "Digital Asset"
  | "Intellectual Property"
  | "Other";

type Asset = {
  id: UUID;
  type: AssetType;
  name: string;
  identifier?: string; // serial, deed, wallet address, etc.
  valuationUSD?: number;
  valuationAsOf?: string; // ISO date
  encumbrances?: string;
  evidenceNotes?: string;
  createdAt: string;
};

type CertificateStatus = "Active" | "Voided" | "Transferred";

type XrplIouAnchor = {
  txHash: string;
  currency: string;
  amount: string;
  recipient: string;
  issuer: string;
  memo?: string;
  issuedAt: string;
};

// -----------------------------
// Token Gate (matches /meet)
// -----------------------------

const HERO_1155_CONTRACT = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as `0x${string}`;
const HERO_1155_TOKEN_IDS = [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]; // expanded range to check more token IDs

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

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Polygon JSON-RPC helpers (multi-fallback) — copied/simplified from `/trust`
const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/polygon",
  "https://polygon-rpc.com",
  "https://polygon.llamarpc.com",
  "https://poly-rpc.gateway.pokt.network",
  "https://polygon.gateway.tenderly.co",
  "https://polygon-mainnet.blastapi.io",
].filter(Boolean);

function _pad32(hexNo0x: string) {
  return hexNo0x.toLowerCase().padStart(64, "0");
}
function _encodeBalanceOf(addr: string) {
  const selector = "70a08231";
  const addrNo0x = addr.replace(/^0x/i, "");
  return ("0x" + selector + _pad32(addrNo0x)) as `0x${string}`;
}

async function _ethCallPolygonSmart(
  to: string,
  data: `0x${string}`
): Promise<{ result: `0x${string}`; notes: string[] }> {
  const notes: string[] = [];
  for (const url of POLYGON_RPC_CANDIDATES) {
    try {
      const body = {
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1e6),
        method: "eth_call",
        params: [{ to, data }, "latest"],
      };
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        notes.push(`RPC ${url} → HTTP ${r.status}`);
        continue;
      }
      const j = await r.json();
      if ((j as any)?.error) {
        notes.push(`RPC ${url} → ${String((j as any)?.error?.message || "error")}`);
        continue;
      }
      const res = (j as any)?.result as `0x${string}`;
      if (typeof res === "string") {
        notes.push(`RPC ${url} → ok`);
        return { result: res, notes };
      }
      notes.push(`RPC ${url} → empty`);
    } catch (e: any) {
      notes.push(`RPC ${url} → ${String(e?.message || e)}`);
    }
  }
  throw new Error(notes.join(" | "));
}

async function _readPolygonDecimals(contract: string): Promise<{ value: number; notes: string[] }> {
  try {
    const { result, notes } = await _ethCallPolygonSmart(contract, "0x313ce567");
    return { value: Number(BigInt(result)), notes };
  } catch (e: any) {
    return { value: 18, notes: [`decimals fallback to 18 (${String(e?.message || e)})`] };
  }
}

async function _readPolygonBalance(contract: string, addr: string) {
  const { result, notes } = await _ethCallPolygonSmart(contract, _encodeBalanceOf(addr));
  return { value: BigInt(result || "0x0"), notes };
}

type Certificate = {
  id: UUID;
  serialNumber: string;
  issuedAt: string;
  denominationUSD: number; // UI uses USD denomination; you can model this as Units instead.
  ownerName: string;
  notes?: string;
  status: CertificateStatus;
  backingAssetIds: UUID[];
  // Digital signing / audit
  documentHash: string; // SHA-256 of the canonical payload
  signedBy?: string; // trustee name / key id
  signatureHint?: string; // placeholder for integration (e.g., DocuSign envelope id)
  signedAt?: string;
  signatureHash?: string;
  // NEW: optional seal uploaded after signature (per-certificate)
  signatureSealDataUrl?: string;
  // Optional on-chain IOU issuance anchor
  xrplIou?: XrplIouAnchor;
};

type MinuteKind = "Minutes" | "Resolution" | "Amendment";

type MinuteRecord = {
  id: UUID;
  kind: MinuteKind;
  title: string;
  meetingDate: string; // ISO date
  body: string;
  relatedCertificateIds: UUID[];
  relatedAssetIds: UUID[];
  adoptedBy: string; // Board / Trustees
  createdAt: string;
  hash: string;
};

type MeetingRecord = {
  id: UUID;
  title: string;
  meetingDate: string; // ISO date
  attendees: string;
  location: string;
  agenda: string;
  notes: string;
  resolutions: string;
  sealDataUrl?: string;
  watermarkDataUrl?: string;
  qrDataUrl?: string;
  barcodeDataUrl?: string;
  noticeQrDataUrl?: string;
  renderData?: string; // PDF preview image
  createdAt: string;
};

type EntityType =
  | "Trust"
  | "LLC"
  | "Corporation"
  | "Partnership"
  | "Foundation"
  | "Nonprofit"
  | "Estate"
  | "Sole Proprietorship"
  | "Grantor"
  | "Other";

type TrustConfig = {
  entityType: EntityType;
  entityName: string;
  unitsAuthorized?: number; // e.g., 100
  certificatePrefix: string; // e.g., "TTC"
  sealDataUrl?: string; // uploaded image
  watermarkDataUrl?: string; // uploaded image
  qrDataUrl?: string; // lower-left QR
  barcodeDataUrl?: string; // lower-center barcode
  noticeQrDataUrl?: string; // lower-right QR
  assetAddressUrl?: string; // hyperlink displayed under certificate
  barcodeOpacity?: number;
  watermarkOpacity: number; // 0..1
  watermarkScale: number; // 0.1..2
  watermarkRotateDeg: number; // -45..45
  trusteesDisplayName: string; // for signature line
};

// -----------------------------
// Utilities
// -----------------------------

function nowIso() {
  return new Date().toISOString();
}

function isoDateOnly(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function uuid(): UUID {
  // browser-safe quick uuid
  return (globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}_${Date.now()}`) as UUID;
}

function pad(n: number, width = 6) {
  return String(n).padStart(width, "0");
}

function canonicalJson(obj: any) {
  // Deterministic-ish JSON: sort keys shallowly; for production use a true canonicalization scheme.
  const sortKeys = (x: any): any => {
    if (Array.isArray(x)) return x.map(sortKeys);
    if (x && typeof x === "object") {
      return Object.keys(x)
        .sort()
        .reduce((acc: any, k) => {
          acc[k] = sortKeys(x[k]);
          return acc;
        }, {});
    }
    return x;
  };
  return JSON.stringify(sortKeys(obj));
}

async function sha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function displayEntityName(config: TrustConfig) {
  const name = (config.entityName || "").trim();
  return name || "Entity Name";
}

// -----------------------------
// Local storage persistence
// -----------------------------

const STORE_KEY = "trust_console_v1";
const MAX_INLINE_IMAGE_BYTES = 300_000; // avoid blowing localStorage with large data URLs
const MAX_UPLOAD_BYTES = 2_000_000; // allow up to ~2MB uploads for seal/watermark/QRs

const deferIdle = (fn: () => void) => {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(fn, { timeout: 1000 });
  } else {
    setTimeout(fn, 0);
  }
};

type StoreState = {
  config: TrustConfig;
  assets: Asset[];
  certificates: Certificate[];
  minutes: MinuteRecord[];
  meetings: MeetingRecord[];
  serialCounter: number;
};

const defaultStore: StoreState = {
  config: {
    entityType: "Trust",
    entityName: "Trust Name Here",
    unitsAuthorized: 100,
    certificatePrefix: "TTC",
    sealDataUrl: undefined,
    watermarkDataUrl: undefined,
    qrDataUrl: undefined,
    barcodeDataUrl: undefined,
    noticeQrDataUrl: undefined,
    assetAddressUrl: "",
    barcodeOpacity: 1,
    watermarkOpacity: 0.12,
    watermarkScale: 1,
    watermarkRotateDeg: 0,
    trusteesDisplayName: "Board of Trustees",
  },
  assets: [],
  certificates: [],
  minutes: [],
  meetings: [],
  serialCounter: 1,
};

function pruneDataUrl(dataUrl?: string) {
  if (!dataUrl) return undefined;
  return dataUrl.length > MAX_INLINE_IMAGE_BYTES ? undefined : dataUrl;
}

function loadStore(): StoreState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore;
    const parsed = JSON.parse(raw);
    return {
      ...defaultStore,
      ...parsed,
      config: { ...defaultStore.config, ...(parsed.config ?? {}) },
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
      minutes: Array.isArray(parsed.minutes) ? parsed.minutes : [],
      meetings: Array.isArray(parsed.meetings) ? parsed.meetings : [],
      serialCounter: typeof parsed.serialCounter === "number" ? parsed.serialCounter : 1,
    };
  } catch {
    return defaultStore;
  }
}

function saveStore(state: StoreState) {
  try {
    // Persist without inline image blobs to avoid long blocking tasks/quota issues.
    const pruned: StoreState = {
      ...state,
      config: {
        ...state.config,
        sealDataUrl: undefined,
        watermarkDataUrl: undefined,
        qrDataUrl: undefined,
        barcodeDataUrl: undefined,
        noticeQrDataUrl: undefined,
      },
    };
    setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(pruned));
      } catch (err) {
        console.warn("Failed to persist trust console locally; continuing in-memory", err);
      }
    }, 0);
  } catch (err) {
    // Ignore quota errors; keep in-memory state and server autosave.
    console.warn("Failed to persist trust console locally; continuing in-memory", err);
  }
}

// -----------------------------
// Certificate renderer (HTML)
// -----------------------------

function CertificatePreview({
  config,
  certificate,
  assets,
}: {
  config: TrustConfig;
  certificate: Certificate;
  assets: Asset[];
}) {
  const backingAssets = assets.filter((a) => certificate.backingAssetIds.includes(a.id));

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-sm">
      {/* watermark */}
      {config.watermarkDataUrl ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ opacity: config.watermarkOpacity }}
        >
          <img
            alt="Watermark"
            src={config.watermarkDataUrl}
            className="select-none"
            style={{
              transform: `scale(${config.watermarkScale}) rotate(${config.watermarkRotateDeg}deg)`,
              maxWidth: "80%",
              maxHeight: "80%",
            }}
          />
        </div>
      ) : null}

      <div className="relative p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">Trust Certificate</div>
            <div className="mt-1 text-2xl font-semibold">{displayEntityName(config)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="border-purple-500 bg-purple-50 text-purple-700">{config.entityType}</Badge>
              <Badge variant="secondary">Serial: {certificate.serialNumber}</Badge>
              <Badge variant={certificate.status === "Active" ? "default" : "secondary"}>{certificate.status}</Badge>
              <Badge className="border-purple-500 bg-purple-50 text-purple-700">Issued: {certificate.issuedAt.slice(0, 10)}</Badge>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {config.sealDataUrl ? (
              <div className="flex items-center gap-2">
                <Stamp className="h-4 w-4 text-slate-600" />
                <img alt="Seal" src={config.sealDataUrl} className="h-16 w-16 rounded-full border object-cover" />
              </div>
            ) : (
              <div className="text-xs text-slate-500">No seal uploaded</div>
            )}
            <div className="text-right">
              <div className="text-xs text-slate-500">Denomination</div>
              <div className="text-xl font-semibold">{money(certificate.denominationUSD)}</div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-slate-700">Beneficial Owner</div>
            <div className="mt-1 text-lg font-semibold">{certificate.ownerName}</div>
            <div className="mt-3 text-xs text-slate-600">
              This certificate evidences a beneficial interest as defined by the Trust’s governing instrument and minutes. It
              conveys no managerial authority unless expressly granted.
            </div>
            {config.assetAddressUrl ? (
              <div className="mt-3 text-xs">
                <a
                  href={config.assetAddressUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-500 underline font-semibold"
                >
                  Asset Address
                </a>
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700">Asset Backing (Referenced)</div>
            <div className="mt-2 space-y-2">
              {backingAssets.length ? (
                backingAssets.map((a) => (
                  <div key={a.id} className="rounded-xl border bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 break-words font-medium">{a.name}</div>
                      <div className="shrink-0 text-right text-sm text-slate-700 whitespace-nowrap">
                        {a.valuationUSD ? money(a.valuationUSD) : "—"}
                    </div>
                    </div>
                    <div className="mt-1 break-words text-xs text-slate-600">
                      {a.type}
                      {a.identifier ? ` • ${a.identifier}` : ""}
                      {a.valuationAsOf ? ` • as of ${a.valuationAsOf}` : ""}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600">No backing assets linked.</div>
              )}
            </div>
          </div>
        </div>

        {certificate.notes ? (
          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700">Notes</div>
            <div className="mt-2 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">{certificate.notes}</div>
          </div>
        ) : null}

        {certificate.xrplIou ? (
          <div className="mt-6">
            <div className="text-sm font-medium text-slate-700">XRPL IOU Issuance</div>
            <div className="mt-2 grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-3 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Amount</div>
                <div className="font-semibold">
                  {certificate.xrplIou.amount} {certificate.xrplIou.currency}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Recipient</div>
                <div className="break-all font-mono text-xs">{certificate.xrplIou.recipient}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Issuer</div>
                <div className="break-all font-mono text-xs">{certificate.xrplIou.issuer}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Transaction</div>
                <div className="break-all font-mono text-xs">{certificate.xrplIou.txHash}</div>
              </div>
            </div>
            {certificate.xrplIou.memo ? (
              <div className="mt-2 text-xs text-slate-600">Memo: {certificate.xrplIou.memo}</div>
            ) : null}
          </div>
        ) : null}

        <Separator className="my-6" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-slate-700">Trustee Attestation</div>
            <div className="mt-8 flex items-end justify-between">
              <div className="w-2/3">
                <div className="h-px w-full bg-slate-300" />
                <div className="mt-2 text-xs text-slate-600">{config.trusteesDisplayName}</div>
              </div>
              <div className="text-right text-xs text-slate-600">{isoDateOnly(new Date(certificate.issuedAt))}</div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-slate-700">Audit Hash</div>
            <div className="mt-2 flex items-start gap-2">
              <Hash className="mt-0.5 h-4 w-4 text-slate-600" />
              <div className="break-all rounded-xl border bg-slate-50 p-3 font-mono text-xs text-slate-700">
                {certificate.documentHash}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600">Hash computed from the canonical certificate payload. Anchor on-chain if desired.</div>
          </div>
        </div>

        {/* Bottom row: QR (left) • Barcode (center) • QR (right) */}
        {(config.qrDataUrl || config.barcodeDataUrl || config.noticeQrDataUrl) && (
          <div className="mt-8 pt-4 border-t border-slate-200">
            <div className="w-full grid grid-cols-[96px_minmax(0,1fr)_96px] items-end gap-6">
              <div className="flex justify-start">
                {config.qrDataUrl ? (
                  <div className="flex flex-col items-center gap-1">
                    <img
                      alt="QR"
                      src={config.qrDataUrl}
                      className="h-24 w-24 rounded border border-slate-300 bg-white p-1 object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <div className="text-[10px] text-slate-600">QR</div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-center">
                {config.barcodeDataUrl ? (
                  <div className="flex flex-col items-center gap-1">
                    <img
                      alt="Barcode"
                      src={config.barcodeDataUrl}
                      className="h-12 w-full max-w-[360px] rounded border border-slate-300 bg-white p-1 object-contain"
                      style={{ opacity: config.barcodeOpacity ?? 1, imageRendering: "pixelated" }}
                    />
                    <div className="text-[10px] text-slate-600">Barcode</div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                {config.noticeQrDataUrl ? (
                  <div className="flex flex-col items-center gap-1">
                    <img
                      alt="QR (Right)"
                      src={config.noticeQrDataUrl}
                      className="h-24 w-24 rounded border border-slate-300 bg-white p-1 object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <div className="text-[10px] text-slate-600">QR</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// Main Component
// -----------------------------

export default function TrustCertificatesConsolePage() {
  const router = useRouter();

  // Note: Trust records page uses token gate (TROO/NFT) for access, not admin session.
  // Admin session validation happens at the operation level (create/save trusts) not page level.

  // Token gate (Polygon TROO)
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onPolygon = chainId === 137;
  const walletType = address?.startsWith("0x") ? "metamask" : null;

  const heroReads = HERO_1155_TOKEN_IDS.map((id) =>
    useReadContract({
      address: HERO_1155_CONTRACT,
      abi: ERC1155_ABI,
      functionName: "balanceOf",
      args: address ? [address as `0x${string}`, id] : undefined,
      chainId: 137,
      query: { enabled: Boolean(address && address.startsWith("0x")) },
    })
  );

  const heroBalances = heroReads.map((r) => Number(r.data ?? 0n));
  const heroAny = heroBalances.some((b) => b > 0);
  const heroLoadingAny = heroReads.some((r) => r.isLoading);






  // Token gate is now NFT-only
  const isTokenHolder = isConnected && address?.startsWith("0x") && heroAny;
  const gatePending = isConnected && address?.startsWith("0x") && heroLoadingAny;
  const networkOk = chainId === 137;


  const [store, setStore] = useState<StoreState>(() => loadStore());
  const [trustId, setTrustId] = useState<string | null>(null);
  const [trustIdStatus, setTrustIdStatus] = useState<"resolving" | "ready" | "error">("resolving");
  const [draftLoadStatus, setDraftLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [serverDraftVersion, setServerDraftVersion] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const accountId = useMemo(() => (address ? address.toLowerCase() : null), [address]);

  useEffect(() => {
    if (!accountId) return;
    setLastActiveAccountId(accountId);

    // Prefer shared account assets when present; otherwise migrate legacy local trust-console assets once.
    const shared = loadAccountAssets(accountId);
    if (shared.length > 0) {
      setStore((s) => ({ ...s, assets: shared.map((a) => accountAssetToTrustRecordsAsset(a)) as any }));
      return;
    }

    // Migration path: copy existing trust-console assets into the shared registry.
    const legacy = loadStore().assets;
    if (legacy.length > 0) {
      for (const a of legacy) {
        upsertAccountAsset(accountId, trustRecordsAssetToAccountAsset(a));
      }
    }
  }, [accountId]);

  // Keep UI in sync if account assets change elsewhere (e.g., Smart Trust).
  useEffect(() => {
    if (!accountId) return;
    return subscribeAccountAssets(accountId, () => {
      const shared = loadAccountAssets(accountId);
      setStore((s) => ({ ...s, assets: shared.map((a) => accountAssetToTrustRecordsAsset(a)) as any }));
    });
  }, [accountId]);

  // Phase B: canonical trustId resolution and draft load/save (hard to regress).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTrustIdStatus("resolving");
      setSaveError(null);

      // 1) URL query param
      const urlTidRaw =
        typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("trustId") || "").trim() : "";
      const urlTid = urlTidRaw && isUuidLike(urlTidRaw) ? urlTidRaw : "";

      // 2) localStorage
      let localTid = "";
      try {
        const stored = (window.localStorage.getItem("current_trust_records_trustId") || "").trim();
        if (stored && isUuidLike(stored)) localTid = stored;
      } catch {
        localTid = "";
      }

      // 3) Create new canonical trust via API
      let resolved = urlTid || localTid;
      let source: "url" | "local" | "created" = urlTid ? "url" : localTid ? "local" : "created";

      if (!resolved) {
        try {
          const created = await createTrust({ source: "trust-records" });
          resolved = created.trustId;
        } catch (e: any) {
          // If we can't create a canonical trust (e.g., not authenticated),
          // keep the localStorage store as an offline-only fallback.
          if (cancelled) return;
          setTrustIdStatus("error");
          setTrustId(null);
          setSaveError(String(e?.message || e || "Failed to create trust"));
          console.warn("trust_records_trustId_resolved", { source: "error" });
          return;
        }
      }

      if (!resolved || !isUuidLike(resolved)) {
        if (cancelled) return;
        setTrustIdStatus("error");
        setTrustId(null);
        setSaveError("Invalid trustId; could not resolve a valid canonical trustId.");
        return;
      }

      if (cancelled) return;
      setTrustId(resolved);
      setTrustIdStatus("ready");

      // Persist locally and in URL for deterministic navigation.
      try {
        window.localStorage.setItem("current_trust_records_trustId", resolved);
      } catch {
        // ignore
      }
      try {
        const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        next.set("trustId", resolved);
        router.replace(`/trust-records?${next.toString()}`);
      } catch {
        // ignore
      }

      console.info("trust_records_trustId_resolved", { source, trustId: resolved });

      // Prefer server draft; local cache is rollback/offline only.
      setDraftLoadStatus("loading");
      try {
        const draft = await loadLatestTrustDraft({ trustId: resolved, draftType: "trust-records-state" });
        if (cancelled) return;
        if (draft?.payload) {
          setStore(draft.payload as any);
          setServerDraftVersion(draft.version ?? null);
          setDraftLoadStatus("loaded");
          console.info("trust_records_draft_loaded", { serverVersion: draft.version ?? null });
          return;
        }

        // No server draft yet: try local cache keyed by trustId.
        try {
          const raw = window.localStorage.getItem(`trust_records_state_cache_${resolved}`);
          if (raw) {
            const cached = JSON.parse(raw);
            setStore(cached as any);
          }
        } catch {
          // ignore
        }
        setDraftLoadStatus("loaded");
      } catch (e: any) {
        if (cancelled) return;
        setDraftLoadStatus("error");
        console.warn("trust_records_draft_loaded", { error: String(e?.message || e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);
  const [trustRole, setTrustRole] = useState<"Manager" | "Trustee">("Manager");
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const [activeTab, setActiveTab] = useState("issue");
  const [isTabPending, startTabTransition] = useTransition();

  // Global quick search
  const [query, setQuery] = useState("");

  // Issue form
  const [denominationUSD, setDenominationUSD] = useState<number>(10000);
  const [ownerName, setOwnerName] = useState("John Doe");
  const [certNotes, setCertNotes] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<UUID[]>([]);
  const [issueBusy, setIssueBusy] = useState(false);
  const [issuedPreviewId, setIssuedPreviewId] = useState<UUID | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Optional XRPL IOU issuance (server API)
  const [xrplIssueEnabled, setXrplIssueEnabled] = useState(false);
  const [xrplRecipient, setXrplRecipient] = useState("");
  const [xrplCurrency, setXrplCurrency] = useState("USD");
  const [xrplAmount, setXrplAmount] = useState<string>("");

  // Asset form
  const [assetType, setAssetType] = useState<AssetType>("Other");
  const [assetName, setAssetName] = useState("");
  const [assetIdentifier, setAssetIdentifier] = useState("");
  const [assetValuationUSD, setAssetValuationUSD] = useState<string>("");
  const [assetValuationAsOf, setAssetValuationAsOf] = useState(isoDateOnly());
  const [assetEncumbrances, setAssetEncumbrances] = useState("");
  const [assetEvidenceNotes, setAssetEvidenceNotes] = useState("");

  // Minutes / Resolutions / Amendments
  const [minuteKind, setMinuteKind] = useState<MinuteKind>("Minutes");
  const [minuteTitle, setMinuteTitle] = useState("");
  const [minuteDate, setMinuteDate] = useState(isoDateOnly());
  const [minuteBody, setMinuteBody] = useState("");
  const [minuteAdoptedBy, setMinuteAdoptedBy] = useState(store.config.trusteesDisplayName);
  const [minuteRelatedCertIds, setMinuteRelatedCertIds] = useState<UUID[]>([]);
  const [minuteRelatedAssetIds, setMinuteRelatedAssetIds] = useState<UUID[]>([]);
  const [minuteBusy, setMinuteBusy] = useState(false);

  // Meetings
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    meetingDate: isoDateOnly(),
    attendees: "",
    location: "",
    agenda: "",
    notes: "",
    resolutions: "",
  });
  const [meetingSealPreviewUrl, setMeetingSealPreviewUrl] = useState<string | null>(null);
  const [meetingWatermarkPreviewUrl, setMeetingWatermarkPreviewUrl] = useState<string | null>(null);
  const [meetingQrPreviewUrl, setMeetingQrPreviewUrl] = useState<string | null>(null);
  const [meetingBarcodePreviewUrl, setMeetingBarcodePreviewUrl] = useState<string | null>(null);
  const [meetingNoticeQrPreviewUrl, setMeetingNoticeQrPreviewUrl] = useState<string | null>(null);

  // Settings
  const renderRef = useRef<HTMLDivElement | null>(null);
  const sealInputRef = useRef<HTMLInputElement | null>(null);
  const watermarkInputRef = useRef<HTMLInputElement | null>(null);
  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const noticeQrInputRef = useRef<HTMLInputElement | null>(null);

  // Meeting refs
  const meetingRenderRef = useRef<HTMLDivElement | null>(null);
  const meetingSealInputRef = useRef<HTMLInputElement | null>(null);
  const meetingWatermarkInputRef = useRef<HTMLInputElement | null>(null);
  const meetingQrInputRef = useRef<HTMLInputElement | null>(null);
  const meetingBarcodeInputRef = useRef<HTMLInputElement | null>(null);
  const meetingNoticeQrInputRef = useRef<HTMLInputElement | null>(null);
  const [sealPreviewUrl, setSealPreviewUrl] = useState<string | null>(null);
  const [watermarkPreviewUrl, setWatermarkPreviewUrl] = useState<string | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [barcodePreviewUrl, setBarcodePreviewUrl] = useState<string | null>(null);
  const [noticeQrPreviewUrl, setNoticeQrPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      deferIdle(() => saveStore(store));
    }, 300);
    return () => window.clearTimeout(t);
  }, [store]);

  useEffect(
    () => () => {
      if (sealPreviewUrl) URL.revokeObjectURL(sealPreviewUrl);
    },
    [sealPreviewUrl]
  );

  useEffect(
    () => () => {
      if (watermarkPreviewUrl) URL.revokeObjectURL(watermarkPreviewUrl);
    },
    [watermarkPreviewUrl]
  );

  useEffect(
    () => () => {
      if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl);
    },
    [qrPreviewUrl]
  );

  useEffect(
    () => () => {
      if (barcodePreviewUrl) URL.revokeObjectURL(barcodePreviewUrl);
    },
    [barcodePreviewUrl]
  );

  useEffect(
    () => () => {
      if (noticeQrPreviewUrl) URL.revokeObjectURL(noticeQrPreviewUrl);
    },
    [noticeQrPreviewUrl]
  );

  // Load role from backend (Trustee/Manager). Draft loading is now trustId-based.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trust-records/me", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.role === "Manager" || data?.role === "Trustee") setTrustRole(data.role);
        setHydratedFromServer(true);
      } catch {
        // ignore, keep localStorage
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave to canonical trust drafts for Managers (Trustees cannot save; they can only sign).
  useEffect(() => {
    if (!hydratedFromServer) return;
    if (trustRole !== "Manager") return;
    if (trustIdStatus !== "ready" || !trustId) return;
    const t = window.setTimeout(() => {
      setSaveStatus("saving");
      setSaveError(null);
      saveTrustDraft({
        trustId,
        draftType: "trust-records-state",
        schemaVersion: 1,
        payload: store,
      })
        .then(({ version }) => {
          setServerDraftVersion(version);
          setLastSavedAt(new Date().toISOString());
          setSaveStatus("saved");
          console.info("trust_records_draft_saved", { serverVersion: version });
          try {
            window.localStorage.setItem(`trust_records_state_cache_${trustId}`, JSON.stringify(store));
          } catch {
            // ignore
          }
        })
        .catch((e: any) => {
          setSaveStatus("error");
          setSaveError(String(e?.message || e || "Save failed"));
          console.warn("trust_records_draft_save_failed", { error: String(e?.message || e) });
          // Always keep local cache as rollback/offline.
          try {
            window.localStorage.setItem(`trust_records_state_cache_${trustId}`, JSON.stringify(store));
          } catch {
            // ignore
          }
        });
    }, 800);
    return () => window.clearTimeout(t);
  }, [store, trustRole, hydratedFromServer, trustId, trustIdStatus]);

  // keep adoptedBy in sync when config changes
  useEffect(() => {
    setMinuteAdoptedBy(store.config.trusteesDisplayName);
  }, [store.config.trusteesDisplayName]);

  const filteredAssets = useMemo(() => {
    if (!query.trim()) return store.assets;
    const q = query.toLowerCase();
    return store.assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.identifier ?? "").toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
    );
  }, [store.assets, query]);

  const filteredCertificates = useMemo(() => {
    if (!query.trim()) return store.certificates;
    const q = query.toLowerCase();
    return store.certificates.filter(
      (c) =>
        c.serialNumber.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q)
    );
  }, [store.certificates, query]);

  const filteredMinutes = useMemo(() => {
    if (!query.trim()) return store.minutes;
    const q = query.toLowerCase();
    return store.minutes.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.kind.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q) ||
        m.adoptedBy.toLowerCase().includes(q)
    );
  }, [store.minutes, query]);

  const issuedPreview = useMemo(() => {
    if (!issuedPreviewId) return null;
    return store.certificates.find((c) => c.id === issuedPreviewId) ?? null;
  }, [issuedPreviewId, store.certificates]);

  const totalBackedValue = useMemo(() => {
    const selected = store.assets.filter((a) => selectedAssetIds.includes(a.id));
    return selected.reduce((sum, a) => sum + (a.valuationUSD ?? 0), 0);
  }, [store.assets, selectedAssetIds]);

  async function handleIssueCertificate() {
    if (trustRole !== "Manager") {
      setIssueError("Only Managers can issue certificates. Trustees can sign certificates.");
      return;
    }
    if (!isTokenHolder) {
      setIssueError(`Token gate: connect a wallet holding the required NFT on Polygon to issue certificates.`);
      return;
    }
    if (!networkOk) {
      setIssueError("Network: switch to Polygon network to issue certificates.");
      return;
    }
    if (!ownerName.trim() || !Number.isFinite(denominationUSD) || denominationUSD <= 0) return;

    setIssueBusy(true);
    setIssueError(null);
    try {
      const serial = `${store.config.certificatePrefix}-${pad(store.serialCounter)}`;

      const payload = {
        trustName: displayEntityName(store.config),
        serialNumber: serial,
        issuedAt: nowIso(),
        denominationUSD,
        ownerName: ownerName.trim(),
        notes: certNotes.trim() || undefined,
        status: "Active" as const,
        backingAssetIds: selectedAssetIds,
      };

      const hash = await sha256Hex(canonicalJson(payload));

      const cert: Certificate = {
        id: uuid(),
        serialNumber: serial,
        issuedAt: payload.issuedAt,
        denominationUSD,
        ownerName: payload.ownerName,
        notes: payload.notes,
        status: "Active",
        backingAssetIds: selectedAssetIds,
        documentHash: hash,
      };

      // Optional: issue IOU on XRPL and attach tx hash to the digital certificate preview
      if (xrplIssueEnabled) {
        const amount = (xrplAmount.trim() || String(denominationUSD)).trim();
        const currency = xrplCurrency.trim().toUpperCase();
        const recipient = xrplRecipient.trim();
        if (!recipient) throw new Error("XRPL recipient is required when XRPL issuance is enabled.");
        if (!currency) throw new Error("XRPL currency is required when XRPL issuance is enabled.");
        if (!amount) throw new Error("XRPL amount is required when XRPL issuance is enabled.");

        const memo = `Certificate ${serial} • Hash ${hash}`;

        const resp = await fetch("/api/xrpl/issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient,
            currency,
            amount,
            memo,
            memoType: "TrustCertificate",
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.error || "XRPL issuance failed.");
        }

        cert.xrplIou = {
          txHash: String(data.txHash || ""),
          currency,
          amount,
          recipient,
          issuer: String(data.issuer || ""),
          memo,
          issuedAt: nowIso(),
        };
      }

      setStore((s) => ({
        ...s,
        certificates: [cert, ...s.certificates],
        serialCounter: s.serialCounter + 1,
      }));

      setIssuedPreviewId(cert.id);
      setActiveTab("registry");

      // Clear minimal fields (keep denomination)
      setOwnerName("");
      setCertNotes("");
      setSelectedAssetIds([]);
      setXrplIssueEnabled(false);
      setXrplRecipient("");
      setXrplAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setIssueError(msg);
    } finally {
      setIssueBusy(false);
    }
  }

  function addAsset() {
    if (!assetName.trim()) return;
    const v = assetValuationUSD.trim() ? Number(assetValuationUSD) : undefined;

    const a: Asset = {
      id: uuid(),
      type: assetType,
      name: assetName.trim(),
      identifier: assetIdentifier.trim() || undefined,
      valuationUSD: Number.isFinite(v as number) ? v : undefined,
      valuationAsOf: assetValuationAsOf || undefined,
      encumbrances: assetEncumbrances.trim() || undefined,
      evidenceNotes: assetEvidenceNotes.trim() || undefined,
      createdAt: nowIso(),
    };

    setStore((s) => ({ ...s, assets: [a, ...s.assets] }));
    if (accountId) {
      upsertAccountAsset(accountId, trustRecordsAssetToAccountAsset(a));
    }

    // clear
    setAssetName("");
    setAssetIdentifier("");
    setAssetValuationUSD("");
    setAssetEncumbrances("");
    setAssetEvidenceNotes("");
  }

  async function addMinute() {
    if (!minuteTitle.trim() || !minuteBody.trim()) return;

    setMinuteBusy(true);
    try {
      const payload = {
        kind: minuteKind,
        title: minuteTitle.trim(),
        meetingDate: minuteDate,
        body: minuteBody.trim(),
        relatedCertificateIds: minuteRelatedCertIds,
        relatedAssetIds: minuteRelatedAssetIds,
        adoptedBy: minuteAdoptedBy.trim(),
        createdAt: nowIso(),
      };

      const hash = await sha256Hex(canonicalJson(payload));

      const rec: MinuteRecord = {
        id: uuid(),
        ...payload,
        hash,
      };

      setStore((s) => ({ ...s, minutes: [rec, ...s.minutes] }));

      // clear
      setMinuteTitle("");
      setMinuteBody("");
      setMinuteRelatedCertIds([]);
      setMinuteRelatedAssetIds([]);
    } finally {
      setMinuteBusy(false);
    }
  }

  function voidCertificate(id: UUID) {
    setStore((s) => ({
      ...s,
      certificates: s.certificates.map((c) => (c.id === id ? { ...c, status: "Voided" } : c)),
    }));
  }

  function transferCertificate(id: UUID) {
    setStore((s) => ({
      ...s,
      certificates: s.certificates.map((c) => (c.id === id ? { ...c, status: "Transferred" } : c)),
    }));
  }

  function deleteCertificate(id: UUID) {
    setStore((s) => {
      const certificates = s.certificates.filter((c) => c.id !== id);
      const minutes = s.minutes.map((m) => ({
        ...m,
        relatedCertificateIds: m.relatedCertificateIds.filter((cid) => cid !== id),
      }));
      return { ...s, certificates, minutes };
    });
    setIssuedPreviewId((prev) => (prev === id ? null : prev));
    setMinuteRelatedCertIds((ids) => ids.filter((cid) => cid !== id));
  }

  function deleteAsset(id: UUID) {
    setStore((s) => {
      const assets = s.assets.filter((a) => a.id !== id);
      const certificates = s.certificates.map((c) => ({
        ...c,
        backingAssetIds: c.backingAssetIds.filter((aid) => aid !== id),
      }));
      const minutes = s.minutes.map((m) => ({
        ...m,
        relatedAssetIds: m.relatedAssetIds.filter((aid) => aid !== id),
      }));
      return { ...s, assets, certificates, minutes };
    });
    setSelectedAssetIds((ids) => ids.filter((aid) => aid !== id));
    setMinuteRelatedAssetIds((ids) => ids.filter((aid) => aid !== id));
    if (accountId) {
      deleteAccountAsset(accountId, id);
    }
  }

  async function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function downscaleImageToDataUrl(file: File, opts: { maxDim: number; mime: "image/png" | "image/jpeg"; quality?: number }) {
    const maxDim = Math.max(64, Number(opts.maxDim) || 512);
    const mime = opts.mime;
    const quality = typeof opts.quality === "number" ? opts.quality : 0.85;

    // Use ImageBitmap when available (fast + avoids DOM image decode quirks)
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Fallback: just return original as dataURL
      return null;
    });
    if (!bitmap) return await readFileAsDataUrl(file);

    const w = bitmap.width;
    const h = bitmap.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return await readFileAsDataUrl(file);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, outW, outH);

    try {
      return canvas.toDataURL(mime, mime === "image/jpeg" ? quality : undefined);
    } catch {
      return await readFileAsDataUrl(file);
    } finally {
      bitmap.close?.();
    }
  }

  async function onUploadSeal(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Seal too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }

    const objUrl = URL.createObjectURL(f);
    setSealPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });

    deferIdle(async () => {
      try {
        // Downscale for smoother dashboard rendering (preserves transparency via PNG).
        const dataUrl = await downscaleImageToDataUrl(f, { maxDim: 512, mime: "image/png" });
        setStore((s) => ({ ...s, config: { ...s.config, sealDataUrl: dataUrl } }));
      } catch (err) {
        console.error("Seal upload failed", err);
      }
    });
  }

  async function onUploadWatermark(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Watermark too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }

    const objUrl = URL.createObjectURL(f);
    setWatermarkPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });

    deferIdle(async () => {
      try {
        // Downscale for smoother dashboard rendering (preserves transparency via PNG).
        const dataUrl = await downscaleImageToDataUrl(f, { maxDim: 1600, mime: "image/png" });
        setStore((s) => ({ ...s, config: { ...s.config, watermarkDataUrl: dataUrl } }));
      } catch (err) {
        console.error("Watermark upload failed", err);
      }
    });
  }

  async function onUploadQr(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`QR code too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setQrPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
    deferIdle(async () => {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        setStore((s) => ({ ...s, config: { ...s.config, qrDataUrl: dataUrl } }));
      } catch (err) {
        console.error("QR upload failed", err);
      }
    });
  }

  async function onUploadBarcode(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Barcode too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setBarcodePreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
    deferIdle(async () => {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        setStore((s) => ({ ...s, config: { ...s.config, barcodeDataUrl: dataUrl } }));
      } catch (err) {
        console.error("Barcode upload failed", err);
      }
    });
  }

  async function onUploadNoticeQr(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Notice QR too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setNoticeQrPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
    deferIdle(async () => {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        setStore((s) => ({ ...s, config: { ...s.config, noticeQrDataUrl: dataUrl } }));
      } catch (err) {
        console.error("Notice QR upload failed", err);
      }
    });
  }

  // Meeting upload functions
  async function onUploadMeetingSeal(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Seal too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setMeetingSealPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
  }

  async function onUploadMeetingWatermark(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Watermark too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setMeetingWatermarkPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
  }

  async function onUploadMeetingQr(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`QR code too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setMeetingQrPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
  }

  async function onUploadMeetingBarcode(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Barcode too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setMeetingBarcodePreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
  }

  async function onUploadMeetingNoticeQr(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      alert(`Notice QR too large. Please use an image under ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1)} MB.`);
      return;
    }
    const objUrl = URL.createObjectURL(f);
    setMeetingNoticeQrPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return objUrl;
    });
  }

  // Save meeting function
  const saveMeeting = useCallback(async () => {
    if (!meetingForm.title || !meetingForm.meetingDate) {
      alert("Please fill in the meeting title and date.");
      return;
    }
    if (!address) {
      alert("Connect your wallet first.");
      return;
    }

    try {
      // Generate render data from the preview
      let renderDataUrl: string | undefined;
      try {
        const html2canvas = (await import("html2canvas")).default;
        if (meetingRenderRef.current) {
          const canvas = await html2canvas(meetingRenderRef.current, {
            backgroundColor: "#ffffff",
            scale: 1,
          });
          renderDataUrl = canvas.toDataURL("image/png");
        }
      } catch (err) {
        console.warn("Meeting render capture failed", err);
      }

      // Save to database first
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address.toLowerCase(),
          title: meetingForm.title,
          meetingDate: meetingForm.meetingDate,
          attendees: meetingForm.attendees || undefined,
          location: meetingForm.location || undefined,
          agenda: meetingForm.agenda || undefined,
          notes: meetingForm.notes || undefined,
          resolutions: meetingForm.resolutions || undefined,
          sealDataUrl: meetingSealPreviewUrl || undefined,
          watermarkDataUrl: meetingWatermarkPreviewUrl || undefined,
          qrDataUrl: meetingQrPreviewUrl || undefined,
          barcodeDataUrl: meetingBarcodePreviewUrl || undefined,
          noticeQrDataUrl: meetingNoticeQrPreviewUrl || undefined,
          renderDataUrl,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save meeting");
      }

      // Also save to local store for immediate UI updates
      const meetingId = crypto.randomUUID();
      const meeting: MeetingRecord = {
        id: meetingId,
        title: meetingForm.title,
        meetingDate: meetingForm.meetingDate,
        attendees: meetingForm.attendees,
        location: meetingForm.location,
        agenda: meetingForm.agenda,
        notes: meetingForm.notes,
        resolutions: meetingForm.resolutions,
        sealDataUrl: meetingSealPreviewUrl || undefined,
        watermarkDataUrl: meetingWatermarkPreviewUrl || undefined,
        qrDataUrl: meetingQrPreviewUrl || undefined,
        barcodeDataUrl: meetingBarcodePreviewUrl || undefined,
        noticeQrDataUrl: meetingNoticeQrPreviewUrl || undefined,
        renderData: renderDataUrl,
        createdAt: new Date().toISOString(),
      };

      setStore((s) => ({
        ...s,
        meetings: [...s.meetings, meeting],
      }));

      // Reset form
      setMeetingForm({
        title: "",
        meetingDate: isoDateOnly(),
        attendees: "",
        location: "",
        agenda: "",
        notes: "",
        resolutions: "",
      });

      // Reset preview URLs
      setMeetingSealPreviewUrl(null);
      setMeetingWatermarkPreviewUrl(null);
      setMeetingQrPreviewUrl(null);
      setMeetingBarcodePreviewUrl(null);
      setMeetingNoticeQrPreviewUrl(null);

      alert("Meeting minutes saved successfully!");
    } catch (error) {
      console.error("Failed to save meeting:", error);
      alert("Failed to save meeting. Please try again.");
    }
  }, [meetingForm, address, meetingSealPreviewUrl, meetingWatermarkPreviewUrl, meetingQrPreviewUrl, meetingBarcodePreviewUrl, meetingNoticeQrPreviewUrl]);

  const canSaveCertificateTheme =
    !!address &&
    !!store.config.sealDataUrl &&
    !!store.config.watermarkDataUrl &&
    !!store.config.qrDataUrl &&
    !!store.config.barcodeDataUrl &&
    !!store.config.noticeQrDataUrl &&
    !!(store.config.assetAddressUrl ?? "").trim() &&
    store.certificates.length > 0;

  async function handleSaveCertificateTheme() {
    if (!address) {
      alert("Connect your wallet first.");
      return;
    }
    if (!canSaveCertificateTheme) {
      alert("Please upload seal, watermark, QR, barcode, notice QR and set the asset address URL.");
      return;
    }
    setSaveBusy(true);
    setSaveMessage(null);
    try {
      let renderDataUrl: string | undefined;
      try {
        const html2canvas = (await import("html2canvas")).default;
        if (renderRef.current) {
          const canvas = await html2canvas(renderRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
          });
          renderDataUrl = canvas.toDataURL("image/png");
        }
      } catch (err) {
        console.warn("Render capture failed", err);
      }
      if (!renderDataUrl) {
        throw new Error("Render capture failed. Make sure the Render Test is visible (and at least one certificate exists), then try again.");
      }

      // Save a full snapshot of what's visible in the render test so dashboard cards can always reflect the full certificate text.
      const certificateSnapshot = {
        config: store.config,
        certificate: store.certificates[0],
        assets: store.assets,
      };

      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address.toLowerCase(),
          assetAddressUrl: store.config.assetAddressUrl,
          sealDataUrl: store.config.sealDataUrl,
          watermarkDataUrl: store.config.watermarkDataUrl,
          qrDataUrl: store.config.qrDataUrl,
          barcodeDataUrl: store.config.barcodeDataUrl,
          noticeQrDataUrl: store.config.noticeQrDataUrl,
          renderDataUrl,
          certificateJson: JSON.stringify(certificateSnapshot),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save certificate");
      }
      setSaveMessage("Saved to dashboard.");
    } catch (err) {
      console.error("Save certificate failed", err);
      setSaveMessage("Failed to save certificate.");
    } finally {
      setSaveBusy(false);
    }
  }

  function exportJson() {
    downloadText(`trust-console-export-${isoDateOnly()}.json`, JSON.stringify(store, null, 2), "application/json");
  }

  function exportCertificateAsJson(cert: Certificate) {
    const payload = {
      trustName: displayEntityName(store.config),
      certificate: cert,
      backingAssets: store.assets.filter((a) => cert.backingAssetIds.includes(a.id)),
      exportedAt: nowIso(),
    };
    downloadText(`certificate-${cert.serialNumber}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportMinuteAsText(m: MinuteRecord) {
    const content =
      `${m.kind.toUpperCase()}\n` +
      `Title: ${m.title}\n` +
      `Meeting Date: ${m.meetingDate}\n` +
      `Adopted By: ${m.adoptedBy}\n` +
      `Hash: ${m.hash}\n` +
      `\n---\n\n` +
      `${m.body}\n`;
    downloadText(`${m.kind.toLowerCase()}-${m.meetingDate}-${m.title.replace(/[^a-z0-9]+/gi, "-")}.txt`, content);
  }

  // Token gate: require connected wallet + NFT (network check separate)
  if (!isConnected || (!gatePending && !isTokenHolder)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-xl w-full border border-cyan-500/40 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              Token Gate Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-200">
              Connect a wallet holding the required NFT on Polygon to access Trust Records.
            </div>
            <div className="text-sm text-slate-300">
              Status:{" "}
              {gatePending
                ? "Checking NFT..."
                : isConnected
                ? networkOk
                  ? `NFT: ${heroAny ? "✓" : "✗"} | Balances: ${heroBalances.map((b, i) => `${HERO_1155_TOKEN_IDS[i]}:${b}`).join(" ")}`
                  : "Wrong network — switch to Polygon"
                : "Wallet not connected"}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isConnected ? <MobileWalletButton /> : null}
            </div>
            <div className="text-xs text-slate-400">
              Make sure MetaMask is on Polygon and the ERC1155 NFT is held in the connected address. This page stays locked until the NFT gate is met.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const NEON_TILE =
    "rounded-2xl border border-cyan-400/50 bg-slate-900 " +
    "transition-[box-shadow,border-color] duration-200 " +
    "hover:border-cyan-300 hover:shadow-[0_0_28px_rgba(0,209,255,0.35)] " +
    "focus-within:border-cyan-200 focus-within:shadow-[0_0_36px_rgba(0,209,255,0.45)]";

  const NEON_TILE_DARK = NEON_TILE.replace("bg-slate-900", "bg-slate-950");

  const NEON_LINK =
    "text-cyan-300 underline decoration-cyan-400/60 " +
    "hover:text-cyan-200 hover:decoration-cyan-200 " +
    "transition-[color,text-shadow] " +
    "hover:[text-shadow:0_0_12px_rgba(0,209,255,0.65)] focus:outline-none";

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        {/* Network warning banner for token holders not on Polygon */}
        {!networkOk && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-950/20">
            <AlertTitle className="flex items-center gap-2 text-amber-300">
              <ShieldCheck className="h-4 w-4" />
              Network Warning
            </AlertTitle>
            <AlertDescription className="text-amber-200">
              You're not on Polygon network. Trust issuance and blockchain operations require Polygon.
              Switch to Polygon in your wallet for full functionality. You're viewing in read-only mode.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <div className={`${NEON_TILE} p-3 shadow-sm`}>
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-semibold">Trust Certificates</div>
              <div className="text-sm text-slate-300">
                Digital issuance, registries, minutes, resolutions, and amendments
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across assets, certificates, minutes…"
                className="w-full pl-9 md:w-[360px]"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/smart-trust")}
              className="gap-2"
            >
              <Landmark className="h-4 w-4" />
              Smart Trust
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/ppm?trustId=${trustId}`)}
              className="gap-2"
              disabled={!trustId}
            >
              <FileText className="h-4 w-4" />
              PPM
            </Button>
            <Button asChild variant="secondary" className="gap-2">
              <a href="/besu-bundle" target="_blank" rel="noopener noreferrer" className={NEON_LINK}>
                <Database className="h-4 w-4" />
                BESU
              </a>
            </Button>
            <Button variant="secondary" onClick={exportJson} className="gap-2">
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className={`mt-6 ${NEON_TILE} p-4`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Entity</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">{displayEntityName(store.config)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{store.config.entityType}</Badge>
                <Badge variant={trustRole === "Manager" ? "default" : "secondary"}>{trustRole}</Badge>
              </div>
            </div>
            <div className="text-sm text-slate-300">
              Managers can issue and edit records. Trustees can sign certificates.
            </div>
          </div>
        </div>

        <div className={`mt-4 ${NEON_TILE_DARK} p-4`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">Token Status</div>
              {isConnected ? (
                <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Wallet:</span>
                    <span className="font-mono">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Wallet Type:</span>
                    <span className="capitalize">{walletType || "Unknown"}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Network:</span>
                    <span className={chainId === 137 ? "text-emerald-300" : "text-amber-200"}>
                      {chainId === 137 ? "✅ Polygon" : `⚠️ Chain ${chainId || "?"}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Contract:</span>
                    <span className="font-mono">
                      {HERO_1155_CONTRACT.slice(0, 6)}...{HERO_1155_CONTRACT.slice(-4)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Token IDs:</span>
                    <span className="text-slate-200">
                      {gatePending
                        ? "Checking..."
                        : HERO_1155_TOKEN_IDS.join(", ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">NFT Balance:</span>
                    <span className={heroAny ? "text-emerald-300" : "text-slate-200"}>
                      {gatePending
                        ? "Checking..."
                        : heroBalances.map((b, i) => `${HERO_1155_TOKEN_IDS[i]}: ${b}`).join(" | ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Gate:</span>
                    <span className={isTokenHolder ? "text-emerald-300" : "text-slate-300"}>
                      NFT required — {isTokenHolder ? "met" : "not met"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-400">Access:</span>
                    <span className={isTokenHolder ? "text-emerald-300" : "text-slate-300"}>
                      {onPolygon
                        ? isTokenHolder
                          ? "✓ NFT holder (ERC1155)"
                          : "Locked until NFT acquired"
                        : "Switch to Polygon"}
                    </span>
                  </div>

                  <details className="mt-2 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                    <summary className="cursor-pointer text-xs text-cyan-200">
                      Debug (NFT gate status)
                    </summary>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      <div>
                        Contract: {HERO_1155_CONTRACT.slice(0, 10)}...{HERO_1155_CONTRACT.slice(-8)}
                      </div>
                      <div>
                        Checking token IDs: {HERO_1155_TOKEN_IDS.join(", ")}
                      </div>
                      <div className="space-y-1">
                        {HERO_1155_TOKEN_IDS.map((id, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span>Token ID {id}:</span>
                            <span className={heroBalances[i] > 0 ? "text-emerald-300" : "text-slate-400"}>
                              {heroLoadingAny ? "..." : heroBalances[i]}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div>
                        Any NFT owned: {heroAny ? "✅ Yes" : "❌ No"}
                      </div>
                      <div>
                        Gate pending: {gatePending ? "⏳ Yes (checking)" : "✅ Complete"}
                      </div>
                      {chainId !== 137 && (
                        <div className="text-amber-300">
                          Connected chain: {chainId ?? "?"} — switch to Polygon for NFT reads.
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-300">
                  Connect a wallet to check NFT holdings on Polygon (required for issuance).
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isConnected ? <MobileWalletButton /> : null}
              <a
                className={`text-sm ${NEON_LINK}`}
                href={`https://polygonscan.com/token/${HERO_1155_CONTRACT}`}
                target="_blank"
                rel="noreferrer"
              >
                View NFT Contract
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              startTabTransition(() => setActiveTab(v));
            }}
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-900 md:grid-cols-7">
              <TabsTrigger value="issue" className="gap-2">
                <FilePlus2 className="h-4 w-4" />
                Issue
              </TabsTrigger>
              <TabsTrigger value="assets" className="gap-2">
                <Database className="h-4 w-4" />
                Assets
              </TabsTrigger>
              <TabsTrigger value="registry" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Certificates
              </TabsTrigger>
              <TabsTrigger value="governance" className="gap-2">
                <FileText className="h-4 w-4" />
                Minutes
              </TabsTrigger>
              <TabsTrigger value="resolutions" className="gap-2">
                <Scale className="h-4 w-4" />
                Resolutions
              </TabsTrigger>
              <TabsTrigger value="meetings" className="gap-2">
                <FileText className="h-4 w-4" />
                Meetings
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Stamp className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Issue */}
            <TabsContent value="issue" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FilePlus2 className="h-5 w-5" />
                      Issue New Trust Certificate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Denomination (USD)</Label>
                        <Input
                          type="number"
                          value={denominationUSD}
                          onChange={(e) => setDenominationUSD(Number(e.target.value))}
                          min={1}
                        />
                        <div className="text-xs text-slate-400">
                          Tip: If your trust uses units (e.g., 100 units), you can map denomination to "units" or to NAV.
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Beneficial Owner Name</Label>
                        <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full legal name" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Textarea value={certNotes} onChange={(e) => setCertNotes(e.target.value)} placeholder="Additional information about this certificate…" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Asset Backing (optional link)</Label>
                        <div className="text-xs text-slate-400">Selected value: {money(totalBackedValue)}</div>
                      </div>
                      <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
                        {store.assets.length === 0 ? (
                          <div className="text-sm text-slate-400">No assets recorded yet. Add assets in the Asset Registry tab.</div>
                        ) : (
                          store.assets.map((a) => {
                            const checked = selectedAssetIds.includes(a.id);
                            return (
                              <label
                                key={a.id}
                                className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition ${
                                  checked ? "border-slate-600 bg-slate-900" : "border-slate-800 bg-slate-950 hover:bg-slate-900"
                                }`}
                              >
                                <div>
                                  <div className="font-medium">{a.name}</div>
                                  <div className="text-xs text-slate-400">
                                    {a.type}
                                    {a.identifier ? ` • ${a.identifier}` : ""}
                                    {a.valuationAsOf ? ` • ${a.valuationAsOf}` : ""}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-sm text-slate-200">{a.valuationUSD ? money(a.valuationUSD) : "—"}</div>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setSelectedAssetIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)));
                                    }}
                                    className="mt-1 h-4 w-4"
                                  />
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="mb-2 text-sm font-semibold">Certificate Features</div>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Unique serial number generation
                        </li>
                        <li className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4" />
                          Digital signature integration (placeholder)
                        </li>
                        <li className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          Asset backing verification (by registry linkage)
                        </li>
                        <li className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Blockchain-ready certificate registry (hash anchoring)
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">XRPL IOU Issuance (Optional)</div>
                        <label className="flex items-center gap-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={xrplIssueEnabled}
                            disabled={trustRole !== "Manager" || !isTokenHolder}
                            onChange={(e) => setXrplIssueEnabled(e.target.checked)}
                            className="h-4 w-4"
                          />
                          Issue on XRPL
                        </label>
                      </div>
                      <div className="text-xs text-slate-400">
                        If enabled, the issuer will mint an IOU and the resulting XRPL transaction hash will be embedded into this digital certificate.
                      </div>
                      {trustRole === "Manager" && !isTokenHolder ? (
                        <div className="mt-2 text-xs text-amber-300">
                          Token gate: connect a wallet holding the required NFT to enable issuance actions.
                        </div>
                      ) : null}

                      {xrplIssueEnabled ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Recipient Address</Label>
                            <Input value={xrplRecipient} onChange={(e) => setXrplRecipient(e.target.value)} placeholder="r..." />
                            <div className="text-xs text-slate-400">
                              Recipient must already have a trust line set for this currency/issuer.
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Currency</Label>
                            <Input value={xrplCurrency} onChange={(e) => setXrplCurrency(e.target.value)} placeholder="USD" />
                          </div>
                          <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input
                              value={xrplAmount}
                              onChange={(e) => setXrplAmount(e.target.value)}
                              placeholder={`Defaults to ${denominationUSD}`}
                            />
                            <div className="text-xs text-slate-400">Leave blank to reuse the Denomination value.</div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {issueError ? (
                      <Alert className="border-red-900/40 bg-red-950/30">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Issuance failed</AlertTitle>
                        <AlertDescription className="text-slate-200">{issueError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Button
                      className="w-full gap-2"
                      onClick={handleIssueCertificate}
                      disabled={
                        issueBusy ||
                        trustRole !== "Manager" ||
                        !isTokenHolder ||
                        !networkOk ||
                        !ownerName.trim() ||
                        denominationUSD <= 0
                      }
                    >
                      <FilePlus2 className="h-4 w-4" />
                      {issueBusy ? "Issuing…" : "Issue Certificate"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stamp className="h-5 w-5" />
                      Live Certificate Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {issuedPreview ? (
                      <div className="space-y-3">
                        <CertificatePreview config={store.config} certificate={issuedPreview} assets={store.assets} />
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => exportCertificateAsJson(issuedPreview)} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export Certificate JSON
                          </Button>
                          {trustIdStatus === "ready" && trustId ? (
                            <Button variant="outline" asChild className="gap-2">
                              <a href={`/trusts/${encodeURIComponent(trustId)}/issue-security`}>
                                <Landmark className="h-4 w-4" />
                                Add Instrument: Security (Private Placement)
                              </a>
                            </Button>
                          ) : null}
                          {trustRole === "Trustee" && trustIdStatus === "ready" && trustId && !issuedPreview.signedBy ? (
                            <Button
                              className="gap-2"
                              onClick={async () => {
                                try {
                                  const resp = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/certificates/${encodeURIComponent(issuedPreview.id)}/sign`, {
                                    method: "POST",
                                  });
                                  const data = await resp.json().catch(() => ({}));
                                  if (!resp.ok) throw new Error(data?.error || "Failed to sign");
                                  if (data?.state) setStore(data.state);
                                } catch (e) {
                                  setIssueError(e instanceof Error ? e.message : "Failed to sign");
                                }
                              }}
                            >
                              <FileSignature className="h-4 w-4" />
                              Sign Certificate
                            </Button>
                          ) : null}
                        </div>

                        {/* Seal upload AFTER signature */}
                        {trustRole === "Trustee" && trustIdStatus === "ready" && trustId && issuedPreview.signedBy ? (
                          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <div className="text-sm font-semibold text-slate-200">Post‑Signature Seal</div>
                            <div className="mt-1 text-xs text-slate-400">
                              Upload a seal image after signing to bind a visible artifact to this signed record.
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  try {
                                    const url = await downscaleImageToDataUrl(f, { maxDim: 512, mime: "image/png", quality: 0.9 });
                                    const resp = await fetch(
                                      `/api/trusts/${encodeURIComponent(trustId)}/certificates/${encodeURIComponent(issuedPreview.id)}/seal`,
                                      {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ signatureSealDataUrl: url }),
                                      }
                                    );
                                    const data = await resp.json().catch(() => ({}));
                                    if (!resp.ok) throw new Error(data?.error || "Failed to save seal");
                                    if (data?.state) setStore(data.state);
                                  } catch (err) {
                                    setIssueError(err instanceof Error ? err.message : "Failed to upload seal");
                                  } finally {
                                    e.currentTarget.value = "";
                                  }
                                }}
                                className="text-xs text-slate-200"
                              />
                              {issuedPreview.signatureSealDataUrl ? (
                                <div className="flex items-center gap-3">
                                  <img
                                    src={issuedPreview.signatureSealDataUrl}
                                    alt="Signature seal"
                                    className="h-12 w-12 rounded-xl border border-slate-800 bg-white object-contain"
                                  />
                                  <div className="text-xs text-slate-400">Seal attached</div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400">No seal attached yet.</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300">Issue a certificate to preview it here. Seal and watermark (Settings) will be applied.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Assets */}
            <TabsContent value="assets" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Asset Registry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Asset Type</Label>
                      <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(["Cash","Real Estate","Security","Promissory Note","Digital Asset","Intellectual Property","Other"] as AssetType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g., 123 Main St" />
                    </div>

                    <div className="space-y-2">
                      <Label>Identifier (optional)</Label>
                      <Input value={assetIdentifier} onChange={(e) => setAssetIdentifier(e.target.value)} placeholder="Deed / CUSIP / wallet address / note #" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Valuation (USD)</Label>
                        <Input value={assetValuationUSD} onChange={(e) => setAssetValuationUSD(e.target.value)} placeholder="e.g., 250000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Valuation As Of</Label>
                        <Input type="date" value={assetValuationAsOf} onChange={(e) => setAssetValuationAsOf(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Encumbrances (optional)</Label>
                      <Textarea value={assetEncumbrances} onChange={(e) => setAssetEncumbrances(e.target.value)} placeholder="Liens, pledges, security interests, restrictions…" />
                    </div>

                    <div className="space-y-2">
                      <Label>Evidence Notes (optional)</Label>
                      <Textarea value={assetEvidenceNotes} onChange={(e) => setAssetEvidenceNotes(e.target.value)} placeholder="Where supporting docs are stored, custodian, chain-of-title notes…" />
                    </div>

                    <Button className="w-full" onClick={addAsset} disabled={!assetName.trim()}>
                      Add Asset
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Assets ({filteredAssets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredAssets.length === 0 ? (
                        <div className="text-sm text-slate-300">No assets found.</div>
                      ) : (
                        filteredAssets.map((a) => (
                          <div key={a.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="text-lg font-semibold">{a.name}</div>
                                <div className="mt-1 text-sm text-slate-300">
                                  {a.type}
                                  {a.identifier ? ` • ${a.identifier}` : ""}
                                </div>
                                <div className="mt-2 text-xs text-slate-400">Created {a.createdAt.slice(0, 10)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-400">Valuation</div>
                                <div className="text-lg font-semibold">{a.valuationUSD ? money(a.valuationUSD) : "—"}</div>
                                <div className="text-xs text-slate-400">{a.valuationAsOf ? `as of ${a.valuationAsOf}` : ""}</div>
                                <div className="mt-3 flex justify-end">
                                  <Button variant="destructive" size="sm" onClick={() => deleteAsset(a.id)} className="gap-2">
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                            {(a.encumbrances || a.evidenceNotes) && <Separator className="my-3" />}
                            {a.encumbrances ? (
                              <div className="text-sm text-slate-200">
                                <span className="font-medium">Encumbrances:</span> {a.encumbrances}
                              </div>
                            ) : null}
                            {a.evidenceNotes ? (
                              <div className="mt-2 text-sm text-slate-200">
                                <span className="font-medium">Evidence:</span> {a.evidenceNotes}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Certificates */}
            <TabsContent value="registry" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Certificate Registry ({filteredCertificates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredCertificates.length === 0 ? (
                        <div className="text-sm text-slate-300">No certificates found.</div>
                      ) : (
                        filteredCertificates.map((c) => {
                          const onChain = Boolean(c.xrplIou);
                          return (
                          <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-lg font-semibold">{c.serialNumber}</div>
                                  <Badge variant={c.status === "Active" ? "default" : "secondary"}>{c.status}</Badge>
                                  <Badge variant="outline">{money(c.denominationUSD)}</Badge>
                                </div>
                                <div className="mt-1 text-sm text-slate-300">Owner: {c.ownerName}</div>
                                <div className="mt-1 text-xs text-slate-400">Issued {c.issuedAt.slice(0, 10)}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setIssuedPreviewId(c.id)} className="gap-2">
                                  <FileText className="h-4 w-4" />
                                  Preview
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => exportCertificateAsJson(c)} className="gap-2">
                                  <Download className="h-4 w-4" />
                                  Export
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => transferCertificate(c.id)} className="gap-2" disabled={c.status !== "Active"}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Mark Transferred
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => voidCertificate(c.id)} className="gap-2" disabled={c.status !== "Active"}>
                                  <XCircle className="h-4 w-4" />
                                  Void
                                </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteCertificate(c.id)}
                                    className="gap-2"
                                    disabled={onChain}
                                    title={onChain ? "On-chain certificate cannot be deleted" : "Delete certificate"}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                              </div>
                            </div>

                            <Separator className="my-3" />

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <div className="text-xs text-slate-400">Backed by assets</div>
                                <div className="mt-1 text-sm text-slate-200">
                                  {c.backingAssetIds.length
                                    ? c.backingAssetIds
                                        .map((id) => store.assets.find((a) => a.id === id)?.name)
                                        .filter(Boolean)
                                        .join(", ")
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Document hash</div>
                                <div className="mt-1 break-all font-mono text-xs text-slate-200">{c.documentHash}</div>
                              </div>
                            </div>

                            {c.notes ? (
                              <div className="mt-3 text-sm text-slate-200">
                                <span className="text-slate-400">Notes:</span> {c.notes}
                              </div>
                            ) : null}
                              {onChain ? <div className="mt-3 text-xs text-amber-300">Anchored on-chain; deletion disabled.</div> : null}
                          </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stamp className="h-5 w-5" />
                      Certificate Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {issuedPreview ? (
                      <CertificatePreview config={store.config} certificate={issuedPreview} assets={store.assets} />
                    ) : (
                      <div className="text-sm text-slate-300">Select a certificate to preview.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Governance (Minutes) */}
            <TabsContent value="governance" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Record Minutes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={minuteKind} onValueChange={(v) => setMinuteKind(v as MinuteKind)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Minutes">Minutes</SelectItem>
                          <SelectItem value="Resolution">Resolution</SelectItem>
                          <SelectItem value="Amendment">Amendment</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-slate-400">Minutes record events; resolutions authorize actions; amendments change governing rules.</div>
                    </div>

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={minuteTitle} onChange={(e) => setMinuteTitle(e.target.value)} placeholder="e.g., Banking Resolution" />
                    </div>

                    <div className="space-y-2">
                      <Label>Meeting Date</Label>
                      <Input type="date" value={minuteDate} onChange={(e) => setMinuteDate(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Adopted By</Label>
                      <Input value={minuteAdoptedBy} onChange={(e) => setMinuteAdoptedBy(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Body</Label>
                      <Textarea
                        value={minuteBody}
                        onChange={(e) => setMinuteBody(e.target.value)}
                        placeholder="Paste or draft the minute / resolution / amendment text here…"
                        className="min-h-[180px]"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Link Certificates (optional)</Label>
                      <div className="max-h-36 space-y-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
                        {store.certificates.length === 0 ? (
                          <div className="text-sm text-slate-400">No certificates available.</div>
                        ) : (
                          store.certificates.map((c) => {
                            const checked = minuteRelatedCertIds.includes(c.id);
                            return (
                              <label key={c.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-2 hover:bg-slate-900">
                                <div className="text-sm">
                                  {c.serialNumber} • {c.ownerName}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => setMinuteRelatedCertIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                                  className="h-4 w-4"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Link Assets (optional)</Label>
                      <div className="max-h-36 space-y-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
                        {store.assets.length === 0 ? (
                          <div className="text-sm text-slate-400">No assets available.</div>
                        ) : (
                          store.assets.map((a) => {
                            const checked = minuteRelatedAssetIds.includes(a.id);
                            return (
                              <label key={a.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-2 hover:bg-slate-900">
                                <div className="text-sm">{a.name}</div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => setMinuteRelatedAssetIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                                  className="h-4 w-4"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <Button className="w-full" onClick={addMinute} disabled={minuteBusy || !minuteTitle.trim() || !minuteBody.trim()}>
                      {minuteBusy ? "Recording…" : `Record ${minuteKind}`}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Governance Records ({filteredMinutes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredMinutes.length === 0 ? (
                        <div className="text-sm text-slate-300">No minutes / resolutions / amendments recorded.</div>
                      ) : (
                        filteredMinutes.map((m) => (
                          <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{m.kind}</Badge>
                                  <div className="text-lg font-semibold">{m.title}</div>
                                </div>
                                <div className="mt-1 text-sm text-slate-300">
                                  {m.meetingDate} • Adopted by {m.adoptedBy}
                                </div>
                                <div className="mt-2 line-clamp-3 text-sm text-slate-200">{m.body}</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" size="sm" className="gap-2" onClick={() => exportMinuteAsText(m)}>
                                  <Download className="h-4 w-4" />
                                  Export
                                </Button>
                              </div>
                            </div>

                            <Separator className="my-3" />

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <div className="text-xs text-slate-400">Linked certificates</div>
                                <div className="mt-1 text-sm text-slate-200">
                                  {m.relatedCertificateIds.length
                                    ? m.relatedCertificateIds
                                        .map((id) => store.certificates.find((c) => c.id === id)?.serialNumber)
                                        .filter(Boolean)
                                        .join(", ")
                                    : "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-400">Record hash</div>
                                <div className="mt-1 break-all font-mono text-xs text-slate-200">{m.hash}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Resolutions - shortcut view */}
            <TabsContent value="resolutions" className="mt-6">
              <Card className={NEON_TILE}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    Resolutions & Amendments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-200">Resolutions</div>
                      {store.minutes.filter((m) => m.kind === "Resolution").length === 0 ? (
                        <div className="text-sm text-slate-300">No resolutions recorded.</div>
                      ) : (
                        store.minutes
                          .filter((m) => m.kind === "Resolution")
                          .map((m) => (
                            <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                              <div className="text-base font-semibold">{m.title}</div>
                              <div className="text-sm text-slate-300">{m.meetingDate}</div>
                              <div className="mt-2 line-clamp-3 text-sm text-slate-200">{m.body}</div>
                              <div className="mt-3">
                                <Button variant="secondary" size="sm" onClick={() => exportMinuteAsText(m)} className="gap-2">
                                  <Download className="h-4 w-4" />
                                  Export
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-slate-200">Amendments</div>
                      {store.minutes.filter((m) => m.kind === "Amendment").length === 0 ? (
                        <div className="text-sm text-slate-300">No amendments recorded.</div>
                      ) : (
                        store.minutes
                          .filter((m) => m.kind === "Amendment")
                          .map((m) => (
                            <div key={m.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                              <div className="text-base font-semibold">{m.title}</div>
                              <div className="text-sm text-slate-300">{m.meetingDate}</div>
                              <div className="mt-2 line-clamp-3 text-sm text-slate-200">{m.body}</div>
                              <div className="mt-3">
                                <Button variant="secondary" size="sm" onClick={() => exportMinuteAsText(m)} className="gap-2">
                                  <Download className="h-4 w-4" />
                                  Export
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="text-sm text-slate-300">Create new resolutions and amendments in the Minutes tab by selecting the appropriate type.</div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stamp className="h-5 w-5" />
                      Trust Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Entity Type</Label>
                      <Select
                        value={store.config.entityType}
                        onValueChange={(v) => setStore((s) => ({ ...s, config: { ...s.config, entityType: v as EntityType } }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select entity type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(["Trust","LLC","Corporation","Partnership","Foundation","Nonprofit","Estate","Sole Proprietorship","Grantor","Other"] as EntityType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Entity Name</Label>
                      <Input value={store.config.entityName} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityName: e.target.value } }))} />
                    </div>

                    <div className="space-y-2">
                      <Label>Authorized Units (optional)</Label>
                      <Input
                        type="number"
                        value={store.config.unitsAuthorized ?? 100}
                        onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, unitsAuthorized: Number(e.target.value) } }))}
                        min={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Certificate Prefix</Label>
                      <Input value={store.config.certificatePrefix} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, certificatePrefix: e.target.value } }))} />
                      <div className="text-xs text-slate-400">Serial format: PREFIX-000001</div>
                    </div>

                    <div className="space-y-2">
                      <Label>Trustees Display Name</Label>
                      <Input value={store.config.trusteesDisplayName} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, trusteesDisplayName: e.target.value } }))} />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Upload Seal</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="seal-upload"
                          ref={sealInputRef}
                          type="file"
                          accept="image/*"
                          className="text-xs text-slate-200 max-w-[240px]"
                          onChange={(e) => {
                            onUploadSeal(e.target.files);
                            // allow re-selecting the same file
                            e.currentTarget.value = "";
                          }}
                        />
                        <label
                          htmlFor="seal-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Choose Seal
                        </label>
                        {store.config.sealDataUrl || sealPreviewUrl ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setStore((s) => ({ ...s, config: { ...s.config, sealDataUrl: undefined } }));
                              setSealPreviewUrl((old) => {
                                if (old) URL.revokeObjectURL(old);
                                return null;
                              });
                            }}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {sealPreviewUrl || store.config.sealDataUrl ? (
                        <img alt="Seal" src={sealPreviewUrl ?? store.config.sealDataUrl} className="mt-2 h-24 w-24 rounded-full border object-cover" />
                      ) : (
                        <div className="text-xs text-slate-400">No seal uploaded.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Upload Watermark</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="watermark-upload"
                          ref={watermarkInputRef}
                          type="file"
                          accept="image/*"
                          className="text-xs text-slate-200 max-w-[240px]"
                          onChange={(e) => {
                            onUploadWatermark(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                        <label
                          htmlFor="watermark-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Choose Watermark
                        </label>
                        {store.config.watermarkDataUrl || watermarkPreviewUrl ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setStore((s) => ({ ...s, config: { ...s.config, watermarkDataUrl: undefined } }));
                              setWatermarkPreviewUrl((old) => {
                                if (old) URL.revokeObjectURL(old);
                                return null;
                              });
                            }}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Opacity</Label>
                          <Input
                            type="number"
                            value={store.config.watermarkOpacity}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: { ...s.config, watermarkOpacity: Math.min(1, Math.max(0, Number(e.target.value))) },
                              }))
                            }
                            step={0.01}
                            min={0}
                            max={1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Scale</Label>
                          <Input
                            type="number"
                            value={store.config.watermarkScale}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: { ...s.config, watermarkScale: Math.min(2, Math.max(0.1, Number(e.target.value))) },
                              }))
                            }
                            step={0.05}
                            min={0.1}
                            max={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Rotate (deg)</Label>
                          <Input
                            type="number"
                            value={store.config.watermarkRotateDeg}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: { ...s.config, watermarkRotateDeg: Math.min(45, Math.max(-45, Number(e.target.value))) },
                              }))
                            }
                            step={1}
                            min={-45}
                            max={45}
                          />
                        </div>
                      </div>

                      {watermarkPreviewUrl || store.config.watermarkDataUrl ? (
                        <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                          <div className="text-xs text-slate-400">Watermark preview</div>
                          <div className="mt-2 flex items-center justify-center rounded-xl bg-white p-4">
                            <img
                              alt="Watermark"
                              src={watermarkPreviewUrl ?? store.config.watermarkDataUrl}
                              style={{
                                opacity: store.config.watermarkOpacity,
                                transform: `scale(${store.config.watermarkScale}) rotate(${store.config.watermarkRotateDeg}deg)`,
                                maxWidth: "70%",
                                maxHeight: "200px",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">No watermark uploaded.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>Asset Address URL</Label>
                      <Input
                        value={store.config.assetAddressUrl ?? ""}
                        onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, assetAddressUrl: e.target.value } }))}
                        placeholder="https://example.com/asset"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>Upload QR Codes & Barcode</Label>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">QR Code (lower left)</div>
                          <input
                            id="qr-upload"
                            ref={qrInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadQr(e.target.files)}
                          />
                          <label
                            htmlFor="qr-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select QR
                          </label>
                          {qrPreviewUrl || store.config.qrDataUrl ? (
                            <img alt="QR" src={qrPreviewUrl ?? store.config.qrDataUrl} className="mt-2 h-14 w-14 rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No QR uploaded.</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">Barcode (lower center)</div>
                          <input
                            id="barcode-upload"
                            ref={barcodeInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadBarcode(e.target.files)}
                          />
                          <label
                            htmlFor="barcode-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select Barcode
                          </label>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-300">Opacity</Label>
                            <Input
                              type="number"
                              value={store.config.barcodeOpacity ?? 1}
                              onChange={(e) =>
                                setStore((s) => ({
                                  ...s,
                                  config: {
                                    ...s.config,
                                    barcodeOpacity: Math.min(1, Math.max(0, Number(e.target.value))),
                                  },
                                }))
                              }
                              step={0.05}
                              min={0}
                              max={1}
                            />
                          </div>
                          {barcodePreviewUrl || store.config.barcodeDataUrl ? (
                            <img alt="Barcode" src={barcodePreviewUrl ?? store.config.barcodeDataUrl} className="mt-2 h-12 max-w-[180px] rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No barcode uploaded.</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">Notice QR (lower right)</div>
                          <input
                            id="notice-qr-upload"
                            ref={noticeQrInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadNoticeQr(e.target.files)}
                          />
                          <label
                            htmlFor="notice-qr-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select Notice QR
                          </label>
                          {noticeQrPreviewUrl || store.config.noticeQrDataUrl ? (
                            <img alt="Notice QR" src={noticeQrPreviewUrl ?? store.config.noticeQrDataUrl} className="mt-2 h-14 w-14 rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No notice QR uploaded.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Button
                        className="w-full"
                        variant={canSaveCertificateTheme ? "default" : "secondary"}
                        disabled={!canSaveCertificateTheme || saveBusy}
                        onClick={handleSaveCertificateTheme}
                      >
                        {saveBusy ? "Saving…" : "Save theme to dashboard"}
                      </Button>
                      {saveMessage ? <div className="text-xs text-slate-300">{saveMessage}</div> : null}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Danger Zone</Label>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                          localStorage.removeItem(STORE_KEY);
                          setStore(defaultStore);
                          setIssuedPreviewId(null);
                          setQuery("");
                        }}
                      >
                        Reset Local Data
                      </Button>
                      <div className="text-xs text-slate-400">Clears localStorage only. Does not affect any external system.</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stamp className="h-5 w-5" />
                      Rendering Test
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {store.certificates.length ? (
                      <div ref={renderRef}>
                      <CertificatePreview config={store.config} certificate={store.certificates[0]} assets={store.assets} />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300">Issue at least one certificate to test seal and watermark rendering.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Meetings */}
            <TabsContent value="meetings" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Meeting Minutes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Meeting Title</Label>
                      <Input
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                        placeholder="Board Meeting - Q1 2025"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Meeting Date</Label>
                      <Input
                        type="date"
                        value={meetingForm.meetingDate}
                        onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Attendees</Label>
                      <Textarea
                        value={meetingForm.attendees}
                        onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                        placeholder="John Doe, Jane Smith, Trustee Board Members"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={meetingForm.location}
                        onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                        placeholder="Virtual / Conference Room A"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Agenda</Label>
                      <Textarea
                        value={meetingForm.agenda}
                        onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
                        placeholder="1. Call to Order&#10;2. Review Previous Minutes&#10;3. Financial Report&#10;4. New Business"
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Meeting Notes</Label>
                      <Textarea
                        value={meetingForm.notes}
                        onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                        placeholder="Detailed notes from the meeting discussion..."
                        rows={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Resolutions Passed</Label>
                      <Textarea
                        value={meetingForm.resolutions}
                        onChange={(e) => setMeetingForm({ ...meetingForm, resolutions: e.target.value })}
                        placeholder="1. Approved budget for Q1&#10;2. Authorized new investment&#10;3. Elected new board member"
                        rows={4}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Upload Seal</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="meeting-seal-upload"
                          ref={meetingSealInputRef}
                          type="file"
                          accept="image/*"
                          className="text-xs text-slate-200 max-w-[240px]"
                          onChange={(e) => {
                            onUploadMeetingSeal(e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <label
                          htmlFor="meeting-seal-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Choose Seal
                        </label>
                        {meetingSealPreviewUrl ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setMeetingSealPreviewUrl((old) => {
                                if (old) URL.revokeObjectURL(old);
                                return null;
                              });
                            }}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {meetingSealPreviewUrl ? (
                        <img alt="Seal" src={meetingSealPreviewUrl} className="mt-2 h-24 w-24 rounded-full border object-cover" />
                      ) : (
                        <div className="text-xs text-slate-400">No seal uploaded.</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Upload Watermark</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="meeting-watermark-upload"
                          ref={meetingWatermarkInputRef}
                          type="file"
                          accept="image/*"
                          className="text-xs text-slate-200 max-w-[240px]"
                          onChange={(e) => {
                            onUploadMeetingWatermark(e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <label
                          htmlFor="meeting-watermark-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Choose Watermark
                        </label>
                        {meetingWatermarkPreviewUrl ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setMeetingWatermarkPreviewUrl((old) => {
                                if (old) URL.revokeObjectURL(old);
                                return null;
                              });
                            }}
                            className="gap-2"
                          >
                            <XCircle className="h-4 w-4" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {meetingWatermarkPreviewUrl ? (
                        <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
                          <div className="text-xs text-slate-400">Watermark preview</div>
                          <div className="mt-2 flex items-center justify-center rounded-xl bg-white p-4">
                            <img
                              alt="Watermark"
                              src={meetingWatermarkPreviewUrl}
                              style={{
                                opacity: store.config.watermarkOpacity,
                                transform: `scale(${store.config.watermarkScale}) rotate(${store.config.watermarkRotateDeg}deg)`,
                                maxWidth: "70%",
                                maxHeight: "200px",
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">No watermark uploaded.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>Upload QR Codes & Barcode</Label>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">QR Code</div>
                          <input
                            id="meeting-qr-upload"
                            ref={meetingQrInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadMeetingQr(e.target.files)}
                          />
                          <label
                            htmlFor="meeting-qr-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select QR
                          </label>
                          {meetingQrPreviewUrl ? (
                            <img alt="QR" src={meetingQrPreviewUrl} className="mt-2 h-14 w-14 rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No QR uploaded.</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">Barcode</div>
                          <input
                            id="meeting-barcode-upload"
                            ref={meetingBarcodeInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadMeetingBarcode(e.target.files)}
                          />
                          <label
                            htmlFor="meeting-barcode-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select Barcode
                          </label>
                          {meetingBarcodePreviewUrl ? (
                            <img alt="Barcode" src={meetingBarcodePreviewUrl} className="mt-2 h-12 max-w-[180px] rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No barcode uploaded.</div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-200">Notice QR</div>
                          <input
                            id="meeting-notice-qr-upload"
                            ref={meetingNoticeQrInputRef}
                            type="file"
                            accept="image/*"
                            className="text-xs text-slate-200 max-w-[240px]"
                            onChange={(e) => onUploadMeetingNoticeQr(e.target.files)}
                          />
                          <label
                            htmlFor="meeting-notice-qr-upload"
                            className="inline-flex items-center justify-center gap-2 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer transition-colors text-xs"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Select Notice QR
                          </label>
                          {meetingNoticeQrPreviewUrl ? (
                            <img alt="Notice QR" src={meetingNoticeQrPreviewUrl} className="mt-2 h-14 w-14 rounded border object-cover" />
                          ) : (
                            <div className="text-xs text-slate-400">No notice QR uploaded.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <Button
                      onClick={saveMeeting}
                      className="w-full gap-2"
                      disabled={!meetingForm.title || !meetingForm.meetingDate}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Save Meeting Minutes
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Meeting Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div ref={meetingRenderRef} className="bg-white text-black p-8 rounded-lg border relative min-h-[600px]">
                      {/* Watermark overlay - positioned behind content */}
                      {meetingWatermarkPreviewUrl && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <img
                            src={meetingWatermarkPreviewUrl}
                            alt="Watermark"
                            style={{
                              opacity: store.config.watermarkOpacity,
                              transform: `scale(${store.config.watermarkScale}) rotate(${store.config.watermarkRotateDeg}deg)`,
                              maxWidth: "60%",
                              maxHeight: "60%",
                            }}
                            className="object-contain"
                          />
                        </div>
                      )}

                      {/* Seal - positioned top right */}
                      {meetingSealPreviewUrl && (
                        <div className="absolute top-4 right-4 w-16 h-16 rounded-full border border-gray-300 bg-white p-1 shadow-lg">
                          <img
                            src={meetingSealPreviewUrl}
                            alt="Seal"
                            className="w-full h-full rounded-full object-cover"
                          />
                        </div>
                      )}

                      {/* Main content */}
                      <div className="relative z-10">
                        <div className="text-center mb-8">
                          <h1 className="text-2xl font-bold mb-2">{store.config.entityName}</h1>
                          <h2 className="text-xl font-semibold">{meetingForm.title || "Meeting Title"}</h2>
                          <p className="text-gray-600 mt-2">
                            {meetingForm.meetingDate ? new Date(meetingForm.meetingDate).toLocaleDateString() : "Meeting Date"}
                          </p>
                          <p className="text-gray-600">{meetingForm.location || "Location"}</p>
                        </div>

                        <div className="mb-6">
                          <h3 className="font-bold text-lg mb-2">Attendees</h3>
                          <p className="text-sm">{meetingForm.attendees || "List of attendees..."}</p>
                        </div>

                        <div className="mb-6">
                          <h3 className="font-bold text-lg mb-2">Agenda</h3>
                          <div className="text-sm whitespace-pre-line">{meetingForm.agenda || "Meeting agenda..."}</div>
                        </div>

                        <div className="mb-6">
                          <h3 className="font-bold text-lg mb-2">Meeting Notes</h3>
                          <div className="text-sm whitespace-pre-line">{meetingForm.notes || "Detailed meeting notes..."}</div>
                        </div>

                        <div className="mb-12">
                          <h3 className="font-bold text-lg mb-2">Resolutions Passed</h3>
                          <div className="text-sm whitespace-pre-line">{meetingForm.resolutions || "List of resolutions..."}</div>
                        </div>

                        {/* Electronic Signature Section */}
                        <div className="mt-8 pt-8 border-t border-gray-300">
                          <p className="text-sm mb-8 italic text-center">
                            The undersigned Trustee hereby adopts and approves the foregoing minutes and resolutions as of the date written.
                          </p>

                          <div className="space-y-4">
                            <div className="flex justify-between items-end">
                              <div className="flex-1">
                                <div className="border-b border-gray-400 w-full h-8 mb-2"></div>
                                <p className="text-xs text-gray-600 text-center">Signature</p>
                              </div>
                              <div className="flex-1 ml-8">
                                <div className="border-b border-gray-400 w-full h-8 mb-2"></div>
                                <p className="text-xs text-gray-600 text-center">Date</p>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold">{store.config.trusteesDisplayName}</p>
                              <p className="text-xs text-gray-600">Trustee</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom section with QR codes and barcode positioned in quadrants */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                        {/* Bottom Left Quadrant - QR Code */}
                        <div className="flex-shrink-0">
                          {meetingQrPreviewUrl && (
                            <img src={meetingQrPreviewUrl} alt="QR Code" className="w-12 h-12 object-contain" />
                          )}
                        </div>

                        {/* Bottom Center Quadrant - Barcode with opacity */}
                        <div className="flex-shrink-0">
                          {meetingBarcodePreviewUrl && (
                            <img
                              src={meetingBarcodePreviewUrl}
                              alt="Barcode"
                              style={{
                                opacity: store.config.barcodeOpacity ?? 1,
                              }}
                              className="h-10 max-w-[120px] object-contain"
                            />
                          )}
                        </div>

                        {/* Bottom Right Quadrant - Notice QR */}
                        <div className="flex-shrink-0">
                          {meetingNoticeQrPreviewUrl && (
                            <img src={meetingNoticeQrPreviewUrl} alt="Notice QR" className="w-12 h-12 object-contain" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}


