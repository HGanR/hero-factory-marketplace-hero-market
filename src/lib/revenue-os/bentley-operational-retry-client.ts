"use client";

/**
 * Client-only retry guards for operational flows (launch sync, readiness refresh).
 * Caps attempts per campaign + kind — never infinite.
 */

import { bentleyScopedSessionKey } from "@/lib/revenue-os/bentley-storage-scope";
import { BENTLEY_OPERATIONAL_MAX_RETRIES } from "@/lib/revenue-os/bentley-operational-blocker-resolution";
import { syncBentleyLaunchApi } from "@/lib/revenue-os/revenue-os-pipeline-actions";

export type BentleyOperationalRetryKind =
  | "launch_sync"
  | "launch_sync_content360_platform"
  | "readiness_refresh";

function storageBase(kind: BentleyOperationalRetryKind, campaignId: string): string {
  return `bentley:op-retry:${kind}:${campaignId}`;
}

export function getBentleyOperationalRetryCount(kind: BentleyOperationalRetryKind, campaignId: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  const raw = sessionStorage.getItem(bentleyScopedSessionKey(storageBase(kind, campaignId)));
  const n = parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Returns false when max retries reached for this campaign + kind. */
export function recordBentleyOperationalRetryAttempt(
  kind: BentleyOperationalRetryKind,
  campaignId: string
): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const key = bentleyScopedSessionKey(storageBase(kind, campaignId));
  const next = getBentleyOperationalRetryCount(kind, campaignId) + 1;
  if (next > BENTLEY_OPERATIONAL_MAX_RETRIES) return false;
  try {
    sessionStorage.setItem(key, String(next));
  } catch {
    return false;
  }
  return true;
}

export function clearBentleyOperationalRetryCount(kind: BentleyOperationalRetryKind, campaignId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(bentleyScopedSessionKey(storageBase(kind, campaignId)));
  } catch {
    // ignore
  }
}

export type BentleyOperationalRetryResult =
  | { ok: true; message?: string }
  | { ok: false; reason: "max_retries" | "error"; message: string };

/**
 * Idempotent server call: re-runs launch sync for the campaign (does not bypass approval gates).
 */
export async function retryBentleyLaunchSyncClient(campaignId: string): Promise<BentleyOperationalRetryResult> {
  if (!recordBentleyOperationalRetryAttempt("launch_sync", campaignId)) {
    return {
      ok: false,
      reason: "max_retries",
      message: `Maximum ${BENTLEY_OPERATIONAL_MAX_RETRIES} launch sync retries — fix OAuth, approvals, or account binding, then try again later.`,
    };
  }
  try {
    await syncBentleyLaunchApi({
      campaignId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
    });
    clearBentleyOperationalRetryCount("launch_sync", campaignId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bentley-workflow-updated"));
      window.dispatchEvent(new CustomEvent("bentley-operational-readiness-refresh"));
    }
    return { ok: true, message: "Launch sync completed." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Launch sync failed.";
    return { ok: false, reason: "error", message: msg };
  }
}

/**
 * Admin-only: same idempotency contract as launch sync, but applies trusted Content360 platform-key scheduling meta.
 * Requires platform admin session + configured platform env (enforced on POST /api/revenue-os/bentley/sync-launch).
 */
export async function retryBentleyLaunchSyncContent360PlatformClient(
  campaignId: string
): Promise<BentleyOperationalRetryResult> {
  if (!recordBentleyOperationalRetryAttempt("launch_sync_content360_platform", campaignId)) {
    return {
      ok: false,
      reason: "max_retries",
      message: `Maximum ${BENTLEY_OPERATIONAL_MAX_RETRIES} Content360 platform launch sync retries — fix OAuth, approvals, or account binding, then try again later.`,
    };
  }
  try {
    await syncBentleyLaunchApi({
      campaignId,
      scheduleStrategy: "staggered",
      staggerMinutes: 30,
      publishRoute: "content360",
      content360PlatformSchedule: true,
    });
    clearBentleyOperationalRetryCount("launch_sync_content360_platform", campaignId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bentley-workflow-updated"));
      window.dispatchEvent(new CustomEvent("bentley-operational-readiness-refresh"));
    }
    return { ok: true, message: "Launch sync completed with Content360 platform scheduling." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Launch sync failed.";
    return { ok: false, reason: "error", message: msg };
  }
}

/**
 * Re-fetches operational readiness (no publish). Dispatches `bentley-operational-readiness-refresh` for hooks to refetch.
 */
export function retryBentleyOperationalReadinessClient(campaignId: string): BentleyOperationalRetryResult {
  if (!recordBentleyOperationalRetryAttempt("readiness_refresh", campaignId)) {
    return {
      ok: false,
      reason: "max_retries",
      message: `Maximum ${BENTLEY_OPERATIONAL_MAX_RETRIES} readiness refreshes — wait for ingestion or check deployment feedback sources.`,
    };
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bentley-operational-readiness-refresh"));
  }
  return { ok: true, message: "Refreshing operational status…" };
}
