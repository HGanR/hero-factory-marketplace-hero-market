/**
 * Shared "account assets" registry used across Trust Records + Smart Trust.
 *
 * Goal:
 * - If a user creates an asset in /trust-records, it should be selectable anywhere assets are used in /smart-trust.
 * - Assets are scoped to an account (wallet address if connected; otherwise a fallback user identifier).
 *
 * Current implementation:
 * - localStorage-backed (client-side). Swappable for API persistence later.
 */
import { v4 as uuidv4 } from "uuid";

export type AccountId = string;

export type AccountAsset = {
  id: string;
  /** High-level grouping (Smart Trust uses this as `category`) */
  category: string;
  /** Human-friendly description/label */
  description: string;
  /** Optional value as a string (Smart Trust UI uses string values) */
  approximateValue?: string;
  /** Freeform notes about titling/custody/transfer */
  titlingNotes?: string;

  /** Trust Records-style fields (optional) */
  identifier?: string;
  valuationUSD?: number;
  valuationAsOf?: string;
  encumbrances?: string;
  evidenceNotes?: string;

  createdAt: string;
  updatedAt: string;
  source?: "trust-records" | "smart-trust" | "unknown";
};

const ASSET_STORE_VERSION = "v1";
const ASSET_STORE_PREFIX = `hf_account_assets_${ASSET_STORE_VERSION}_`;
const ASSET_EVENT_PREFIX = `hf_account_assets_updated_${ASSET_STORE_VERSION}_`;
const LAST_ACCOUNT_KEY = `hf_last_account_${ASSET_STORE_VERSION}`;

export function resolveAccountId(opts: { walletAddress?: string | null; userKey?: string | null }): AccountId | null {
  const addr = (opts.walletAddress || "").trim().toLowerCase();
  if (addr) return addr;
  const user = (opts.userKey || "").trim();
  if (user) return `user:${user.toLowerCase()}`;
  return null;
}

export function getLastActiveAccountId(): AccountId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ACCOUNT_KEY);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

export function setLastActiveAccountId(accountId: AccountId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
  } catch {
    // ignore
  }
}

export function getAccountAssetsKey(accountId: AccountId) {
  return `${ASSET_STORE_PREFIX}${accountId}`;
}

export function loadAccountAssets(accountId: AccountId): AccountAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getAccountAssetsKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as AccountAsset[];
  } catch {
    return [];
  }
}

export function saveAccountAssets(accountId: AccountId, assets: AccountAsset[]) {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  const normalized = (assets || [])
    .filter(Boolean)
    .map((a) => ({
      id: a.id || uuidv4(),
      category: a.category || "Other",
      description: a.description || "",
      approximateValue: a.approximateValue || undefined,
      titlingNotes: a.titlingNotes || undefined,
      identifier: a.identifier || undefined,
      valuationUSD: typeof a.valuationUSD === "number" ? a.valuationUSD : undefined,
      valuationAsOf: a.valuationAsOf || undefined,
      encumbrances: a.encumbrances || undefined,
      evidenceNotes: a.evidenceNotes || undefined,
      createdAt: a.createdAt || now,
      updatedAt: a.updatedAt || now,
      source: a.source || "unknown",
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  try {
    window.localStorage.setItem(getAccountAssetsKey(accountId), JSON.stringify(normalized));
    window.dispatchEvent(new Event(`${ASSET_EVENT_PREFIX}${accountId}`));
  } catch {
    // ignore quota errors etc
  }
}

export function upsertAccountAsset(accountId: AccountId, asset: AccountAsset) {
  const existing = loadAccountAssets(accountId);
  const now = new Date().toISOString();
  const next = [
    { ...asset, updatedAt: now, createdAt: asset.createdAt || now, source: asset.source || "unknown" },
    ...existing.filter((a) => a.id !== asset.id),
  ];
  saveAccountAssets(accountId, next);
}

export function deleteAccountAsset(accountId: AccountId, assetId: string) {
  const existing = loadAccountAssets(accountId);
  saveAccountAssets(accountId, existing.filter((a) => a.id !== assetId));
}

export function subscribeAccountAssets(accountId: AccountId, cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === getAccountAssetsKey(accountId)) cb();
  };
  window.addEventListener(`${ASSET_EVENT_PREFIX}${accountId}`, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(`${ASSET_EVENT_PREFIX}${accountId}`, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

// -----------------------------
// Conversions
// -----------------------------

export function trustRecordsAssetToAccountAsset(a: {
  id: string;
  type: string;
  name: string;
  identifier?: string;
  valuationUSD?: number;
  valuationAsOf?: string;
  encumbrances?: string;
  evidenceNotes?: string;
  createdAt: string;
}): AccountAsset {
  const descriptionParts = [a.name, a.identifier ? `(${a.identifier})` : ""].filter(Boolean);
  return {
    id: a.id,
    category: String(a.type || "Other"),
    description: descriptionParts.join(" "),
    approximateValue: typeof a.valuationUSD === "number" ? String(a.valuationUSD) : undefined,
    titlingNotes: a.evidenceNotes || a.encumbrances || undefined,
    identifier: a.identifier,
    valuationUSD: a.valuationUSD,
    valuationAsOf: a.valuationAsOf,
    encumbrances: a.encumbrances,
    evidenceNotes: a.evidenceNotes,
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
    source: "trust-records",
  };
}

export function accountAssetToTrustRecordsAsset(a: AccountAsset): {
  id: string;
  type: string;
  name: string;
  identifier?: string;
  valuationUSD?: number;
  valuationAsOf?: string;
  encumbrances?: string;
  evidenceNotes?: string;
  createdAt: string;
} {
  return {
    id: a.id,
    type: (a.category || "Other") as any,
    name: a.description || "",
    identifier: a.identifier,
    valuationUSD: a.valuationUSD,
    valuationAsOf: a.valuationAsOf,
    encumbrances: a.encumbrances,
    evidenceNotes: a.evidenceNotes || a.titlingNotes,
    createdAt: a.createdAt,
  };
}

export function smartTrustAssetToAccountAsset(a: {
  id: string;
  category: string;
  description: string;
  approximateValue?: string;
  titlingNotes?: string;
}): AccountAsset {
  const now = new Date().toISOString();
  return {
    id: a.id,
    category: a.category || "Other",
    description: a.description || "",
    approximateValue: a.approximateValue || undefined,
    titlingNotes: a.titlingNotes || undefined,
    createdAt: now,
    updatedAt: now,
    source: "smart-trust",
  };
}

export function accountAssetToSmartTrustAsset(a: AccountAsset): {
  id: string;
  category:
    | "Real Estate"
    | "Bank/Brokerage"
    | "Business Interest"
    | "Digital Assets"
    | "Life Insurance"
    | "Art/Collectibles"
    | "Other";
  description: string;
  approximateValue?: string;
  titlingNotes?: string;
} {
  const cat = String(a.category || "Other");
  const mapped =
    cat === "Real Estate" ||
    cat === "Bank/Brokerage" ||
    cat === "Business Interest" ||
    cat === "Digital Assets" ||
    cat === "Life Insurance" ||
    cat === "Art/Collectibles"
      ? (cat as any)
      : "Other";
  return {
    id: a.id,
    category: mapped,
    description: a.description || "",
    approximateValue: a.approximateValue || (typeof a.valuationUSD === "number" ? String(a.valuationUSD) : undefined),
    titlingNotes: a.titlingNotes || a.evidenceNotes || a.encumbrances || undefined,
  };
}




