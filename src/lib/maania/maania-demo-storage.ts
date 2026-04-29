import type { BuyerDemoPayload } from "@/lib/maania/build-buyer-demo-payload";
import type { RetDemoPagePayload } from "@/lib/maania/build-ret-demo-payload";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export const MAANIA_BUYER_DEMO_STORAGE_KEY = "maania_buyer_demo_payload_v1";

/** Site Builder-compatible document generated from `buyerDemoPayloadToSiteSchemaDocument`. */
export const MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY = "maania_buyer_site_schema_v1";

/** Doc-spec key: buyer schema snapshot for builder handoff (mirrors buyer site schema JSON). */
export const MAANIA_BUYER_BUILDER_STORAGE_KEY = "maania:buyer:builder-schema";

export const MAANIA_RET_DEMO_STORAGE_KEY = "maania_ret_demo_payload_v1";

export const MAANIA_RET_SITE_SCHEMA_STORAGE_KEY = "maania_ret_site_schema_v1";

export const MAANIA_RET_BUILDER_STORAGE_KEY = "maania:ret:builder-schema";

/** Last schema written immediately before opening `/site-builder` import (single-flight). */
export const MAANIA_SITE_BUILDER_PENDING_IMPORT_KEY = "maania:site-builder:pending-import";

export function persistBuyerDemoPayloadToSession(payload: BuyerDemoPayload): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(MAANIA_BUYER_DEMO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function persistBuyerSiteSchemaToSession(schema: SiteSchemaDocumentType): void {
  if (typeof sessionStorage === "undefined") return;
  const raw = JSON.stringify(schema);
  try {
    sessionStorage.setItem(MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY, raw);
    sessionStorage.setItem(MAANIA_BUYER_BUILDER_STORAGE_KEY, raw);
  } catch {
    /* quota / private mode */
  }
}

export function persistRetDemoPayloadToSession(payload: RetDemoPagePayload): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(MAANIA_RET_DEMO_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function persistRetSiteSchemaToSession(schema: SiteSchemaDocumentType): void {
  if (typeof sessionStorage === "undefined") return;
  const raw = JSON.stringify(schema);
  try {
    sessionStorage.setItem(MAANIA_RET_SITE_SCHEMA_STORAGE_KEY, raw);
    sessionStorage.setItem(MAANIA_RET_BUILDER_STORAGE_KEY, raw);
  } catch {
    /* quota / private mode */
  }
}

/** Persists both the chat payload preview and the Site Builder document for the demo page. */
export function persistMaaniaBuyerDemoArtifacts(
  payload: BuyerDemoPayload,
  schema: SiteSchemaDocumentType
): void {
  persistBuyerDemoPayloadToSession(payload);
  persistBuyerSiteSchemaToSession(schema);
}

export function persistMaaniaRetDemoArtifacts(
  payload: RetDemoPagePayload,
  schema: SiteSchemaDocumentType
): void {
  persistRetDemoPayloadToSession(payload);
  persistRetSiteSchemaToSession(schema);
}

export function persistPendingBuilderImport(schema: SiteSchemaDocumentType): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(MAANIA_SITE_BUILDER_PENDING_IMPORT_KEY, JSON.stringify(schema));
  } catch {
    /* quota / private mode */
  }
}

const IMPORT_READ_ORDER = [
  MAANIA_SITE_BUILDER_PENDING_IMPORT_KEY,
  MAANIA_BUYER_BUILDER_STORAGE_KEY,
  MAANIA_RET_BUILDER_STORAGE_KEY,
  MAANIA_BUYER_SITE_SCHEMA_STORAGE_KEY,
  MAANIA_RET_SITE_SCHEMA_STORAGE_KEY,
] as const;

/** First non-empty JSON string found (browser only). Used by Site Builder import. */
export function readMaaniaImportSchemaForSiteBuilder(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  for (const k of IMPORT_READ_ORDER) {
    try {
      const raw = sessionStorage.getItem(k);
      if (raw?.trim()) return raw;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function clearMaaniaSiteBuilderPendingImport(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(MAANIA_SITE_BUILDER_PENDING_IMPORT_KEY);
  } catch {
    /* ignore */
  }
}
