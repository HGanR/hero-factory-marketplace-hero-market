/**
 * Stable id for idempotent DB campaign upserts when `getBentleyActiveRunId()` is unset
 * (e.g. campaign step run outside full pipeline lock).
 */

import { getBentleyActiveRunId } from "@/lib/revenue-os/bentley-run-observability";

export const BENTLEY_CAMPAIGN_PERSIST_RUN_SESSION_KEY = "revenue-os:bentley-campaign-persist-run-id";

const SESSION_FALLBACK_KEY = BENTLEY_CAMPAIGN_PERSIST_RUN_SESSION_KEY;

export function getBentleyCampaignPersistenceRunId(): string {
  const active = getBentleyActiveRunId();
  if (active) return active;
  if (typeof window === "undefined") {
    return `bentley-ssr-${Date.now().toString(36)}`;
  }
  try {
    let id = sessionStorage.getItem(SESSION_FALLBACK_KEY);
    if (!id) {
      id = `bentley-session-${crypto.randomUUID()}`;
      sessionStorage.setItem(SESSION_FALLBACK_KEY, id);
    }
    return id;
  } catch {
    return `bentley-fallback-${Date.now().toString(36)}`;
  }
}
