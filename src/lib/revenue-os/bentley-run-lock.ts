/**
 * Single-tab pipeline run lock — prevents concurrent `runFullPipeline` (chat + ambient + URL resume).
 * Stored in sessionStorage (per tab); released in `finally` after the runner finishes.
 */

import { bentleyScopedSessionKey, removeAllSessionKeysForLogicalBase } from "@/lib/revenue-os/bentley-storage-scope";

export const BENTLEY_RUN_LOCK_STORAGE_KEY = "revenue-os:bentley-run-lock";

function runLockKey(): string {
  return bentleyScopedSessionKey(BENTLEY_RUN_LOCK_STORAGE_KEY);
}

/** Same-tab listeners refresh disabled buttons when lock changes. */
export const BENTLEY_RUN_LOCK_EVENT = "bentley:run-lock-changed";

const DEFAULT_TTL_MS = 5 * 60_000;

function emitRunLockChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BENTLEY_RUN_LOCK_EVENT));
}

export function isRunLockHeld(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cur = sessionStorage.getItem(runLockKey()) ?? sessionStorage.getItem(BENTLEY_RUN_LOCK_STORAGE_KEY);
    if (!cur) return false;
    const { expiresAt } = JSON.parse(cur) as { expiresAt?: number };
    return expiresAt != null && expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function tryAcquireRunLock(ttlMs = DEFAULT_TTL_MS): boolean {
  if (typeof window === "undefined") return true;
  try {
    const key = runLockKey();
    const now = Date.now();
    let cur = sessionStorage.getItem(key);
    if (!cur) cur = sessionStorage.getItem(BENTLEY_RUN_LOCK_STORAGE_KEY);
    if (cur) {
      try {
        const { expiresAt } = JSON.parse(cur) as { expiresAt?: number };
        if (expiresAt && expiresAt > now) return false;
      } catch {
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(BENTLEY_RUN_LOCK_STORAGE_KEY);
      }
    }
    sessionStorage.setItem(key, JSON.stringify({ expiresAt: now + ttlMs }));
    emitRunLockChanged();
    return true;
  } catch {
    return false;
  }
}

export function releaseRunLock(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(runLockKey());
    sessionStorage.removeItem(BENTLEY_RUN_LOCK_STORAGE_KEY);
    emitRunLockChanged();
  } catch {
    // ignore
  }
}

/** Clears lock rows for every scope variant (e.g. chat “start over”). */
export function clearAllBentleyRunLockSessionRows(): void {
  if (typeof window === "undefined") return;
  try {
    removeAllSessionKeysForLogicalBase(BENTLEY_RUN_LOCK_STORAGE_KEY);
    emitRunLockChanged();
  } catch {
    // ignore
  }
}
