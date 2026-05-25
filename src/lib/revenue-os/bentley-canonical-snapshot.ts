/**
 * Single canonical JSON for Bentley `BentleySnapshot` (pipeline + intake + launch prefill).
 * sessionStorage first; localStorage mirror for tab-close / refresh resilience.
 *
 * Keys are **scoped by** `bentleyScopedSessionKey` → `userId` + `clientId` from `setBentleyStorageScope`
 * (see `BentleyAiRevenueOsScopeSync` + dashboard). Changing workspace/client switches the namespace so
 * each client’s intake and pipeline state stay separate without redoing guided questions.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { bentleyScopedSessionKey } from "@/lib/revenue-os/bentley-storage-scope";
import { sanitizeBentleySnapshotFromStorage } from "@/lib/revenue-os/bentley-string-coerce";

export const BENTLEY_CANONICAL_SNAPSHOT_KEY = "revenue-os:bentley-canonical-snapshot-v1";

const CANONICAL_VERSION = 1;

type Envelope = { v: typeof CANONICAL_VERSION; snapshot: BentleySnapshot; savedAt: string };

function parse(raw: string | null): BentleySnapshot | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Envelope;
    if (j.v !== CANONICAL_VERSION || !j.snapshot || typeof j.snapshot !== "object") return null;
    return sanitizeBentleySnapshotFromStorage(j.snapshot) as BentleySnapshot;
  } catch {
    return null;
  }
}

export function readCanonicalBentleySnapshot(): BentleySnapshot | null {
  if (typeof window === "undefined") return null;
  const scoped = bentleyScopedSessionKey(BENTLEY_CANONICAL_SNAPSHOT_KEY);
  let s = parse(sessionStorage.getItem(scoped));
  if (s) return s;
  s = parse(sessionStorage.getItem(BENTLEY_CANONICAL_SNAPSHOT_KEY));
  if (s) return s;
  try {
    s = parse(localStorage.getItem(scoped));
    if (s) return s;
    return parse(localStorage.getItem(BENTLEY_CANONICAL_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export function writeCanonicalBentleySnapshot(snapshot: BentleySnapshot): void {
  if (typeof window === "undefined") return;
  const env: Envelope = {
    v: CANONICAL_VERSION,
    snapshot: JSON.parse(JSON.stringify(snapshot)) as BentleySnapshot,
    savedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(env);
  const scoped = bentleyScopedSessionKey(BENTLEY_CANONICAL_SNAPSHOT_KEY);
  try {
    sessionStorage.setItem(scoped, raw);
    localStorage.setItem(scoped, raw);
  } catch {
    // quota
  }
  try {
    sessionStorage.setItem(BENTLEY_CANONICAL_SNAPSHOT_KEY, raw);
    localStorage.setItem(BENTLEY_CANONICAL_SNAPSHOT_KEY, raw);
  } catch {
    // legacy mirror
  }
}

function removeCanonicalRowsFrom(store: Storage): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key) continue;
      if (key === BENTLEY_CANONICAL_SNAPSHOT_KEY || key.startsWith(`${BENTLEY_CANONICAL_SNAPSHOT_KEY}::`)) {
        toRemove.push(key);
      }
    }
    for (const k of toRemove) store.removeItem(k);
  } catch {
    // ignore
  }
}

/** sessionStorage + localStorage — all scope prefixes for the canonical snapshot key. */
export function clearCanonicalBentleySnapshot(): void {
  if (typeof window === "undefined") return;
  removeCanonicalRowsFrom(sessionStorage);
  removeCanonicalRowsFrom(localStorage);
}
