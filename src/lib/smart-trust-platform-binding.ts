/**
 * Shared localStorage binding for trust workspace / client context across dashboard, Smart Trust, Trust Records, etc.
 */

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { setSelectedClientId } from "@/lib/client-context/selected-client";

export const SMART_TRUST_PLATFORM_BINDING_KEY = "smart_trust_platform_binding_v1";

export const SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT = "smart_trust_platform_binding_updated";

/** Synthetic workspace id for CRM `clients` rows that do not yet have a trust — kept in `trustId` in localStorage. */
export const CRM_ONLY_WORKSPACE_PREFIX = "crm-ws:";

export function isCrmOnlyWorkspaceId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(CRM_ONLY_WORKSPACE_PREFIX);
}

export function crmClientIdFromWorkspaceId(id: string | null | undefined): string | null {
  if (id == null || !isCrmOnlyWorkspaceId(id)) return null;
  const rest = id.slice(CRM_ONLY_WORKSPACE_PREFIX.length).trim();
  return rest || null;
}

export type SmartTrustPlatformBinding = {
  clientId: string | null;
  trustId: string | null;
  lastUpdatedAt?: string | null;
  bindingValid?: "unknown" | "valid" | "invalid";
  /** Ecclesiastical / UI: last explicit sync timestamp (optional, preserved across saves) */
  lastSyncedAt?: string | null;
};

export function loadSmartTrustPlatformBinding(): SmartTrustPlatformBinding {
  if (typeof window === "undefined") return { clientId: null, trustId: null };
  try {
    const raw = window.localStorage.getItem(SMART_TRUST_PLATFORM_BINDING_KEY);
    if (!raw) return { clientId: null, trustId: null };
    const parsed = JSON.parse(raw) as Partial<SmartTrustPlatformBinding>;
    const clientId = coerceTrimmedString(parsed.clientId) || null;
    const trustId = coerceTrimmedString(parsed.trustId) || null;
    return {
      clientId,
      trustId,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : undefined,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : undefined,
      bindingValid:
        parsed.bindingValid === "valid" || parsed.bindingValid === "invalid" ? parsed.bindingValid : "unknown",
    };
  } catch {
    return { clientId: null, trustId: null };
  }
}

export function saveSmartTrustPlatformBinding(binding: SmartTrustPlatformBinding): void {
  if (typeof window === "undefined") return;
  const payload: SmartTrustPlatformBinding = {
    ...binding,
    lastUpdatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(SMART_TRUST_PLATFORM_BINDING_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT));
  setSelectedClientId(payload.clientId ?? null);
}

export function workspaceLabelFromList(
  workspaces: { id: string; name?: string | null }[],
  trustId: string | null
): string | null {
  if (!trustId) return null;
  const w = workspaces.find((x) => x.id === trustId);
  return w?.name ?? `${trustId.slice(0, 8)}…`;
}
