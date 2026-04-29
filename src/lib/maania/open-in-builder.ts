import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  persistBuyerSiteSchemaToSession,
  persistPendingBuilderImport,
  persistRetSiteSchemaToSession,
} from "@/lib/maania/maania-demo-storage";

/** Query flag for `/site-builder` — one-time import from sessionStorage on load. */
export const MAANIA_SITE_BUILDER_IMPORT_PARAM = "maaniaBuyerImport";

/** Alias flag (marketing / deep links) — same import behavior as `maaniaBuyerImport`. */
export const MAANIA_FROM_MAANIA_PARAM = "fromMaania";

function openSiteBuilderWithImport(schema: SiteSchemaDocumentType): void {
  if (typeof window === "undefined") return;
  persistPendingBuilderImport(schema);
  const url = `/site-builder?${MAANIA_SITE_BUILDER_IMPORT_PARAM}=1&${MAANIA_FROM_MAANIA_PARAM}=1`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Persists the generated Site Builder document and opens the editor in a new tab.
 * The builder reads pending import + buyer/ret schema keys when the import param is present.
 */
export function openBuyerDemoInBuilder(schema: SiteSchemaDocumentType): void {
  persistBuyerSiteSchemaToSession(schema);
  openSiteBuilderWithImport(schema);
}

export function openRetDemoInBuilder(schema: SiteSchemaDocumentType): void {
  persistRetSiteSchemaToSession(schema);
  openSiteBuilderWithImport(schema);
}
