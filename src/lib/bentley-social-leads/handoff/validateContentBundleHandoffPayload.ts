/**
 * Shared validation for Bentley SLI → Content Bundle handoff JSON (client + server).
 * Keep in sync with `src/app/api/bentley-social-leads/content-bundle-handoff/route.ts` POST guard.
 */

import type { BentleyContentBundleHandoff } from "./contentBundleHandoffTypes";

export function isBentleyContentBundleHandoffPayload(v: unknown): v is BentleyContentBundleHandoff {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.source === "bentley_sli" &&
    o.schemaVersion === 1 &&
    typeof o.createdAt === "string" &&
    typeof o.basedOnFilteredRowCount === "number" &&
    o.provenance != null &&
    typeof o.provenance === "object"
  );
}
