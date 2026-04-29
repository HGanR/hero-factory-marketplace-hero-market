/**
 * Resolve optional Bentley handoff for server-side generation routes.
 *
 * Precedence (deterministic, audit-friendly):
 * 1. If `useBentleyIntelligence === false` → no handoff (operator opted out).
 * 2. If `bentleyHandoffId` is provided and `userId` is present → load from DB; on success, use that row
 *    (authoritative persisted snapshot; wins over inline payload when both sent).
 * 3. Else if request body contains valid `bentleySliContentHandoff` (e.g. workflow artifact) → use it.
 * 4. Else → none.
 *
 * Rationale: explicit id targets a stored record the user may refresh from; inline payload supports
 * fresh session-only handoffs before persistence or when id is absent.
 */

import { loadBentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/loadBentleyContentBundleHandoff";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import { isBentleyContentBundleHandoffPayload } from "@/lib/bentley-social-leads/handoff/validateContentBundleHandoffPayload";
import type { BentleyHandoffResolveSource } from "./bentley-generation-context";

export type ResolveBentleyHandoffResult = {
  handoff: BentleyContentBundleHandoff | null;
  resolvedFrom: BentleyHandoffResolveSource;
};

export async function resolveBentleyHandoffForGeneration(body: Record<string, unknown>, userId: number | null): Promise<ResolveBentleyHandoffResult> {
  if (body?.useBentleyIntelligence === false) {
    return { handoff: null, resolvedFrom: "none" };
  }

  const id = typeof body?.bentleyHandoffId === "string" ? body.bentleyHandoffId.trim() : "";
  if (id && userId != null) {
    const row = await loadBentleyContentBundleHandoff({ userId, handoffId: id });
    if (row) return { handoff: row, resolvedFrom: "handoff_id_db" };
  }

  const raw = body?.bentleySliContentHandoff;
  if (isBentleyContentBundleHandoffPayload(raw)) {
    return { handoff: raw, resolvedFrom: "request_payload" };
  }

  return { handoff: null, resolvedFrom: "none" };
}
