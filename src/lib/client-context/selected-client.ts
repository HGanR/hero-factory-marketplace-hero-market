/**
 * Cross-page “active CRM client” id for dashboards (distinct from workflow `/api/clients/me` profile).
 * Mirrors {@link saveSmartTrustPlatformBinding} clientId whenever binding is saved.
 */

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export const SELECTED_CLIENT_STORAGE_KEY = "hf:selected-client-id";

export const SELECTED_CLIENT_CHANGED_EVENT = "hf-selected-client-changed";

export function getSelectedClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = coerceTrimmedString(window.localStorage.getItem(SELECTED_CLIENT_STORAGE_KEY));
    return v || null;
  } catch {
    return null;
  }
}

export function setSelectedClientId(clientId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const next = coerceTrimmedString(clientId);
    if (!next) {
      window.localStorage.removeItem(SELECTED_CLIENT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SELECTED_CLIENT_STORAGE_KEY, next);
    }
    window.dispatchEvent(
      new CustomEvent(SELECTED_CLIENT_CHANGED_EVENT, { detail: { clientId: next || null } }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function subscribeToSelectedClientChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(SELECTED_CLIENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SELECTED_CLIENT_CHANGED_EVENT, handler);
}
