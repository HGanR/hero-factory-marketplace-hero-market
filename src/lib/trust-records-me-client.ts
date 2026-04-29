import type { SmartTrustPlatformBinding } from "@/lib/smart-trust-platform-binding";

export type TrustRecordsMeActive = {
  trustId: string | null;
  clientId: string | null;
};

type TrustRecordsMeOk = {
  ok: true;
  active: {
    clientId: string | null;
    trustId: string | null;
  };
};

const DEFAULT_TTL_MS = 4000;

/** Same-tab signal after server active trust changes (POST /api/trust-records/active or equivalent). */
export const TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT = "trust_records_server_active_updated";

/**
 * Monotonic-ish token written to localStorage when server active trust changes (in the mutating tab only).
 * Other tabs receive `storage` and invalidate `/me` cache (same-tab CustomEvent still drives local listeners).
 */
export const TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY = "trust_records_server_active_cross_tab_v1";

let cached: { value: TrustRecordsMeActive; at: number } | null = null;
let inFlight: Promise<TrustRecordsMeActive | null> | null = null;
/** Bumps when cache must be ignored; in-flight completions only write cache if epoch matches. */
let invalidationEpoch = 0;
let inFlightEpoch = 0;

let crossTabListenerInstalled = false;

export type FetchTrustRecordsMeActiveOptions = {
  /** Bypass TTL and wait for any in-flight read, then perform a fresh GET (e.g. after mutating active trust). */
  force?: boolean;
  /** Override default TTL for cache reuse; omit to use library default. */
  ttlMs?: number;
};

export type InvalidateTrustRecordsMeActiveCacheOptions = {
  /** Dispatch {@link TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT} (default true in browser). */
  notify?: boolean;
  /** Optional payload on the {@link CustomEvent} for advanced listeners. */
  detail?: unknown;
  /**
   * When true (default), write {@link TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY} so other tabs invalidate.
   * Set false when handling a cross-tab `storage` event to avoid ping-pong writes.
   */
  syncCrossTab?: boolean;
};

type FetchOutcome =
  | { kind: "success"; snapshot: TrustRecordsMeActive }
  | { kind: "failure" };

function ensureTrustRecordsMeActiveCrossTabListener(): void {
  if (crossTabListenerInstalled || typeof window === "undefined") return;
  crossTabListenerInstalled = true;
  window.addEventListener("storage", handleTrustRecordsMeActiveCrossTabStorageEvent);
}

/** Invoked for `storage` events; exported for focused unit tests. */
export function handleTrustRecordsMeActiveCrossTabStorageEvent(e: StorageEvent): void {
  if (typeof window === "undefined") return;
  if (e.key !== TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY) return;
  if (e.storageArea !== window.localStorage) return;
  if (e.newValue === e.oldValue) return;
  invalidateTrustRecordsMeActiveCache({ notify: true, syncCrossTab: false });
}

function writeCrossTabActiveTrustSignal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY, String(Date.now()));
  } catch {
    // private mode / quota
  }
}

async function runTrustRecordsMeFetch(): Promise<FetchOutcome> {
  try {
    const res = await fetch("/api/trust-records/me", { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as TrustRecordsMeOk | { ok?: false };
    if (!res.ok || !data || (data as TrustRecordsMeOk).ok !== true) {
      return { kind: "failure" };
    }
    const active = (data as TrustRecordsMeOk).active;
    const snapshot: TrustRecordsMeActive = {
      trustId: active.trustId != null ? String(active.trustId) : null,
      clientId: active.clientId != null ? String(active.clientId) : null,
    };
    return { kind: "success", snapshot };
  } catch {
    return { kind: "failure" };
  }
}

/**
 * Clears TTL cache and detaches in-flight completions from caching stale data.
 * Call after successful POST /api/trust-records/active (or equivalent server active change).
 */
export function invalidateTrustRecordsMeActiveCache(options?: InvalidateTrustRecordsMeActiveCacheOptions): void {
  ensureTrustRecordsMeActiveCrossTabListener();

  invalidationEpoch++;
  cached = null;
  if (options?.notify !== false && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT, { detail: options?.detail })
    );
  }
  if (options?.syncCrossTab !== false) {
    writeCrossTabActiveTrustSignal();
  }
}

export function subscribeTrustRecordsServerActiveUpdated(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT, listener);
}

/** Alias for {@link subscribeTrustRecordsServerActiveUpdated} (same-tab active-trust invalidation). */
export const subscribeTrustRecordsMeActiveInvalidation = subscribeTrustRecordsServerActiveUpdated;

/**
 * GET /api/trust-records/me → active trust + client snapshot.
 * - Concurrent callers share one in-flight request when epoch matches.
 * - Successful parses are reused for a short TTL. Failures are never cached.
 * - `force: true` clears cache, waits for any in-flight request, then runs a fresh GET.
 */
export async function fetchTrustRecordsMeActive(
  options?: FetchTrustRecordsMeActiveOptions
): Promise<TrustRecordsMeActive | null> {
  ensureTrustRecordsMeActiveCrossTabListener();

  const force = options?.force === true;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  if (!force && cached !== null && now - cached.at < ttlMs) {
    return cached.value;
  }

  if (force) {
    cached = null;
    while (inFlight) {
      await inFlight;
    }
  } else if (inFlight && inFlightEpoch === invalidationEpoch) {
    return inFlight;
  }

  const epochAtStart = invalidationEpoch;
  const pending = (async (): Promise<TrustRecordsMeActive | null> => {
    const outcome = await runTrustRecordsMeFetch();
    if (epochAtStart !== invalidationEpoch) {
      return outcome.kind === "success" ? outcome.snapshot : null;
    }
    if (outcome.kind === "success") {
      cached = { value: outcome.snapshot, at: Date.now() };
      return outcome.snapshot;
    }
    return null;
  })().finally(() => {
    if (inFlight === pending) inFlight = null;
  });

  inFlight = pending;
  inFlightEpoch = epochAtStart;
  return pending;
}

/** Clears TTL cache and drops reference to in-flight work. For unit tests only. */
export function resetTrustRecordsMeActiveClientForTests(): void {
  if (crossTabListenerInstalled && typeof window !== "undefined") {
    window.removeEventListener("storage", handleTrustRecordsMeActiveCrossTabStorageEvent);
  }
  crossTabListenerInstalled = false;
  cached = null;
  inFlight = null;
  invalidationEpoch = 0;
  inFlightEpoch = 0;
}

export function computeTrustBindingMismatch(
  binding: SmartTrustPlatformBinding,
  serverSnapshot: TrustRecordsMeActive | null,
  serverMeLoaded: boolean
): boolean {
  if (!serverMeLoaded || serverSnapshot === null) return false;
  const loc = binding.trustId ?? "";
  const srv = serverSnapshot.trustId ?? "";
  if (loc === srv) return false;
  if (!loc && !srv) return false;
  return true;
}
