"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import MobileWalletButton from "@/components/MobileWalletButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isFeatureEnabled } from "@/lib/features";
import type { TrustRecordsJarvaDraftFields } from "@/lib/trust-records/trust-records-jarva-fields";
import { parseTrustRecordsStatePayload } from "@/lib/trust-records/parse-trust-records-state-payload";
import {
  accountAssetToTrustRecordsAsset,
  deleteAccountAsset,
  loadAccountAssets,
  setLastActiveAccountId,
  subscribeAccountAssets,
  trustRecordsAssetToAccountAsset,
  upsertAccountAsset,
} from "@/lib/accountAssets";
import { isUuidLike, loadLatestTrustDraft, saveTrustDraft } from "@/lib/trusts/client";
import { showSessionStrip, hideSessionStrip } from "@/lib/session-strip";
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
  ScrollText,
  Menu,
  ChevronDown,
} from "lucide-react";
import MinutesList from "@/components/governance/minutes/MinutesList";
import { DeedsCard } from "@/components/trust/DeedsCard";
import { RealEstateTransferToolsCard } from "@/components/trust/RealEstateTransferToolsCard";
import { AgentAssistPanel } from "@/components/smart-trust/AgentAssistPanel";
import { ScenePlansSection } from "@/components/trust-records/ScenePlansSection";
import { InstrumentsSection } from "@/components/trust-records/InstrumentsSection";
import { checkEntityEligibility, getEntityTypeDisplayName } from "@/lib/entityEligibility";
import { resolveAgentModuleType } from "@/lib/agent/module-resolver";
import {
  SMART_TRUST_PLATFORM_BINDING_KEY,
  loadSmartTrustPlatformBinding,
  saveSmartTrustPlatformBinding,
  type SmartTrustPlatformBinding,
} from "@/lib/smart-trust-platform-binding";
import { useTrustActiveServerOptional } from "@/context/TrustActiveServerContext";
import { JURISDICTION_OPTIONS } from "@/config/usStates";
import {
  jarvaHandoffSuggestedTrustRecordsTabIfAbsent,
  jarvaHandoffTrustRecordsBondRegistryContinuityLine,
  parseJarvaHandoff,
  jarvaHandoffTrustRecordsTabForLane,
} from "@/lib/jarva/jarva-handoff";
import { cn } from "@/lib/utils";

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

// Helper functions for entity validation
function isCommercialEntityType(assetType: AssetType): boolean {
  // Note: This function checks asset types that represent commercial entities
  // In a real implementation, you might have a separate field or extend AssetType
  return false; // For now, disable this check since AssetType doesn't include entity types
}

function mapAssetTypeToEntityType(assetType: AssetType): "c_corporation" | "s_corporation" | "llc" | "lp" | "llp" | null {
  // This mapping is not applicable for the current AssetType enum
  // In a real implementation, you'd extend AssetType or add a separate entityType field
  return null;
}

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

type BondInterestType = "fixed" | "variable";
type BondPaymentFrequency = "monthly" | "quarterly" | "annual";
type BondSeniority = "senior" | "subordinated";
type BondStatus = "Active" | "Matured" | "Redeemed" | "Defaulted" | "Voided";

type BondInstrument = {
  id: UUID;
  bondNumber: string;
  issuedAt: string;
  holderName: string;
  principalAmountUSD: number;
  interestRatePct: number;
  interestType: BondInterestType;
  paymentFrequency: BondPaymentFrequency;
  maturityDate: string;
  seniority: BondSeniority;
  callable: boolean;
  collateralDescription?: string;
  governingLaw: string;
  ppmDocumentId: string;
  notes?: string;
  status: BondStatus;
  documentHash: string;
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
  firmName?: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  entityAddressLine1?: string;
  entityAddressLine2?: string;
  entityCity?: string;
  entityState?: string;
  entityPostalCode?: string;
  entityCountry?: string;
  grantorName?: string;
  trusteeName?: string;
  grantorAddressLine1?: string;
  grantorAddressLine2?: string;
  grantorCity?: string;
  grantorState?: string;
  grantorPostalCode?: string;
  grantorCountry?: string;
  trusteeAddressLine1?: string;
  trusteeAddressLine2?: string;
  trusteeCity?: string;
  trusteeState?: string;
  trusteePostalCode?: string;
  trusteeCountry?: string;
  consultantName?: string;
  consultantAddressLine1?: string;
  consultantAddressLine2?: string;
  consultantCity?: string;
  consultantState?: string;
  consultantPostalCode?: string;
  consultantCountry?: string;
  trustProtectorName?: string;
  trustProtectorAddressLine1?: string;
  trustProtectorAddressLine2?: string;
  trustProtectorCity?: string;
  trustProtectorState?: string;
  trustProtectorPostalCode?: string;
  trustProtectorCountry?: string;
  managerName?: string;
  managerAddressLine1?: string;
  managerAddressLine2?: string;
  managerCity?: string;
  managerState?: string;
  managerPostalCode?: string;
  managerCountry?: string;
  // Canonical Trust Taxonomy (Authoritative)
  trustCategory?: "private" | "charitable" | "statutory";
  moduleType?: "revocable_living_trust" | "private_express_trust" | "irrevocable_trust" | "religious_foundation" | "family_office" | "parent_company" | "testamentary_trust" | "special_purpose_trust";
  formationMode?: "express" | "resulting" | "constructive";
  governanceMode?: "simple" | "complex";
  commercialEnabled?: boolean;
  sCorpEligible?: boolean;
  trustSubtype?: "standard" | "grantor" | "QSST" | "ESBT";
  irsElectionConfirmed?: boolean;
  unitsAuthorized?: number; // e.g., 100
  certificatePrefix: string; // e.g., "TTC"
  bondPrefix: string; // e.g., "BND"
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
  clientAuthorityTitle?: string; // Trustee, CEO, etc. – who the consultant is working with
} & TrustRecordsJarvaDraftFields;

type WorkspacePartyRole = "grantor" | "trustee" | "consultant" | "trust_protector" | "manager";

const CLIENT_AUTHORITY_TITLES = [
  "Trustee",
  "Steward",
  "Managing Member",
  "Executive",
  "CEO",
  "CFO",
  "President",
  "VP",
  "Owner",
  "Grantor/Settlor",
] as const;

type WorkspaceSummary = {
  trust: {
    id: string;
    clientId: string | null;
    name: string | null;
    trustType: string | null;
    jurisdictionState: string | null;
    workspaceStatus: string | null;
  };
  parties?: {
    grantorName?: string | null;
    trusteeName?: string | null;
    grantorAddress?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    trusteeAddress?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
  };
  firm?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  counts?: {
    parties: number;
    beneficiaries: number;
    assets: number;
  };
};

type ClientSummary = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  title?: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
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

const TRUST_RECORDS_WORKSPACE_JUR_KEY = "trust_records_workspace_jurisdiction_v1";

function loadWorkspaceJurisdiction(): string {
  if (typeof window === "undefined") return "NY";
  try {
    const raw = window.localStorage.getItem(TRUST_RECORDS_WORKSPACE_JUR_KEY);
    return (raw || "NY").trim() || "NY";
  } catch {
    return "NY";
  }
}

function saveWorkspaceJurisdiction(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRUST_RECORDS_WORKSPACE_JUR_KEY, value);
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function displayEntityName(config: TrustConfig) {
  const name = (config.entityName || "").trim();
  return name || "Entity Name";
}

/** True when Jarva has written any draft fields into this Trust Records config (trust-records-state). */
function hasJarvaDraftSnapshot(config: TrustConfig): boolean {
  if (config.jarvaTrustRecordsSyncedAt?.trim()) return true;
  if (config.jarvaPourOverWillIntentFlag === true || config.jarvaPourOverWillIntentFlag === false) return true;
  const texts = [
    config.jarvaObjectivesDraft,
    config.jarvaBeneficiariesSummaryDraft,
    config.jarvaSuccessorTrusteeNote,
    config.jarvaJurisdictionAmbiguityNote,
    config.jarvaAssetScheduleNotesDraft,
  ];
  return texts.some((t) => typeof t === "string" && t.trim().length > 0);
}

/** Workspace ID label based on entity type (e.g., "Trust ID", "LLC ID", "Workspace ID") */
function getWorkspaceIdLabel(entityType: EntityType): string {
  if (entityType === "Other") return "Workspace ID";
  return `${entityType} ID`;
}

/** Select placeholder based on entity type (e.g., "Select trust", "Select LLC") */
function getSelectWorkspacePlaceholder(entityType: EntityType): string {
  const e = entityType.toLowerCase();
  return `Select ${e}…`;
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
  bonds: BondInstrument[];
  minutes: MinuteRecord[];
  meetings: MeetingRecord[];
  serialCounter: number;
  bondSerialCounter: number;
};

const defaultStore: StoreState = {
  config: {
    entityType: "Trust",
    entityName: "Trust Name Here",
    firmName: "",
    firmAddress: "",
    firmPhone: "",
    firmEmail: "",
    entityAddressLine1: "",
    entityAddressLine2: "",
    entityCity: "",
    entityState: "",
    entityPostalCode: "",
    entityCountry: "US",
    grantorName: "",
    trusteeName: "",
    grantorAddressLine1: "",
    grantorAddressLine2: "",
    grantorCity: "",
    grantorState: "",
    grantorPostalCode: "",
    grantorCountry: "US",
    trusteeAddressLine1: "",
    trusteeAddressLine2: "",
    trusteeCity: "",
    trusteeState: "",
    trusteePostalCode: "",
    trusteeCountry: "US",
    consultantName: "",
    consultantAddressLine1: "",
    consultantAddressLine2: "",
    consultantCity: "",
    consultantState: "",
    consultantPostalCode: "",
    consultantCountry: "US",
    trustProtectorName: "",
    trustProtectorAddressLine1: "",
    trustProtectorAddressLine2: "",
    trustProtectorCity: "",
    trustProtectorState: "",
    trustProtectorPostalCode: "",
    trustProtectorCountry: "US",
    managerName: "",
    managerAddressLine1: "",
    managerAddressLine2: "",
    managerCity: "",
    managerState: "",
    managerPostalCode: "",
    managerCountry: "US",
    unitsAuthorized: 100,
    certificatePrefix: "TTC",
    bondPrefix: "BND",
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
    clientAuthorityTitle: "",
  },
  assets: [],
  certificates: [],
  bonds: [],
  minutes: [],
  meetings: [],
  serialCounter: 1,
  bondSerialCounter: 1,
};

function pruneDataUrl(dataUrl?: string) {
  if (!dataUrl) return undefined;
  return dataUrl.length > MAX_INLINE_IMAGE_BYTES ? undefined : dataUrl;
}

function loadStore(): StoreState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore;
    const parsed: unknown = JSON.parse(raw);
    return parseTrustRecordsStatePayload(parsed, defaultStore);
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
              {isFeatureEnabled("TRUST_TAXONOMY") && (
                <>
                  {config.trustCategory && (
                    <Badge variant="outline" className="border-blue-500 text-blue-700">
                      {config.trustCategory === "private" ? "Private Trust" : config.trustCategory === "charitable" ? "Charitable Trust" : "Statutory Trust"}
                    </Badge>
                  )}
                  {config.formationMode && (
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      {config.formationMode === "express" ? "Express Trust" : config.formationMode}
                    </Badge>
                  )}
                  {config.governanceMode && (
                    <Badge variant="outline" className="border-orange-500 text-orange-700">
                      {config.governanceMode === "complex" ? "Complex Governance" : "Simple Governance"}
                    </Badge>
                  )}
                  {config.commercialEnabled && (
                    <Badge variant="outline" className="border-red-500 text-red-700">
                      Commercial Entity Ownership
                    </Badge>
                  )}
                </>
              )}
              {config.sCorpEligible && (
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  S Corp Eligible
                </Badge>
              )}
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
  const searchParams = useSearchParams();
  const trustActiveServer = useTrustActiveServerOptional();

  // Note: Trust records page uses token gate (TROO/NFT) for access, not admin session.
  // Admin session validation happens at the operation level (create/save trusts) not page level.

  // Token gate (Polygon TROO)
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onPolygon = chainId === 137;
  const walletType = address?.startsWith("0x") ? "metamask" : null;

  const heroReads = useReadContracts({
    contracts: HERO_1155_TOKEN_IDS.map((id) => ({
      address: HERO_1155_CONTRACT,
      abi: ERC1155_ABI,
      functionName: "balanceOf" as const,
      args: address ? [address as `0x${string}`, id] : undefined,
      chainId: 137,
    })),
    query: { enabled: Boolean(address && address.startsWith("0x")) },
  });

  const heroBalances = (heroReads.data ?? []).map((item: unknown) => {
    const r = item && typeof item === "object" && "result" in item ? (item as { result?: bigint }).result : item;
    return Number(typeof r === "bigint" ? r : 0n);
  });
  const heroAny = heroBalances.some((b) => b > 0);
  const heroLoadingAny = heroReads.isLoading;






  // Token gate is now NFT-only
  const isTokenHolder = isConnected && address?.startsWith("0x") && heroAny;
  const gatePending = isConnected && address?.startsWith("0x") && heroLoadingAny;
  const networkOk = chainId === 137;
  const shouldShowNetworkWarning =
    Boolean(isConnected && address?.startsWith("0x")) &&
    typeof chainId === "number" &&
    chainId !== 137;


  const [store, setStore] = useState<StoreState>(() => loadStore());
  const [binding, setBinding] = useState<SmartTrustPlatformBinding>(() => loadSmartTrustPlatformBinding());
  const [workspacePartyRole, setWorkspacePartyRole] = useState<WorkspacePartyRole>("grantor");
  const [platformBusy, setPlatformBusy] = useState(false);
  const [platformErr, setPlatformErr] = useState<string | null>(null);
  const [fillFromClientBusy, setFillFromClientBusy] = useState(false);
  const [workspaceJurisdiction, setWorkspaceJurisdiction] = useState<string>(() => loadWorkspaceJurisdiction());
  const [trustOptions, setTrustOptions] = useState<
    Array<{
      id: string;
      name: string | null;
      trustType: string | null;
      jurisdictionState: string | null;
      workspaceStatus: string | null;
      createdAt: string | null;
    }>
  >([]);
  const [trustOptionsStatus, setTrustOptionsStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null);
  const [workspaceSummaryStatus, setWorkspaceSummaryStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [clientSummary, setClientSummary] = useState<ClientSummary | null>(null);
  const [clientSummaryStatus, setClientSummaryStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [trustId, setTrustId] = useState<string | null>(null);
  const [trustIdStatus, setTrustIdStatus] = useState<"resolving" | "ready" | "error" | "idle">("resolving");
  const [draftLoadStatus, setDraftLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [serverDraftVersion, setServerDraftVersion] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const accountId = useMemo(() => (address ? address.toLowerCase() : null), [address]);

  useEffect(() => {
    saveSmartTrustPlatformBinding(binding);
  }, [binding]);

  useEffect(() => {
    saveWorkspaceJurisdiction(workspaceJurisdiction);
  }, [workspaceJurisdiction]);

  // Cross-tab sync only; do NOT listen to SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT here —
  // we're the one who dispatches it via saveSmartTrustPlatformBinding, so that would cause an infinite loop
  useEffect(() => {
    const refresh = () => setBinding(loadSmartTrustPlatformBinding());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_PLATFORM_BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Sync clientId/trustId from URL into binding so Create Client Record → return → Create Trust Workspace flows correctly
  useEffect(() => {
    const fromParams = (key: string) =>
      (searchParams?.get(key) || "").trim() ||
      (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(key) || "" : "").trim();
    const clientId = fromParams("clientId");
    const incomingTrustId = fromParams("trustId");
    if (!clientId && !incomingTrustId) return;
    setBinding((b) => ({
      ...b,
      clientId: clientId || b.clientId,
      trustId: incomingTrustId || b.trustId,
      bindingValid: incomingTrustId ? "unknown" : b.bindingValid ?? "unknown",
      lastUpdatedAt: new Date().toISOString(),
    }));
  }, [searchParams]);

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

  useEffect(() => {
    const clientId = binding.clientId;
    if (!clientId) {
      setTrustOptions([]);
      setTrustOptionsStatus("idle");
      return;
    }
    let active = true;
    setTrustOptionsStatus("loading");
    fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load trusts");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTrustOptions(Array.isArray(data?.items) ? data.items : []);
        setTrustOptionsStatus("loaded");
      })
      .catch(() => {
        if (!active) return;
        setTrustOptions([]);
        setTrustOptionsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [binding.clientId]);

  // Phase B: canonical trustId resolution and draft load/save (hard to regress).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTrustIdStatus("resolving");
      setSaveError(null);

      // 1) URL query param
      const urlTidRaw = (searchParams?.get("trustId") || "").trim();
      const urlTid = urlTidRaw && isUuidLike(urlTidRaw) ? urlTidRaw : "";

      if (!urlTid) {
        if (cancelled) return;
        setTrustIdStatus("idle");
        setTrustId(null);
        setDraftLoadStatus("idle");
        return;
      }

      if (!urlTid || !isUuidLike(urlTid)) {
        if (cancelled) return;
        setTrustIdStatus("error");
        setTrustId(null);
        setSaveError("Invalid trustId; could not resolve a valid canonical trustId.");
        return;
      }

      if (cancelled) return;
      setTrustId(urlTid);
      setTrustIdStatus("ready");
      console.info("trust_records_trustId_resolved", { source: "url", trustId: urlTid });

      // Prefer server draft; local cache is rollback/offline only.
      setDraftLoadStatus("loading");
      try {
        const draft = await loadLatestTrustDraft({ trustId: urlTid, draftType: "trust-records-state" });
        if (cancelled) return;
        if (draft?.payload) {
          setStore(parseTrustRecordsStatePayload(draft.payload, defaultStore));
          setServerDraftVersion(draft.version ?? null);
          setDraftLoadStatus("loaded");
          console.info("trust_records_draft_loaded", { serverVersion: draft.version ?? null });
          return;
        }

        // No server draft yet: try local cache keyed by trustId.
          try {
            const raw = window.localStorage.getItem(`trust_records_state_cache_${urlTid}`);
            if (raw) {
              const cached: unknown = JSON.parse(raw);
              setStore(parseTrustRecordsStatePayload(cached, defaultStore));
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
  }, [router, searchParams]);
  const [trustRole, setTrustRole] = useState<"Manager" | "Trustee">("Manager");
  const [hydratedFromServer, setHydratedFromServer] = useState(false);
  const [activeTab, setActiveTab] = useState("issue");
  const [isTabPending, startTabTransition] = useTransition();
  const [tokenStatusCollapsed, setTokenStatusCollapsed] = useState(true);

  // Global quick search
  const [query, setQuery] = useState("");
  const [debugHit, setDebugHit] = useState<string | null>(null);
  const [debugHitsEnabled, setDebugHitsEnabled] = useState(false);
  const [smartDraft, setSmartDraft] = useState<any | null>(null);
  const [smartDraftStatus, setSmartDraftStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const effectiveTrustId = useMemo(() => {
    const fromState = (trustId || "").trim();
    const fromBinding = (binding.trustId || "").trim();
    return fromState || fromBinding || null;
  }, [binding.trustId, trustId]);

  const effectiveClientId = useMemo(() => {
    const fromBinding = (binding.clientId || "").trim();
    const fromWorkspace = (workspaceSummary?.trust?.clientId || "").trim();
    const fromClientSummary = (clientSummary?.id || "").trim();
    return fromBinding || fromWorkspace || fromClientSummary || null;
  }, [binding.clientId, workspaceSummary?.trust?.clientId, clientSummary?.id]);

  const agentModuleType = resolveAgentModuleType({
    explicitModuleType: store.config.moduleType,
    draftModuleType: smartDraft?.moduleType,
    entityType: smartDraft?.entityType,
    trustType: workspaceSummary?.trust?.trustType,
    constitutionSubtype: smartDraft?.constitutionSubtype,
    governanceDocs: smartDraft?.governanceDocs,
    source: "trust-records",
  });
  const shouldShowAgent = Boolean(effectiveTrustId);
  const agentDraft = smartDraft ?? { stateVersion: 0 };

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    setDebugHitsEnabled(params.get("debugHits") === "1");
  }, []);

  useEffect(() => {
    const tab = (searchParams?.get("tab") || "").trim();
    if (!tab) return;
    const allowed = new Set([
      "issue",
      "assets",
      "registry",
      "bonds",
      "governance",
      "resolutions",
      "estate",
      "meetings",
      "settings",
      "instruments",
    ]);
    if (allowed.has(tab)) {
      startTabTransition(() => setActiveTab(tab));
    }
  }, [searchParams, startTabTransition]);

  useEffect(() => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    const suggested = jarvaHandoffSuggestedTrustRecordsTabIfAbsent(sp);
    if (!suggested) return;
    const next = new URLSearchParams(sp.toString());
    next.set("tab", suggested);
    const qs = next.toString();
    const path = typeof window !== "undefined" ? window.location.pathname : "/trust-records";
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }, [searchParams, router]);

  const jarvaHandoffTabRing = useMemo(() => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    const h = parseJarvaHandoff(sp);
    if (!h) return null;
    return jarvaHandoffTrustRecordsTabForLane(h.lane);
  }, [searchParams]);

  const jarvaBondRegistryBanner = useMemo(() => {
    const h = parseJarvaHandoff(new URLSearchParams(searchParams?.toString() ?? ""));
    return Boolean(h?.lane === "trust_bond" && activeTab === "bonds");
  }, [searchParams, activeTab]);

  useEffect(() => {
    const id = trustId;
    if (!id) {
      setSmartDraft(null);
      setSmartDraftStatus("idle");
      return;
    }
    let active = true;
    setSmartDraftStatus("loading");
    fetch(`/api/trusts/${encodeURIComponent(id)}/smart-trust-draft`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load smart trust draft");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSmartDraft(data?.draft ?? null);
        setSmartDraftStatus("loaded");
      })
      .catch(() => {
        if (!active) return;
        setSmartDraft(null);
        setSmartDraftStatus("error");
      });
    return () => {
      active = false;
    };
  }, [trustId]);

  const applyWorkspaceAutofill = useCallback((summary: WorkspaceSummary) => {
    const trustName = summary.trust?.name?.trim() || "";
    const trusteeName = summary.parties?.trusteeName?.trim() || "";
    const grantorName = summary.parties?.grantorName?.trim() || "";
    const trustType = summary.trust?.trustType || undefined;
    const trusteeAddress = summary.parties?.trusteeAddress || null;
    const grantorAddress = summary.parties?.grantorAddress || null;
    const firm = summary.firm || null;

    setStore((s) => {
      const next = { ...s, config: { ...s.config } };
      if (!next.config.entityName || next.config.entityName === "Trust Name Here") {
        if (trustName) next.config.entityName = trustName;
      }
      if (!next.config.entityType) {
        next.config.entityType = "Trust";
      }
      if (!next.config.moduleType && trustType) {
        next.config.moduleType = trustType as TrustConfig["moduleType"];
      }
      if (!next.config.grantorName && grantorName) next.config.grantorName = grantorName;
      if (!next.config.trusteeName && trusteeName) next.config.trusteeName = trusteeName;
      if (!next.config.trusteesDisplayName || next.config.trusteesDisplayName === "Board of Trustees") {
        const bestName = trusteeName || grantorName;
        if (bestName) next.config.trusteesDisplayName = bestName;
      }
      if (trusteeAddress) {
        if (!next.config.trusteeAddressLine1) next.config.trusteeAddressLine1 = trusteeAddress.line1 || "";
        if (!next.config.trusteeAddressLine2) next.config.trusteeAddressLine2 = trusteeAddress.line2 || "";
        if (!next.config.trusteeCity) next.config.trusteeCity = trusteeAddress.city || "";
        if (!next.config.trusteeState) next.config.trusteeState = trusteeAddress.state || "";
        if (!next.config.trusteePostalCode) next.config.trusteePostalCode = trusteeAddress.postalCode || "";
        if (!next.config.trusteeCountry) next.config.trusteeCountry = trusteeAddress.country || "US";
      }
      if (grantorAddress) {
        if (!next.config.grantorAddressLine1) next.config.grantorAddressLine1 = grantorAddress.line1 || "";
        if (!next.config.grantorAddressLine2) next.config.grantorAddressLine2 = grantorAddress.line2 || "";
        if (!next.config.grantorCity) next.config.grantorCity = grantorAddress.city || "";
        if (!next.config.grantorState) next.config.grantorState = grantorAddress.state || "";
        if (!next.config.grantorPostalCode) next.config.grantorPostalCode = grantorAddress.postalCode || "";
        if (!next.config.grantorCountry) next.config.grantorCountry = grantorAddress.country || "US";
      }
      if (firm) {
        if (!next.config.firmName) next.config.firmName = firm.name || "";
        if (!next.config.firmAddress) next.config.firmAddress = firm.address || "";
        if (!next.config.firmPhone) next.config.firmPhone = firm.phone || "";
        if (!next.config.firmEmail) next.config.firmEmail = firm.email || "";
      }
      return next;
    });
  }, []);

  const applyClientAutofill = useCallback((client: ClientSummary) => {
    setStore((s) => {
      const next = { ...s, config: { ...s.config } };
      if (client.title && !next.config.clientAuthorityTitle) next.config.clientAuthorityTitle = client.title;
      if (!next.config.entityAddressLine1) next.config.entityAddressLine1 = client.address.line1 || "";
      if (!next.config.entityAddressLine2) next.config.entityAddressLine2 = client.address.line2 || "";
      if (!next.config.entityCity) next.config.entityCity = client.address.city || "";
      if (!next.config.entityState) next.config.entityState = client.address.state || "";
      if (!next.config.entityPostalCode) next.config.entityPostalCode = client.address.postalCode || "";
      if (!next.config.entityCountry) next.config.entityCountry = client.address.country || "US";
      return next;
    });
  }, []);

  const fillGrantorFromClient = useCallback(async () => {
    const cid = effectiveClientId ?? workspaceSummary?.trust?.clientId ?? binding.clientId ?? null;
    if (!cid || !trustId || fillFromClientBusy) return;
    setFillFromClientBusy(true);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/parties/fill-from-client`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Fill failed"));
      const data = await res.json();
      const applied = data?.applied;
      const clientTitle = data?.clientTitle ?? null;
      if (applied || clientTitle) {
        setStore((s) => ({
          ...s,
          config: {
            ...s.config,
            grantorName: applied?.grantorName ?? s.config.grantorName,
            grantorAddressLine1: applied?.grantorAddressLine1 ?? s.config.grantorAddressLine1,
            grantorAddressLine2: applied?.grantorAddressLine2 ?? s.config.grantorAddressLine2,
            grantorCity: applied?.grantorCity ?? s.config.grantorCity,
            grantorState: applied?.grantorState ?? s.config.grantorState,
            grantorPostalCode: applied?.grantorPostalCode ?? s.config.grantorPostalCode,
            grantorCountry: applied?.grantorCountry ?? s.config.grantorCountry,
            clientAuthorityTitle: clientTitle ?? s.config.clientAuthorityTitle,
          },
        }));
      }
      setWorkspaceSummaryStatus("loading");
      const sumRes = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/workspace/summary`, { credentials: "include" });
      if (sumRes.ok) {
        const sum = await sumRes.json();
        setWorkspaceSummary(sum);
      }
    } catch (e: any) {
      setPlatformErr(String(e?.message ?? e ?? "Fill from client failed"));
    } finally {
      setFillFromClientBusy(false);
    }
  }, [effectiveClientId, workspaceSummary?.trust?.clientId, binding.clientId, trustId, fillFromClientBusy]);

  useEffect(() => {
    const id = trustId;
    if (!id) {
      setWorkspaceSummary(null);
      setWorkspaceSummaryStatus("idle");
      return;
    }
    let active = true;
    setWorkspaceSummaryStatus("loading");
    fetch(`/api/trusts/${encodeURIComponent(id)}/workspace/summary`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load workspace summary");
        return res.json();
      })
      .then((data: WorkspaceSummary) => {
        if (!active) return;
        setWorkspaceSummary(data);
        setWorkspaceSummaryStatus("loaded");
        applyWorkspaceAutofill(data);
      })
      .catch(() => {
        if (!active) return;
        setWorkspaceSummary(null);
        setWorkspaceSummaryStatus("error");
      });
    return () => {
      active = false;
    };
  }, [trustId, applyWorkspaceAutofill]);

  /** Jarva apply / auto-sync: refresh checklist + workspace summary without full page reload */
  useEffect(() => {
    const id = trustId;
    if (!id || typeof window === "undefined") return;
    const onJarvaWorkspace = (ev: Event) => {
      const ce = ev as CustomEvent<{ trustId?: string; summary?: WorkspaceSummary }>;
      if (ce.detail?.trustId !== id) return;
      if (ce.detail.summary) {
        setWorkspaceSummary(ce.detail.summary);
        setWorkspaceSummaryStatus("loaded");
        applyWorkspaceAutofill(ce.detail.summary);
        return;
      }
      void fetch(`/api/trusts/${encodeURIComponent(id)}/workspace/summary`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: WorkspaceSummary | null) => {
          if (data) {
            setWorkspaceSummary(data);
            setWorkspaceSummaryStatus("loaded");
            applyWorkspaceAutofill(data);
          }
        });
    };
    window.addEventListener("jarva-workspace-updated", onJarvaWorkspace as EventListener);
    return () => window.removeEventListener("jarva-workspace-updated", onJarvaWorkspace as EventListener);
  }, [trustId, applyWorkspaceAutofill]);

  useEffect(() => {
    const clientId = workspaceSummary?.trust?.clientId ?? binding.clientId ?? null;
    if (!clientId) {
      setClientSummary(null);
      setClientSummaryStatus("idle");
      return;
    }
    let active = true;
    setClientSummaryStatus("loading");
    fetch(`/api/clients/${encodeURIComponent(clientId)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load client");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const client = data?.client as ClientSummary | undefined;
        if (!client) {
          setClientSummary(null);
          setClientSummaryStatus("error");
          return;
        }
        setClientSummary(client);
        setClientSummaryStatus("loaded");
        applyClientAutofill(client);
      })
      .catch(() => {
        if (!active) return;
        setClientSummary(null);
        setClientSummaryStatus("error");
      });
    return () => {
      active = false;
    };
  }, [workspaceSummary?.trust?.clientId, binding.clientId, applyClientAutofill]);

  useEffect(() => {
    if (!debugHitsEnabled) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const describe = (el: HTMLElement | null) => {
        if (!el) return "none";
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className ? `.${String(el.className).replace(/\s+/g, ".")}` : "";
        const tag = el.tagName?.toLowerCase() || "unknown";
        const style = window.getComputedStyle(el);
        return `${tag}${id}${cls} (z:${style.zIndex}, pe:${style.pointerEvents}, pos:${style.position})`;
      };
      const targetDesc = describe(target);
      const hitDesc = describe(hit);
      setDebugHit(`target: ${targetDesc} | top: ${hitDesc}`);
      console.info("trust-records_debug_hit", {
        target: targetDesc,
        top: hitDesc,
        x: event.clientX,
        y: event.clientY,
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [debugHitsEnabled]);

  async function createTrustWorkspace() {
    if (platformBusy) return;
    setPlatformErr(null);
    const clientId = binding.clientId;
    if (!clientId) {
      setPlatformErr("Client ID is required. Create or bind a Client first.");
      return;
    }
    const jurisdiction_state = (workspaceJurisdiction || "NY").trim();
    if (!jurisdiction_state) {
      setPlatformErr("Jurisdiction state is required.");
      return;
    }
    const trust_type = store.config.moduleType || "revocable_living_trust";
    const name = (store.config.entityName || "Trust Workspace").trim();
    if (!name) {
      setPlatformErr("Entity name is required.");
      return;
    }

    setPlatformBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trust_type, jurisdiction_state, name }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const nextTrustId = String(data?.trustId || "");
      if (!nextTrustId) throw new Error("Trust creation succeeded but no trustId was returned.");

      setBinding((b) => ({ ...b, trustId: nextTrustId, bindingValid: "unknown", lastUpdatedAt: new Date().toISOString() }));
      showSessionStrip();
      setTrustId(nextTrustId);
      setTrustIdStatus("ready");
      try {
        window.localStorage.setItem("current_trust_records_trustId", nextTrustId);
      } catch {
        // ignore
      }
      try {
        const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        next.set("trustId", nextTrustId);
        router.replace(`/trust-records?${next.toString()}`);
      } catch {
        // ignore
      }

      // Persist the current trust-records state under this trustId.
      try {
        await saveTrustDraft({
          trustId: nextTrustId,
          draftType: "trust-records-state",
          schemaVersion: 1,
          payload: store,
        });
      } catch {
        // best-effort
      }
    } catch (e: any) {
      setPlatformErr(String(e?.message || e || "Failed to create workspace"));
    } finally {
      setPlatformBusy(false);
    }
  }

  async function syncDraftToPlatform() {
    if (platformBusy) return;
    setPlatformErr(null);
    if (!trustId) {
      setPlatformErr("Workspace ID is required to sync. Create a workspace first.");
      return;
    }
    setPlatformBusy(true);
    try {
      await saveTrustDraft({
        trustId,
        draftType: "trust-records-state",
        schemaVersion: 1,
        payload: store,
      });
      setBinding((b) => ({ ...b, lastUpdatedAt: new Date().toISOString() }));
    } catch (e: any) {
      setPlatformErr(String(e?.message || e || "Failed to sync draft"));
    } finally {
      setPlatformBusy(false);
    }
  }

  const clearBinding = useCallback(() => {
    hideSessionStrip();
    setBinding({ clientId: null, trustId: null, lastUpdatedAt: null, bindingValid: "unknown" });
    setTrustId(null);
    setTrustIdStatus("idle");
    setSmartDraft(null);
    setSmartDraftStatus("idle");
    setWorkspaceSummary(null);
    setWorkspaceSummaryStatus("idle");
    setClientSummary(null);
    setClientSummaryStatus("idle");
    setPlatformErr(null);

    try {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.delete("trustId");
      next.delete("clientId");
      next.delete("createdClient");
      const qs = next.toString();
      router.replace(qs ? `/trust-records?${qs}` : "/trust-records");
    } catch {
      router.replace("/trust-records");
    }
  }, [router, searchParams]);

  const clientCreateHref = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("origin", "trust-records");
    sp.set("returnTo", "/trust-records");
    return `/clients/new?${sp.toString()}`;
  }, []);

  const existingTrustClientHref = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("origin", "trust-records");
    sp.set("returnTo", "/trust-records");
    sp.set("existingTrust", "1");
    return `/clients/new?${sp.toString()}`;
  }, []);

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

  // Bond issuance form
  const [bondHolderName, setBondHolderName] = useState("Bondholder Name");
  const [bondPrincipalUSD, setBondPrincipalUSD] = useState<number>(100000);
  const [bondInterestRatePct, setBondInterestRatePct] = useState<number>(6);
  const [bondInterestType, setBondInterestType] = useState<BondInterestType>("fixed");
  const [bondPaymentFrequency, setBondPaymentFrequency] = useState<BondPaymentFrequency>("quarterly");
  const [bondMaturityDate, setBondMaturityDate] = useState(isoDateOnly());
  const [bondSeniority, setBondSeniority] = useState<BondSeniority>("senior");
  const [bondCallable, setBondCallable] = useState(false);
  const [bondCollateralDescription, setBondCollateralDescription] = useState("");
  const [bondGoverningLaw, setBondGoverningLaw] = useState("NY");
  const [bondNotes, setBondNotes] = useState("");
  const [bondPpmDocumentId, setBondPpmDocumentId] = useState<string>("");
  const [bondIssueBusy, setBondIssueBusy] = useState(false);
  const [bondIssueError, setBondIssueError] = useState<string | null>(null);
  const [bondPdfNotice, setBondPdfNotice] = useState<string | null>(null);
  const [ppmDocs, setPpmDocs] = useState<Array<{ id: string; title: string; docType: string }>>([]);
  const [instrumentDocs, setInstrumentDocs] = useState<
    Array<{
      id: string;
      title: string;
      docType: string;
      updatedAt?: string | null;
      anchorTx?: string | null;
      downloadUrl?: string | null;
    }>
  >([]);

  useEffect(() => {
    if (!trustId) {
      setPpmDocs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/documents`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const items: Array<{
          id: string;
          title: string;
          docType: string;
          updatedAt?: string | null;
          anchorTx?: string | null;
          downloadUrl?: string | null;
        }> = Array.isArray(data?.items) ? data.items : [];
        const ppmItems = items.filter((d) => String(d.docType || "").toLowerCase().includes("ppm"));
        setPpmDocs(ppmItems);
        const instrItems = items.filter((d) => {
          const type = String(d.docType || "").toLowerCase();
          return type.includes("promissory") || type.includes("bill of exchange") || type.includes("ucc-1");
        });
        setInstrumentDocs(instrItems);
        if (!bondPpmDocumentId && ppmItems.length > 0) {
          setBondPpmDocumentId(ppmItems[0].id);
        }
      } catch {
        if (!cancelled) setPpmDocs([]);
        if (!cancelled) setInstrumentDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustId, bondPpmDocumentId]);

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

  // Role from Trust Records layout server snapshot (same GET /me); avoids a duplicate fetch when wrapped by layout.
  useEffect(() => {
    if (trustActiveServer) {
      if (!trustActiveServer.serverMeLoaded) return;
      const r = trustActiveServer.activeTrustRole;
      if (r === "Manager" || r === "Trustee") setTrustRole(r);
      setHydratedFromServer(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trust-records/me", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const role = data?.active?.role ?? data?.role;
        if (role === "Manager" || role === "Trustee") setTrustRole(role);
        setHydratedFromServer(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trustActiveServer]);

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

  const filteredBonds = useMemo(() => {
    if (!query.trim()) return store.bonds;
    const q = query.toLowerCase();
    return store.bonds.filter(
      (b) =>
        b.bondNumber.toLowerCase().includes(q) ||
        b.holderName.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        b.governingLaw.toLowerCase().includes(q) ||
        (b.notes ?? "").toLowerCase().includes(q)
    );
  }, [store.bonds, query]);

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

  const activeClientName = useMemo(() => {
    if (!clientSummary) return null;
    return [clientSummary.firstName, clientSummary.middleName, clientSummary.lastName, clientSummary.suffix]
      .filter((part) => Boolean(part && String(part).trim()))
      .map((part) => String(part).trim())
      .join(" ");
  }, [clientSummary]);

  const activeTrustName = useMemo(() => {
    return (
      workspaceSummary?.trust?.name?.trim() ||
      store.config.entityName?.trim() ||
      null
    );
  }, [workspaceSummary?.trust?.name, store.config.entityName]);

  const totalBackedValue = useMemo(() => {
    const selected = store.assets.filter((a) => selectedAssetIds.includes(a.id));
    return selected.reduce((sum, a) => sum + (a.valuationUSD ?? 0), 0);
  }, [store.assets, selectedAssetIds]);

  const assistantGuidance = useMemo(() => {
    const blockers: string[] = [];
    const advisories: string[] = [];
    let requiredCount = 0;
    let completedCount = 0;

    const requireField = (ok: boolean, label: string) => {
      requiredCount += 1;
      if (ok) {
        completedCount += 1;
      } else {
        blockers.push(`${label} is required.`);
      }
    };

    requireField(Boolean(trustId), getWorkspaceIdLabel(store.config.entityType));

    if (activeTab === "settings") {
      requireField(Boolean(store.config.entityType), "Entity Type");
      requireField(Boolean((store.config.trustCategory || "").trim()), "Trust Category");
      requireField(Boolean((store.config.formationMode || "").trim()), "Formation Mode");
      requireField(Boolean((store.config.governanceMode || "").trim()), "Governance Mode");
      requireField(Boolean((store.config.trustSubtype || "").trim()), "Trust Subtype");

      if (store.config.sCorpEligible && !store.config.irsElectionConfirmed) {
        advisories.push("S Corporation eligibility is enabled but IRS election is not yet confirmed.");
      }
      if (store.config.commercialEnabled && store.config.governanceMode !== "complex") {
        advisories.push("Commercial activity is enabled; consider Complex Governance for entity ownership controls.");
      }
    } else if (activeTab === "issue") {
      requireField(Boolean(ownerName.trim()), "Certificate owner name");
      requireField(Number.isFinite(denominationUSD) && denominationUSD > 0, "Certificate denomination");
      requireField(selectedAssetIds.length > 0, "At least one backing asset");

      if (!isTokenHolder) {
        blockers.push("Token gate: connect a qualifying wallet on Polygon before issuing certificates.");
      } else if (!networkOk) {
        blockers.push("Switch wallet network to Polygon before issuing certificates.");
      }
    } else if (activeTab === "bonds") {
      requireField(Boolean(bondHolderName.trim()), "Bond holder name");
      requireField(Number.isFinite(bondPrincipalUSD) && bondPrincipalUSD > 0, "Bond principal amount");
      requireField(Boolean((bondPpmDocumentId || "").trim()), "PPM reference document");
    }

    const completionPct =
      requiredCount > 0
        ? Math.round((completedCount / requiredCount) * 100)
        : 0;

    return { blockers, advisories, completionPct };
  }, [
    activeTab,
    bondHolderName,
    bondPpmDocumentId,
    bondPrincipalUSD,
    denominationUSD,
    isTokenHolder,
    networkOk,
    ownerName,
    selectedAssetIds.length,
    store.config.commercialEnabled,
    store.config.entityType,
    store.config.formationMode,
    store.config.governanceMode,
    store.config.irsElectionConfirmed,
    store.config.sCorpEligible,
    store.config.trustCategory,
    store.config.trustSubtype,
    trustId,
  ]);

  const renderingPreviewCertificate = useMemo<Certificate>(() => {
    if (issuedPreview) return issuedPreview;
    if (store.certificates.length > 0) return store.certificates[0]!;
    return {
      id: "preview-certificate",
      serialNumber: `${store.config.certificatePrefix || "TTC"}-PREVIEW`,
      issuedAt: nowIso(),
      denominationUSD: Number.isFinite(denominationUSD) && denominationUSD > 0 ? denominationUSD : 1000,
      ownerName: ownerName.trim() || "Draft Owner",
      notes: certNotes.trim() || "Live preview generated from current Issue form inputs.",
      status: "Active",
      backingAssetIds: selectedAssetIds,
      documentHash: "preview-only-not-issued",
    };
  }, [
    certNotes,
    denominationUSD,
    issuedPreview,
    ownerName,
    selectedAssetIds,
    store.certificates,
    store.config.certificatePrefix,
  ]);

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

  async function handleIssueBond() {
    if (trustRole !== "Manager") {
      setBondIssueError("Only Managers can issue bonds. Trustees can sign bond certificates.");
      return;
    }
    if (trustIdStatus !== "ready" || !trustId) {
      setBondIssueError("Workspace ID is required to issue a bond.");
      return;
    }
    if (!isTokenHolder) {
      setBondIssueError(`Token gate: connect a wallet holding the required NFT on Polygon to issue bonds.`);
      return;
    }
    if (!networkOk) {
      setBondIssueError("Network: switch to Polygon network to issue bonds.");
      return;
    }
    if (!bondHolderName.trim() || !Number.isFinite(bondPrincipalUSD) || bondPrincipalUSD <= 0) return;
    if (!Number.isFinite(bondInterestRatePct) || bondInterestRatePct < 0) return;
    if (!bondMaturityDate.trim() || !bondGoverningLaw.trim()) return;
    if (!bondPpmDocumentId) {
      setBondIssueError("Select a PPM document before issuing a bond.");
      return;
    }

    setBondIssueBusy(true);
    setBondIssueError(null);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/bonds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderName: bondHolderName.trim(),
          principalAmountUSD: bondPrincipalUSD,
          interestRatePct: bondInterestRatePct,
          interestType: bondInterestType,
          paymentFrequency: bondPaymentFrequency,
          maturityDate: bondMaturityDate,
          seniority: bondSeniority,
          callable: bondCallable,
          collateralDescription: bondCollateralDescription.trim() || undefined,
          governingLaw: bondGoverningLaw.trim(),
          ppmDocumentId: bondPpmDocumentId,
          bondPrefix: store.config.bondPrefix,
          notes: bondNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Bond issuance failed");
      }
      const data = await res.json();
      const bond: BondInstrument | undefined = data?.bond;
      if (!bond?.id) throw new Error("Bond issuance failed");

      setStore((s) => ({
        ...s,
        bonds: bond ? [bond, ...s.bonds] : s.bonds,
        bondSerialCounter: s.bondSerialCounter + 1,
      }));

      setActiveTab("bonds");

      setBondHolderName("");
      setBondNotes("");
      setBondCollateralDescription("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setBondIssueError(msg);
    } finally {
      setBondIssueBusy(false);
    }
  }

  function addAsset() {
    if (!assetName.trim()) return;

    // Validate entity eligibility for commercial assets
    if (isCommercialEntityType(assetType)) {
      const trustClassification = {
        trustCategory: store.config.trustCategory || "private",
        moduleType: "special_purpose_trust" as const, // Default for trust records context
        formationMode: store.config.formationMode || "express",
        commercialEnabled: store.config.commercialEnabled || false,
        governanceMode: store.config.governanceMode || "simple",
        sCorpEligible: store.config.sCorpEligible || false,
        trustSubtype: store.config.trustSubtype || "standard",
        irsElectionConfirmed: store.config.irsElectionConfirmed || false,
      };

      const entityType = mapAssetTypeToEntityType(assetType);
      if (entityType) {
        const eligibility = checkEntityEligibility(trustClassification, entityType);
        if (!eligibility.eligible) {
          alert(`Cannot add ${getEntityTypeDisplayName(entityType)}: ${eligibility.reason}\n\nRequirements: ${eligibility.requirements?.join(', ')}`);
          return;
        }
      }
    }

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

  function updateBondStatus(id: UUID, status: BondStatus) {
    setStore((s) => ({
      ...s,
      bonds: s.bonds.map((b) => (b.id === id ? { ...b, status } : b)),
    }));
  }

  async function deleteCertificate(id: UUID) {
    // Delete from local state
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

    // Update the persistent store to prevent reappearance
    const currentStore = loadStore();
    const updatedStore = {
      ...currentStore,
      certificates: currentStore.certificates.filter((c: Certificate) => c.id !== id),
      minutes: currentStore.minutes.map((m: MinuteRecord) => ({
        ...m,
        relatedCertificateIds: m.relatedCertificateIds.filter((cid: UUID) => cid !== id),
      })),
    };
    saveStore(updatedStore);
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

    // Delete from shared account assets storage
    if (accountId) {
      deleteAccountAsset(accountId, id);
    }

    // Also update the legacy trust records store to prevent reappearance
    const currentStore = loadStore();
    const updatedStore = {
      ...currentStore,
      assets: currentStore.assets.filter((a: Asset) => a.id !== id),
      certificates: currentStore.certificates.map((c: Certificate) => ({
        ...c,
        backingAssetIds: c.backingAssetIds.filter((aid: UUID) => aid !== id),
      })),
      minutes: currentStore.minutes.map((m: MinuteRecord) => ({
        ...m,
        relatedAssetIds: m.relatedAssetIds.filter((aid: UUID) => aid !== id),
      })),
    };
    saveStore(updatedStore);

    // Also delete from legacy trust-console storage if it exists
    try {
      const legacyStoreRaw = localStorage.getItem(STORE_KEY);
      if (legacyStoreRaw) {
        const legacyStore = JSON.parse(legacyStoreRaw);
        if (legacyStore.assets) {
          legacyStore.assets = legacyStore.assets.filter((a: any) => a.id !== id);
          localStorage.setItem(STORE_KEY, JSON.stringify(legacyStore));
        }
      }
    } catch (error) {
      console.warn('Error cleaning up legacy asset storage:', error);
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
          trustId: trustId ?? null,
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

  const showOnboardingBanner = !isTokenHolder && !gatePending;
  const showTokenGateBanner = !isConnected || (!gatePending && !isTokenHolder);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        {showTokenGateBanner ? (
          <Alert className="mb-6 border-cyan-500/40 bg-cyan-950/20">
            <AlertTitle className="flex items-center gap-2 text-cyan-200">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              {isConnected
                ? gatePending
                  ? "Checking NFT..."
                  : "NFT required for certificate issuance"
                : "Connect wallet for full access"}
            </AlertTitle>
            <AlertDescription className="text-slate-300">
              {showOnboardingBanner ? (
                <>
                  You can create a Client record and Trust workspace below. Certificate and bond issuance require a
                  wallet holding the Hero NFT on Polygon. {!isConnected ? <span className="mt-2 inline-block"><MobileWalletButton /></span> : null}
                </>
              ) : (
                <>
                  {gatePending
                    ? "Verifying NFT balance..."
                    : isConnected
                    ? networkOk
                      ? "Connect a wallet with the required ERC1155 NFT on Polygon to issue certificates."
                      : "Switch to Polygon network."
                    : "Connect your wallet to enable certificate issuance."}
                  {!isConnected ? <span className="mt-2 inline-block"><MobileWalletButton /></span> : null}
                </>
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {searchParams?.get("createdClient") === "1" && binding.clientId ? (
          <Alert className="mb-6 border-emerald-500/40 bg-emerald-950/20">
            <AlertTitle className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Client created
            </AlertTitle>
            <AlertDescription>
              Client record is bound. Create a workspace below to continue, or paste an existing workspace ID.
            </AlertDescription>
          </Alert>
        ) : null}
        {debugHitsEnabled ? (
          <div className="fixed right-4 top-4 z-[999] max-w-[480px] rounded-lg border border-amber-500/50 bg-amber-950/90 p-3 text-xs text-amber-100 shadow-lg pointer-events-none">
            <div className="font-semibold text-amber-200">Debug Hits (click anywhere)</div>
            <div className="mt-1 break-words">{debugHit || "No clicks yet."}</div>
            <div className="mt-1 text-amber-300/80">Disable with ?debugHits=0</div>
          </div>
        ) : null}
        {shouldShowAgent ? (
          <Card className="mb-6 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Consultant Guided Assistant</CardTitle>
              <CardDescription>
                The assistant starts once a workspace is selected. It will guide the consultant through the workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentAssistPanel
                draft={agentDraft}
                setDraft={(updater) => setSmartDraft((prev: any) => updater(prev))}
                readiness={{ blockers: assistantGuidance.blockers.length, advisories: assistantGuidance.advisories.length }}
                moduleType={agentModuleType}
                playbookId={smartDraft?.playbookId}
                autoStart={Boolean(effectiveTrustId)}
                agentSource="trust-records"
                trustId={effectiveTrustId ?? undefined}
                workspaceId={effectiveTrustId ?? undefined}
                clientId={effectiveClientId ?? undefined}
                clientName={activeClientName ?? undefined}
                trustName={activeTrustName ?? undefined}
                currentStep={activeTab}
                contextBlockers={assistantGuidance.blockers}
                contextAdvisories={assistantGuidance.advisories}
                completionPctOverride={assistantGuidance.completionPct}
              />
              {smartDraftStatus === "loading" ? (
                <div className="mt-2 text-xs text-slate-400">Loading Smart Trust draft for this workspace…</div>
              ) : smartDraftStatus === "error" ? (
                <div className="mt-2 text-xs text-amber-300">
                  Smart Trust draft not found for this workspace. Agent Assist is using fallback context.
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        {/* Network warning banner for token holders not on Polygon */}
        {shouldShowNetworkWarning && (
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

        {instrumentDocs.length > 0 ? (
          <Card className="mb-6 rounded-2xl border border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Legal Instruments</CardTitle>
              <CardDescription>
                Generated in the Legal Instruments workspace and anchored to this trust.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              {instrumentDocs.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                  <div className="font-semibold">{doc.title}</div>
                  <div className="text-xs text-slate-400">{doc.docType}</div>
                  <div className="mt-1 text-xs text-slate-400">Instrument ID: {doc.id}</div>
                  {doc.anchorTx ? (
                    <div className="mt-1 text-xs text-slate-400">Witness Tx: {doc.anchorTx}</div>
                  ) : null}
                  {doc.downloadUrl ? (
                    <div className="mt-2">
                      <a
                        className="text-xs text-cyan-300 underline"
                        href={doc.downloadUrl}
                      >
                        Download PDF
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

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
          </div>

          {/* Navigation Dropdown (top-right actions) */}
          <div className="flex justify-end mt-2 md:mt-0 relative z-[200] pointer-events-auto">
            <div className="relative group pointer-events-auto">
              <Button
                variant="secondary"
                type="button"
                className="gap-2 transition-all duration-200 hover:bg-slate-700 hover:scale-[1.02] hover:shadow-lg"
                aria-haspopup="menu"
                aria-expanded="false"
                title="Consultant quick links"
              >
                <Menu className="h-4 w-4" />
                Consultant Links
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="pointer-events-none absolute right-0 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-slate-200 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                Hover to open links
              </div>
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-xl opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                <a
                  href="/dashboard"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Dashboard
                  </span>
                  <span className="text-xs text-slate-400">Back to dashboard</span>
                </a>
                <a
                  href="/smart-trust"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    Smart Trust
                  </span>
                  <span className="text-xs text-slate-400">Open builder</span>
                </a>
                <a
                  href="https://boiefiling.fincen.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    BOI Reporting
                  </span>
                  <span className="text-xs text-slate-400">External</span>
                </a>
                <a
                  href={trustId ? `/ppm?trustId=${trustId}` : "#"}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 ${
                    trustId ? "hover:bg-slate-800" : "opacity-50 pointer-events-none"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PPM
                  </span>
                  <span className="text-xs text-slate-400">Requires trust</span>
                </a>
                <a
                  href="/trust-records/hybrid-ledger"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Hybrid Ledger (RFC)
                  </span>
                  <span className="text-xs text-slate-400">Beta</span>
                </a>
                <a
                  href="/besu-bundle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    BESU
                  </span>
                  <span className="text-xs text-slate-400">Bundle</span>
                </a>
                <button
                  type="button"
                  onClick={exportJson}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export JSON
                  </span>
                  <span className="text-xs text-slate-400">Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-6 ${NEON_TILE} p-4`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-1">
              <div className="text-xs uppercase tracking-wider text-slate-400">Platform Binding</div>
              <div className="text-sm text-slate-200">
                Client ID: <span className="font-mono">{binding.clientId || "—"}</span>
              </div>
              <div className="text-sm text-slate-200">
                {getWorkspaceIdLabel(store.config.entityType)}: <span className="font-mono">{binding.trustId || trustId || "—"}</span>
              </div>
              <div className="text-xs text-slate-400">
                Last synced: <span className="font-mono">{binding.lastUpdatedAt || "—"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-700 px-3 py-1 text-xs">
                <span className="text-slate-400">Jurisdiction</span>
                <Select
                  value={workspaceJurisdiction || "NY"}
                  onValueChange={(v) => setWorkspaceJurisdiction(v)}
                >
                  <SelectTrigger className="h-7 w-[140px] border-slate-700 bg-slate-900/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JURISDICTION_OPTIONS.map((j) => (
                      <SelectItem key={j.code} value={j.code}>
                        {j.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-700 px-3 py-1 text-xs">
                <span className="text-slate-400">{store.config.entityType}</span>
                <Select
                  value={trustId ?? "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      router.replace("/trust-records");
                      return;
                    }
                    setBinding((b) => ({
                      ...b,
                      trustId: value,
                      bindingValid: "unknown",
                      lastUpdatedAt: new Date().toISOString(),
                    }));
                    showSessionStrip();
                    router.replace(`/trust-records?trustId=${value}`);
                  }}
                >
                  <SelectTrigger className="relative z-20 h-7 w-[220px] border-slate-700 bg-slate-900/60 text-xs">
                    <SelectValue placeholder={trustOptionsStatus === "loading" ? `Loading ${store.config.entityType.toLowerCase()}s...` : `Select ${store.config.entityType.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent className="z-[1200] max-h-72">
                    <SelectItem value="none">{getSelectWorkspacePlaceholder(store.config.entityType)}</SelectItem>
                    {trustId && !trustOptions.some((trust) => trust.id === trustId) ? (
                      <SelectItem value={trustId}>
                        {`Current Workspace • ${trustId}`}
                      </SelectItem>
                    ) : null}
                    {trustOptions.map((trust) => {
                      const label = [
                        trust.name || "Untitled Trust",
                        trust.jurisdictionState ? trust.jurisdictionState.toUpperCase() : null,
                        trust.trustType || null,
                        trust.id ? trust.id.slice(0, 8) : null,
                      ]
                        .filter(Boolean)
                        .join(" • ");
                      return (
                        <SelectItem key={trust.id} value={trust.id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                onClick={createTrustWorkspace}
                className="gap-2 transition-all duration-200 hover:bg-slate-700 hover:scale-105 hover:shadow-lg"
                disabled={platformBusy || !binding.clientId}
              >
                <Landmark className="h-4 w-4" />
                {platformBusy ? "Creating…" : "Create workspace"}
              </Button>
              <Button
                variant="secondary"
                onClick={syncDraftToPlatform}
                className="gap-2 transition-all duration-200 hover:bg-slate-700 hover:scale-105 hover:shadow-lg"
                disabled={platformBusy || !trustId}
              >
                <FilePlus2 className="h-4 w-4" />
                Sync Draft
              </Button>
              <Button asChild variant="secondary" className="gap-2 transition-all duration-200 hover:bg-slate-700 hover:scale-105 hover:shadow-lg">
                <Link href={clientCreateHref}>
                  <Landmark className="h-4 w-4" />
                  Create Client Record
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                <Link href={existingTrustClientHref}>
                  Client with existing trust or company
                </Link>
              </Button>
              <Button
                variant="secondary"
                onClick={clearBinding}
                className="gap-2 transition-all duration-200 hover:bg-slate-700 hover:scale-105 hover:shadow-lg"
                disabled={platformBusy}
              >
                Clear Binding
              </Button>
            </div>
          </div>
          {platformErr ? (
            <div className="mt-3">
              <Alert className="border-red-500/50 bg-red-950/30">
                <AlertTitle className="text-red-300">Platform action failed</AlertTitle>
                <AlertDescription className="text-red-200">{platformErr}</AlertDescription>
              </Alert>
            </div>
          ) : null}
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

        {trustId && hasJarvaDraftSnapshot(store.config) ? (
          <div className={`mt-4 ${NEON_TILE} border border-amber-500/25 p-4`}>
            <div className="flex flex-col gap-2 gap-y-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-400/90">Jarva — draft intake snapshot</div>
                <p className="mt-1 max-w-2xl text-xs text-slate-500">
                  Intake-derived text from Jarva apply / sync. DRAFT for consultant review — not legal advice, not a
                  final instrument, and not a substitute for counsel review of dispositive intent or titling.
                </p>
              </div>
              <div className="shrink-0">
                <Button asChild variant="outline" size="sm" className="border-amber-500/40 text-amber-200/90">
                  <Link href={`/trust-records/jarva?trustId=${encodeURIComponent(trustId)}`}>Open Jarva intake</Link>
                </Button>
              </div>
            </div>
            {store.config.jarvaTrustRecordsSyncedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Last synced to Trust Records store:{" "}
                <span className="font-mono text-slate-400">
                  {new Date(store.config.jarvaTrustRecordsSyncedAt).toLocaleString()}
                </span>
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {store.config.jarvaObjectivesDraft?.trim() ? (
                <div>
                  <div className="text-xs font-medium text-slate-400">Objectives (draft)</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{store.config.jarvaObjectivesDraft}</p>
                </div>
              ) : null}
              {store.config.jarvaBeneficiariesSummaryDraft?.trim() ? (
                <div>
                  <div className="text-xs font-medium text-slate-400">Beneficiaries summary (draft)</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                    {store.config.jarvaBeneficiariesSummaryDraft}
                  </p>
                </div>
              ) : null}
              {store.config.jarvaSuccessorTrusteeNote?.trim() ? (
                <div>
                  <div className="text-xs font-medium text-slate-400">Successor trustees (draft)</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                    {store.config.jarvaSuccessorTrusteeNote}
                  </p>
                </div>
              ) : null}
              {store.config.jarvaJurisdictionAmbiguityNote?.trim() ? (
                <div>
                  <div className="text-xs font-medium text-slate-400">Jurisdiction notes (draft)</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                    {store.config.jarvaJurisdictionAmbiguityNote}
                  </p>
                </div>
              ) : null}
              {store.config.jarvaAssetScheduleNotesDraft?.trim() ? (
                <div className="md:col-span-2">
                  <div className="text-xs font-medium text-slate-400">Asset / schedule notes (draft, non-authoritative)</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                    {store.config.jarvaAssetScheduleNotesDraft}
                  </p>
                </div>
              ) : null}
              {store.config.jarvaPourOverWillIntentFlag === true || store.config.jarvaPourOverWillIntentFlag === false ? (
                <div>
                  <div className="text-xs font-medium text-slate-400">Pour-over will intent (routing flag)</div>
                  <p className="mt-1 text-sm text-slate-300">
                    {store.config.jarvaPourOverWillIntentFlag ? "Yes" : "No"} — confirm with counsel; not a legal conclusion.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={`mt-4 ${NEON_TILE_DARK} p-4`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              onClick={() => setTokenStatusCollapsed(!tokenStatusCollapsed)}
              className="flex items-center gap-2 text-left hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors w-fit"
            >
              <div className="text-xs uppercase tracking-wider text-slate-400">Token Status</div>
              <div className="text-slate-400 text-sm">
                {tokenStatusCollapsed ? "▶" : "▼"}
              </div>
            </button>
          </div>

          {!tokenStatusCollapsed && (
            <div>
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
          )}

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

        <div className="mt-6 relative z-[150] pointer-events-auto">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              startTabTransition(() => setActiveTab(v));
              const next = new URLSearchParams(searchParams?.toString() ?? "");
              next.set("tab", v);
              const qs = next.toString();
              router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
            }}
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-900 md:grid-cols-10 pointer-events-auto">
              <TabsTrigger
                value="settings"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "settings" &&
                    activeTab === "settings" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <Stamp className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="assets"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "assets" &&
                    activeTab === "assets" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <Database className="h-4 w-4" />
                Assets
              </TabsTrigger>
              <TabsTrigger
                value="issue"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "issue" &&
                    activeTab === "issue" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <FilePlus2 className="h-4 w-4" />
                Issue
              </TabsTrigger>
              <TabsTrigger
                value="instruments"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "instruments" &&
                    activeTab === "instruments" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <Landmark className="h-4 w-4" />
                Instruments
              </TabsTrigger>
              <TabsTrigger
                value="registry"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "registry" &&
                    activeTab === "registry" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <ClipboardList className="h-4 w-4" />
                Certificates
              </TabsTrigger>
              <TabsTrigger
                value="bonds"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "bonds" &&
                    activeTab === "bonds" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <Landmark className="h-4 w-4" />
                Bonds
              </TabsTrigger>
              <TabsTrigger
                value="governance"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "governance" &&
                    activeTab === "governance" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <FileText className="h-4 w-4" />
                Minutes
              </TabsTrigger>
              <TabsTrigger
                value="resolutions"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "resolutions" &&
                    activeTab === "resolutions" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <Scale className="h-4 w-4" />
                Resolutions
              </TabsTrigger>
              <TabsTrigger
                value="estate"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "estate" &&
                    activeTab === "estate" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <ScrollText className="h-4 w-4" />
                Estate
              </TabsTrigger>
              <TabsTrigger
                value="meetings"
                className={cn(
                  "gap-2 pointer-events-auto",
                  jarvaHandoffTabRing === "meetings" &&
                    activeTab === "meetings" &&
                    "ring-2 ring-cyan-500/40 rounded-md ring-offset-2 ring-offset-slate-900",
                )}
              >
                <FileText className="h-4 w-4" />
                Meetings
              </TabsTrigger>
            </TabsList>

            {/* Instruments */}
            <TabsContent value="instruments" className="mt-6">
              <InstrumentsSection trustId={trustId} />
            </TabsContent>

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
                                  if (data?.state) setStore(parseTrustRecordsStatePayload(data.state, defaultStore));
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
                                    if (data?.state) setStore(parseTrustRecordsStatePayload(data.state, defaultStore));
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

                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="h-5 w-5" />
                      Issue New Bond (Debt Instrument)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Bondholder Name</Label>
                        <Input value={bondHolderName} onChange={(e) => setBondHolderName(e.target.value)} placeholder="Full legal name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Principal (USD)</Label>
                        <Input
                          type="number"
                          value={bondPrincipalUSD}
                          onChange={(e) => setBondPrincipalUSD(Number(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Interest Rate (%)</Label>
                        <Input
                          type="number"
                          value={bondInterestRatePct}
                          onChange={(e) => setBondInterestRatePct(Number(e.target.value))}
                          min={0}
                          step={0.01}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interest Type</Label>
                        <Select value={bondInterestType} onValueChange={(v) => setBondInterestType(v as BondInterestType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="variable">Variable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Frequency</Label>
                        <Select value={bondPaymentFrequency} onValueChange={(v) => setBondPaymentFrequency(v as BondPaymentFrequency)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annual">Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Maturity Date</Label>
                        <Input type="date" value={bondMaturityDate} onChange={(e) => setBondMaturityDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Seniority</Label>
                        <Select value={bondSeniority} onValueChange={(v) => setBondSeniority(v as BondSeniority)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="senior">Senior</SelectItem>
                            <SelectItem value="subordinated">Subordinated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Governing Law</Label>
                        <Input value={bondGoverningLaw} onChange={(e) => setBondGoverningLaw(e.target.value)} placeholder="e.g., NY" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox checked={bondCallable} onCheckedChange={(v) => setBondCallable(Boolean(v))} />
                      <div className="text-sm">Callable (issuer option to redeem early)</div>
                    </div>

                    <div className="space-y-2">
                      <Label>Collateral Description (optional)</Label>
                      <Textarea value={bondCollateralDescription} onChange={(e) => setBondCollateralDescription(e.target.value)} placeholder="Describe pledged collateral or security interests…" />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Textarea value={bondNotes} onChange={(e) => setBondNotes(e.target.value)} placeholder="Additional information about this bond…" />
                    </div>

                    <div className="space-y-2">
                      <Label>PPM Reference (required)</Label>
                      <Select value={bondPpmDocumentId} onValueChange={(v) => setBondPpmDocumentId(v)}>
                        <SelectTrigger><SelectValue placeholder="Select a PPM document" /></SelectTrigger>
                        <SelectContent>
                          {ppmDocs.length === 0 ? (
                            <SelectItem value="no_ppm" disabled>No PPM documents found</SelectItem>
                          ) : (
                            ppmDocs.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-slate-400">
                        Bonds require a PPM reference. Generate one in the PPM wizard if needed.
                      </div>
                    </div>

                    {bondIssueError ? (
                      <Alert className="border-red-900/40 bg-red-950/30">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>Issuance failed</AlertTitle>
                        <AlertDescription className="text-slate-200">{bondIssueError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Button
                      className="w-full gap-2"
                      onClick={handleIssueBond}
                      disabled={
                        bondIssueBusy ||
                        trustRole !== "Manager" ||
                        trustIdStatus !== "ready" ||
                        !isTokenHolder ||
                        !networkOk ||
                        !bondHolderName.trim() ||
                        bondPrincipalUSD <= 0 ||
                        !bondPpmDocumentId
                      }
                    >
                      <Landmark className="h-4 w-4" />
                      {bondIssueBusy ? "Issuing…" : "Issue Bond"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className={`${NEON_TILE} lg:col-span-2`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Bond + PPM Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
                      <div className="font-semibold">PPM linkage required</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Bonds must reference a PPM document for issuance. Select a PPM on the left or generate one.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={trustId ? `/ppm?trustId=${encodeURIComponent(trustId)}` : "#"}>
                            Open PPM Wizard
                          </a>
                        </Button>
                        {trustId ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={`/trusts/${encodeURIComponent(trustId)}/issue-security`}>
                              Issue Security (PPM Pack)
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                      PPM documents available: <span className="text-slate-200">{ppmDocs.length}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Assets */}
            <TabsContent value="assets" className="mt-6">
              {trustId && (
                <div className="space-y-6">
                  <RealEstateTransferToolsCard trustId={trustId} />
                  <DeedsCard trustId={trustId} />
                </div>
              )}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 mt-6">
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
                      <select
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value as AssetType)}
                        className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Asset Type"
                      >
                        {(["Cash","Real Estate","Security","Promissory Note","Digital Asset","Intellectual Property","Other"] as AssetType[]).map((t) => (
                          <option key={t} value={t} className="bg-slate-950 text-slate-100">
                            {t}
                          </option>
                        ))}
                      </select>
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

            {/* Bonds */}
            <TabsContent value="bonds" className="mt-6">
              {jarvaBondRegistryBanner ? (
                <Alert className="mb-4 rounded-2xl border-violet-500/30 bg-violet-950/20">
                  <AlertDescription className="text-slate-200">{jarvaHandoffTrustRecordsBondRegistryContinuityLine()}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Card className={`${NEON_TILE} lg:col-span-3`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="h-5 w-5" />
                      Bond Registry ({filteredBonds.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bondPdfNotice ? (
                      <Alert className="mb-4 border-cyan-900/40 bg-cyan-950/30">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Bond PDF</AlertTitle>
                        <AlertDescription className="text-slate-200">{bondPdfNotice}</AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="space-y-3">
                      {filteredBonds.length === 0 ? (
                        <div className="text-sm text-slate-300">No bonds issued yet.</div>
                      ) : (
                        filteredBonds.map((b) => {
                          const ppmTitle = ppmDocs.find((d) => d.id === b.ppmDocumentId)?.title;
                          return (
                            <div key={b.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-lg font-semibold">{b.bondNumber}</div>
                                    <Badge variant={b.status === "Active" ? "default" : "secondary"}>{b.status}</Badge>
                                    <Badge variant="outline">{money(b.principalAmountUSD)}</Badge>
                                  </div>
                                  <div className="mt-1 text-sm text-slate-300">Holder: {b.holderName}</div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {b.interestRatePct}% {b.interestType} • {b.paymentFrequency} • Matures {b.maturityDate}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={async () => {
                                      if (!trustId) return;
                                      try {
                                        setBondPdfNotice(null);
                                        const resp = await fetch(
                                          `/api/trusts/${encodeURIComponent(trustId)}/bonds/${encodeURIComponent(b.id)}/generate-pdf`,
                                          { method: "POST" }
                                        );
                                        const data = await resp.json().catch(() => ({}));
                                        if (!resp.ok) throw new Error(data?.error?.message || data?.error || "PDF generation failed");
                                        setBondPdfNotice(`PDF generated. Exhibit ${data.exhibitId} • Hash ${data.fileHash}`);
                                      } catch (err) {
                                        setBondPdfNotice(`PDF generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                                      }
                                    }}
                                    className="gap-2"
                                  >
                                    <FileText className="h-4 w-4" />
                                    Generate PDF
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => updateBondStatus(b.id, "Redeemed")}
                                    className="gap-2"
                                    disabled={b.status !== "Active"}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark Redeemed
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => updateBondStatus(b.id, "Voided")}
                                    className="gap-2"
                                    disabled={b.status !== "Active"}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Void
                                  </Button>
                                </div>
                              </div>

                              <Separator className="my-3" />

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div>
                                  <div className="text-xs text-slate-400">PPM reference</div>
                                  <div className="mt-1 text-sm text-slate-200">
                                    {ppmTitle ? `${ppmTitle} (${b.ppmDocumentId})` : b.ppmDocumentId}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-slate-400">Document hash</div>
                                  <div className="mt-1 break-all font-mono text-xs text-slate-200">{b.documentHash}</div>
                                </div>
                              </div>

                              {b.collateralDescription ? (
                                <div className="mt-3 text-sm text-slate-200">
                                  <span className="text-slate-400">Collateral:</span> {b.collateralDescription}
                                </div>
                              ) : null}
                              {b.notes ? (
                                <div className="mt-2 text-sm text-slate-200">
                                  <span className="text-slate-400">Notes:</span> {b.notes}
                                </div>
                              ) : null}
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
                      <FileText className="h-5 w-5" />
                      Bond Issuance Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-300">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      Bond certificates are issued only with a PPM reference. Use the Issue tab to create new bonds.
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                      Bonds tracked: <span className="text-slate-200">{store.bonds.length}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Governance (Minutes) */}
            <TabsContent value="governance" className="mt-6">
              <div className="space-y-4">
                <MinutesList trustId={trustId} entityId={null} clientId={null} />
                <ScenePlansSection trustId={trustId} />
              </div>
            </TabsContent>

            {/* Legacy Governance Form (kept for backward compatibility) */}
            <TabsContent value="governance-legacy" className="mt-6 hidden">
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
                      Workspace Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Workspace ({store.config.entityType})</Label>
                  <Select
                    value={trustId ?? "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        clearBinding();
                        return;
                      }
                      setBinding((b) => ({
                        ...b,
                        trustId: value,
                        bindingValid: "unknown",
                        lastUpdatedAt: new Date().toISOString(),
                      }));
                      showSessionStrip();
                      router.replace(`/trust-records?trustId=${value}`);
                    }}
                  >
                    <SelectTrigger className="relative z-20">
                      <SelectValue placeholder={trustOptionsStatus === "loading" ? `Loading ${store.config.entityType.toLowerCase()}s...` : `Select ${store.config.entityType.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent className="z-[1200] max-h-72">
                      <SelectItem value="none">{getSelectWorkspacePlaceholder(store.config.entityType)}</SelectItem>
                      {trustId && !trustOptions.some((trust) => trust.id === trustId) ? (
                        <SelectItem value={trustId}>
                          {`Current Workspace • ${trustId}`}
                        </SelectItem>
                      ) : null}
                      {trustOptions.map((trust) => {
                        const label = [
                          trust.name || "Untitled Trust",
                          trust.jurisdictionState ? trust.jurisdictionState.toUpperCase() : null,
                          trust.trustType || null,
                          trust.id ? trust.id.slice(0, 8) : null,
                        ]
                          .filter(Boolean)
                          .join(" • ");
                        return (
                          <SelectItem key={trust.id} value={trust.id}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-slate-400">
                    {workspaceSummaryStatus === "loading"
                      ? "Loading workspace data..."
                      : workspaceSummary
                      ? "Workspace data loaded. Auto-filled empty fields."
                      : "Select a trust to load workspace data."}
                  </div>
                  {workspaceSummary ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => applyWorkspaceAutofill(workspaceSummary)}
                      className="gap-2"
                    >
                      <Stamp className="h-4 w-4" />
                      Apply Workspace Data
                    </Button>
                  ) : null}
                </div>

                    <div className="space-y-2">
                      <Label>Entity Type</Label>
                      <select
                        value={store.config.entityType}
                        onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityType: e.target.value as EntityType } }))}
                        className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        aria-label="Entity Type"
                      >
                        {(["Trust","LLC","Corporation","Partnership","Foundation","Nonprofit","Estate","Sole Proprietorship","Grantor","Other"] as EntityType[]).map((t) => (
                          <option key={t} value={t} className="bg-slate-950 text-slate-100">
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Entity Name</Label>
                      <Input value={store.config.entityName} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityName: e.target.value } }))} />
                    </div>

                <div className="space-y-2">
                  <Label>Firm Details (from Smart Trust)</Label>
                  <Input
                    value={store.config.firmName || ""}
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, firmName: e.target.value } }))}
                    placeholder="Firm name"
                  />
                  <Textarea
                    value={store.config.firmAddress || ""}
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, firmAddress: e.target.value } }))}
                    placeholder="Firm address"
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={store.config.firmPhone || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, firmPhone: e.target.value } }))}
                      placeholder="Firm phone"
                    />
                    <Input
                      value={store.config.firmEmail || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, firmEmail: e.target.value } }))}
                      placeholder="Firm email"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    {workspaceSummaryStatus === "loading"
                      ? "Loading firm details..."
                      : workspaceSummary?.firm?.name || workspaceSummary?.firm?.email || workspaceSummary?.firm?.phone
                      ? "Firm details loaded. Empty fields were auto-filled."
                      : "Select a trust to load firm details."}
                  </div>
                  {workspaceSummary?.firm ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => applyWorkspaceAutofill(workspaceSummary)}
                      className="gap-2"
                    >
                      <Stamp className="h-4 w-4" />
                      Apply Firm Details
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Entity Address (from Client Record)</Label>
                  <Input
                    value={store.config.entityAddressLine1 || ""}
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityAddressLine1: e.target.value } }))}
                    placeholder="Address line 1"
                  />
                  <Input
                    value={store.config.entityAddressLine2 || ""}
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityAddressLine2: e.target.value } }))}
                    placeholder="Address line 2"
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={store.config.entityCity || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityCity: e.target.value } }))}
                      placeholder="City"
                    />
                    <Input
                      value={store.config.entityState || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityState: e.target.value } }))}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={store.config.entityPostalCode || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityPostalCode: e.target.value } }))}
                      placeholder="Postal code"
                    />
                    <Input
                      value={store.config.entityCountry || ""}
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, entityCountry: e.target.value.toUpperCase() } }))}
                      placeholder="Country"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    {clientSummaryStatus === "loading"
                      ? "Loading client address..."
                      : clientSummary
                      ? "Client address loaded. Empty fields were auto-filled."
                      : "Select a trust to load the client address."}
                  </div>
                  {clientSummary ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => applyClientAutofill(clientSummary)}
                      className="gap-2"
                    >
                      <Stamp className="h-4 w-4" />
                      Apply Client Address
                    </Button>
                  ) : null}
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
                      <Label>Bond Prefix</Label>
                      <Input value={store.config.bondPrefix} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, bondPrefix: e.target.value } }))} />
                      <div className="text-xs text-slate-400">Bond format: PREFIX-000001</div>
                    </div>

                    <div className="space-y-2">
                      <Label>Bond Prefix</Label>
                      <Input value={store.config.bondPrefix} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, bondPrefix: e.target.value } }))} />
                      <div className="text-xs text-slate-400">Bond format: PREFIX-000001</div>
                    </div>

                    <div className="space-y-2">
                      <Label>Trustees Display Name</Label>
                      <Input value={store.config.trusteesDisplayName} onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, trusteesDisplayName: e.target.value } }))} />
                    </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select grantor / client authority title</Label>
                    <Select
                      value={store.config.clientAuthorityTitle || "_none"}
                      onValueChange={(v) => setStore((s) => ({ ...s, config: { ...s.config, clientAuthorityTitle: v === "_none" ? "" : v } }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Who has authority to provide structuring information?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— None —</SelectItem>
                        {CLIENT_AUTHORITY_TITLES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">
                        The title of the person you're working with. Jarva uses this to tailor prompts and suggest questions.
                      </span>
                      {(workspaceSummary as { client?: { title?: string | null } })?.client?.title && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setStore((s) => ({
                            ...s,
                            config: { ...s.config, clientAuthorityTitle: (workspaceSummary as { client?: { title?: string | null } }).client!.title || "" },
                          }))}
                          className="gap-1.5 text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/30"
                        >
                          Use client&apos;s title
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Workspace party role</Label>
                    <Select
                      value={workspacePartyRole}
                      onValueChange={(v) => setWorkspacePartyRole(v as WorkspacePartyRole)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grantor">Grantor</SelectItem>
                        <SelectItem value="trustee">Trustee</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="trust_protector">Trust Protector</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{workspacePartyRole === "grantor" ? "Grantor" : workspacePartyRole === "trustee" ? "Trustee" : workspacePartyRole === "consultant" ? "Consultant" : workspacePartyRole === "trust_protector" ? "Trust Protector" : "Manager"} Name</Label>
                    <Input
                      value={
                        workspacePartyRole === "grantor" ? (store.config.grantorName || "") :
                        workspacePartyRole === "trustee" ? (store.config.trusteeName || "") :
                        workspacePartyRole === "consultant" ? (store.config.consultantName || "") :
                        workspacePartyRole === "trust_protector" ? (store.config.trustProtectorName || "") :
                        (store.config.managerName || "")
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setStore((s) => ({
                          ...s,
                          config: {
                            ...s.config,
                            ...(workspacePartyRole === "grantor" ? { grantorName: v } : {}),
                            ...(workspacePartyRole === "trustee" ? { trusteeName: v } : {}),
                            ...(workspacePartyRole === "consultant" ? { consultantName: v } : {}),
                            ...(workspacePartyRole === "trust_protector" ? { trustProtectorName: v } : {}),
                            ...(workspacePartyRole === "manager" ? { managerName: v } : {}),
                          },
                        }));
                      }}
                      placeholder={
                        workspacePartyRole === "grantor" ? "Grantor/Settlor" :
                        workspacePartyRole === "trustee" ? "Trustee" :
                        workspacePartyRole === "consultant" ? "Consultant" :
                        workspacePartyRole === "trust_protector" ? "Trust Protector" : "Manager"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {workspaceSummaryStatus === "loading"
                        ? "Loading party names..."
                        : (workspacePartyRole === "grantor" || workspacePartyRole === "trustee") && (workspaceSummary?.parties?.grantorName || workspaceSummary?.parties?.trusteeName)
                        ? "Grantor/trustee names loaded. Empty fields were auto-filled."
                        : workspacePartyRole === "grantor" || workspacePartyRole === "trustee"
                        ? "Select a trust to load grantor/trustee names."
                        : "Enter details for " + (workspacePartyRole === "consultant" ? "Consultant" : workspacePartyRole === "trust_protector" ? "Trust Protector" : "Manager") + "."}
                    </span>
                    {(effectiveClientId ?? workspaceSummary?.trust?.clientId) && trustId && workspacePartyRole === "grantor" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={fillGrantorFromClient}
                        disabled={fillFromClientBusy}
                        className="gap-1.5 text-cyan-400 border-cyan-500/40 hover:bg-cyan-950/30"
                      >
                        {fillFromClientBusy ? "Filling…" : "Fill from client (Jarva)"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{workspacePartyRole === "grantor" ? "Grantor" : workspacePartyRole === "trustee" ? "Trustee" : workspacePartyRole === "consultant" ? "Consultant" : workspacePartyRole === "trust_protector" ? "Trust Protector" : "Manager"} Address</Label>
                  <Input
                    value={
                      workspacePartyRole === "grantor" ? (store.config.grantorAddressLine1 || "") :
                      workspacePartyRole === "trustee" ? (store.config.trusteeAddressLine1 || "") :
                      workspacePartyRole === "consultant" ? (store.config.consultantAddressLine1 || "") :
                      workspacePartyRole === "trust_protector" ? (store.config.trustProtectorAddressLine1 || "") :
                      (store.config.managerAddressLine1 || "")
                    }
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorAddressLine1: e.target.value } : {}), ...(workspacePartyRole === "trustee" ? { trusteeAddressLine1: e.target.value } : {}), ...(workspacePartyRole === "consultant" ? { consultantAddressLine1: e.target.value } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorAddressLine1: e.target.value } : {}), ...(workspacePartyRole === "manager" ? { managerAddressLine1: e.target.value } : {}) } }))}
                    placeholder="Address line 1"
                  />
                  <Input
                    value={
                      workspacePartyRole === "grantor" ? (store.config.grantorAddressLine2 || "") :
                      workspacePartyRole === "trustee" ? (store.config.trusteeAddressLine2 || "") :
                      workspacePartyRole === "consultant" ? (store.config.consultantAddressLine2 || "") :
                      workspacePartyRole === "trust_protector" ? (store.config.trustProtectorAddressLine2 || "") :
                      (store.config.managerAddressLine2 || "")
                    }
                    onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorAddressLine2: e.target.value } : {}), ...(workspacePartyRole === "trustee" ? { trusteeAddressLine2: e.target.value } : {}), ...(workspacePartyRole === "consultant" ? { consultantAddressLine2: e.target.value } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorAddressLine2: e.target.value } : {}), ...(workspacePartyRole === "manager" ? { managerAddressLine2: e.target.value } : {}) } }))}
                    placeholder="Address line 2"
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={
                        workspacePartyRole === "grantor" ? (store.config.grantorCity || "") :
                        workspacePartyRole === "trustee" ? (store.config.trusteeCity || "") :
                        workspacePartyRole === "consultant" ? (store.config.consultantCity || "") :
                        workspacePartyRole === "trust_protector" ? (store.config.trustProtectorCity || "") :
                        (store.config.managerCity || "")
                      }
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorCity: e.target.value } : {}), ...(workspacePartyRole === "trustee" ? { trusteeCity: e.target.value } : {}), ...(workspacePartyRole === "consultant" ? { consultantCity: e.target.value } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorCity: e.target.value } : {}), ...(workspacePartyRole === "manager" ? { managerCity: e.target.value } : {}) } }))}
                      placeholder="City"
                    />
                    <Input
                      value={
                        workspacePartyRole === "grantor" ? (store.config.grantorState || "") :
                        workspacePartyRole === "trustee" ? (store.config.trusteeState || "") :
                        workspacePartyRole === "consultant" ? (store.config.consultantState || "") :
                        workspacePartyRole === "trust_protector" ? (store.config.trustProtectorState || "") :
                        (store.config.managerState || "")
                      }
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorState: e.target.value } : {}), ...(workspacePartyRole === "trustee" ? { trusteeState: e.target.value } : {}), ...(workspacePartyRole === "consultant" ? { consultantState: e.target.value } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorState: e.target.value } : {}), ...(workspacePartyRole === "manager" ? { managerState: e.target.value } : {}) } }))}
                      placeholder="State"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={
                        workspacePartyRole === "grantor" ? (store.config.grantorPostalCode || "") :
                        workspacePartyRole === "trustee" ? (store.config.trusteePostalCode || "") :
                        workspacePartyRole === "consultant" ? (store.config.consultantPostalCode || "") :
                        workspacePartyRole === "trust_protector" ? (store.config.trustProtectorPostalCode || "") :
                        (store.config.managerPostalCode || "")
                      }
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorPostalCode: e.target.value } : {}), ...(workspacePartyRole === "trustee" ? { trusteePostalCode: e.target.value } : {}), ...(workspacePartyRole === "consultant" ? { consultantPostalCode: e.target.value } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorPostalCode: e.target.value } : {}), ...(workspacePartyRole === "manager" ? { managerPostalCode: e.target.value } : {}) } }))}
                      placeholder="Postal code"
                    />
                    <Input
                      value={
                        workspacePartyRole === "grantor" ? (store.config.grantorCountry || "") :
                        workspacePartyRole === "trustee" ? (store.config.trusteeCountry || "") :
                        workspacePartyRole === "consultant" ? (store.config.consultantCountry || "") :
                        workspacePartyRole === "trust_protector" ? (store.config.trustProtectorCountry || "") :
                        (store.config.managerCountry || "")
                      }
                      onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, ...(workspacePartyRole === "grantor" ? { grantorCountry: e.target.value.toUpperCase() } : {}), ...(workspacePartyRole === "trustee" ? { trusteeCountry: e.target.value.toUpperCase() } : {}), ...(workspacePartyRole === "consultant" ? { consultantCountry: e.target.value.toUpperCase() } : {}), ...(workspacePartyRole === "trust_protector" ? { trustProtectorCountry: e.target.value.toUpperCase() } : {}), ...(workspacePartyRole === "manager" ? { managerCountry: e.target.value.toUpperCase() } : {}) } }))}
                      placeholder="Country"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    {workspaceSummaryStatus === "loading"
                      ? "Loading address..."
                      : (workspacePartyRole === "grantor" && workspaceSummary?.parties?.grantorAddress) || (workspacePartyRole === "trustee" && workspaceSummary?.parties?.trusteeAddress)
                      ? "Address loaded. Empty fields were auto-filled."
                      : workspacePartyRole === "grantor" || workspacePartyRole === "trustee"
                      ? "Select a trust to load grantor/trustee address."
                      : "Enter address for " + (workspacePartyRole === "consultant" ? "Consultant" : workspacePartyRole === "trust_protector" ? "Trust Protector" : "Manager") + "."}
                  </div>
                  {((workspacePartyRole === "grantor" && workspaceSummary?.parties?.grantorAddress) || (workspacePartyRole === "trustee" && workspaceSummary?.parties?.trusteeAddress)) ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => applyWorkspaceAutofill(workspaceSummary)}
                      className="gap-2"
                    >
                      <Stamp className="h-4 w-4" />
                      Apply {workspacePartyRole === "grantor" ? "Grantor" : "Trustee"} Address
                    </Button>
                  ) : null}
                </div>

                    <Separator />

                    {/* Canonical Trust Taxonomy */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-blue-500" />
                        <Label className="text-sm font-semibold text-slate-700">Trust Taxonomy (Canonical)</Label>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Trust Category</Label>
                          <select
                            value={store.config.trustCategory || ""}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: {
                                  ...s.config,
                                  trustCategory: e.target.value as "private" | "charitable" | "statutory",
                                },
                              }))
                            }
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            aria-label="Trust Category"
                          >
                            <option value="" className="bg-slate-950 text-slate-100">
                              Select trust category
                            </option>
                            <option value="private" className="bg-slate-950 text-slate-100">
                              Private Trust
                            </option>
                            <option value="charitable" className="bg-slate-950 text-slate-100">
                              Charitable Trust
                            </option>
                            <option value="statutory" className="bg-slate-950 text-slate-100">
                              Statutory Trust
                            </option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>Formation Mode</Label>
                          <select
                            value={store.config.formationMode || ""}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: {
                                  ...s.config,
                                  formationMode: e.target.value as "express" | "resulting" | "constructive",
                                },
                              }))
                            }
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            aria-label="Formation Mode"
                          >
                            <option value="" className="bg-slate-950 text-slate-100">
                              Select formation mode
                            </option>
                            <option value="express" className="bg-slate-950 text-slate-100">
                              Express Trust
                            </option>
                            <option value="resulting" className="bg-slate-950 text-slate-100">
                              Resulting Trust
                            </option>
                            <option value="constructive" className="bg-slate-950 text-slate-100">
                              Constructive Trust
                            </option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>Governance Mode</Label>
                          <select
                            value={store.config.governanceMode || ""}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: { ...s.config, governanceMode: e.target.value as "simple" | "complex" },
                              }))
                            }
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            aria-label="Governance Mode"
                          >
                            <option value="" className="bg-slate-950 text-slate-100">
                              Select governance mode
                            </option>
                            <option value="simple" className="bg-slate-950 text-slate-100">
                              Simple Governance
                            </option>
                            <option value="complex" className="bg-slate-950 text-slate-100">
                              Complex Governance
                            </option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label>Trust Subtype (for S Corp eligibility)</Label>
                          <select
                            value={store.config.trustSubtype || ""}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                config: {
                                  ...s.config,
                                  trustSubtype: e.target.value as "standard" | "grantor" | "QSST" | "ESBT",
                                },
                              }))
                            }
                            className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            aria-label="Trust Subtype"
                          >
                            <option value="" className="bg-slate-950 text-slate-100">
                              Select trust subtype
                            </option>
                            <option value="standard" className="bg-slate-950 text-slate-100">
                              Standard Trust
                            </option>
                            <option value="grantor" className="bg-slate-950 text-slate-100">
                              Grantor Trust
                            </option>
                            <option value="QSST" className="bg-slate-950 text-slate-100">
                              Qualified Subchapter S Trust (QSST)
                            </option>
                            <option value="ESBT" className="bg-slate-950 text-slate-100">
                              Electing Small Business Trust (ESBT)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="commercialEnabled"
                            checked={store.config.commercialEnabled || false}
                            onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, commercialEnabled: e.target.checked } }))}
                            className="rounded border-slate-300"
                          />
                          <Label htmlFor="commercialEnabled" className="text-sm">
                            Enable Commercial Activity (Entity Ownership)
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="sCorpEligible"
                            checked={store.config.sCorpEligible || false}
                            onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, sCorpEligible: e.target.checked } }))}
                            className="rounded border-slate-300"
                          />
                          <Label htmlFor="sCorpEligible" className="text-sm">
                            S Corporation Eligible (IRS Compliance Required)
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="irsElectionConfirmed"
                            checked={store.config.irsElectionConfirmed || false}
                            onChange={(e) => setStore((s) => ({ ...s, config: { ...s.config, irsElectionConfirmed: e.target.checked } }))}
                            className="rounded border-slate-300"
                          />
                          <Label htmlFor="irsElectionConfirmed" className="text-sm">
                            IRS Election Confirmed
                          </Label>
                        </div>
                      </div>

                      {/* Entity Eligibility Status */}
                      <Alert className="border-blue-200 bg-blue-50">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-800">Entity Ownership Eligibility</AlertTitle>
                        <AlertDescription className="text-blue-700">
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div>
                                <strong>C Corporations:</strong>{" "}
                                {store.config.commercialEnabled && store.config.governanceMode === "complex" ? (
                                  <span className="text-green-600">✅ Eligible</span>
                                ) : (
                                  <span className="text-red-600">❌ Requires Commercial + Complex Governance</span>
                                )}
                              </div>
                              <div>
                                <strong>LLCs:</strong>{" "}
                                {store.config.commercialEnabled && store.config.governanceMode === "complex" ? (
                                  <span className="text-green-600">✅ Eligible</span>
                                ) : (
                                  <span className="text-red-600">❌ Requires Commercial + Complex Governance</span>
                                )}
                              </div>
                              <div>
                                <strong>S Corporations:</strong>{" "}
                                {store.config.sCorpEligible &&
                                (store.config.trustSubtype === "grantor" ||
                                  store.config.trustSubtype === "QSST" ||
                                  store.config.trustSubtype === "ESBT") &&
                                store.config.irsElectionConfirmed ? (
                                  <span className="text-green-600">✅ Eligible</span>
                                ) : (
                                  <span className="text-red-600">❌ Requires S Corp eligibility + IRS compliance</span>
                                )}
                              </div>
                              <div>
                                <strong>LPs/LLPs:</strong>{" "}
                                {store.config.commercialEnabled && store.config.governanceMode === "complex" ? (
                                  <span className="text-green-600">✅ Eligible</span>
                                ) : (
                                  <span className="text-red-600">❌ Requires Commercial + Complex Governance</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
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
                    <div ref={renderRef}>
                      <CertificatePreview config={store.config} certificate={renderingPreviewCertificate} assets={store.assets} />
                    </div>
                    {store.certificates.length === 0 ? (
                      <div className="mt-3 text-sm text-slate-300">
                        Live preview mode is using your current Issue form values. Issue a certificate to persist this as an official record.
                      </div>
                    ) : null}
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

            {/* Estate Instruments */}
            <TabsContent value="estate" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className={`${NEON_TILE}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ScrollText className="h-5 w-5" />
                      Estate Instruments (Post-Mortem)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Pour-Over Will / Last Will & Testament</div>
                        <div className="text-sm text-slate-400">
                          Probate-based fallback instrument to support your Trust plan.
                        </div>
                      </div>
                      <Button asChild variant="secondary" className="gap-2">
                        <Link href="/trust-records/estate/will">
                          <FileText className="h-4 w-4" />
                          Start
                        </Link>
                      </Button>
                    </div>

                    <div className="flex items-center justify-between opacity-90">
                      <div>
                        <div className="font-medium">Testamentary Trust</div>
                        <div className="text-sm text-slate-400">
                          Advanced: trust created under a Will (probate-triggered).
                        </div>
                      </div>
                      <Button asChild variant="outline" className="gap-2">
                        <Link href="/trust-records/estate/testamentary-trust">
                          <FileText className="h-4 w-4" />
                          Start
                        </Link>
                      </Button>
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


