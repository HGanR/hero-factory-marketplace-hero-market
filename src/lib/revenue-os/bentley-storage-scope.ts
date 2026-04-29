/**
 * Multi-client safety: namespace Bentley sessionStorage keys by userId + clientId.
 * When no scope is set (SSR/tests), keys fall back to legacy unscoped base strings.
 */

export const BENTLEY_STORAGE_SCOPE_CHANGED_EVENT = "bentley:storage-scope-changed";

export type BentleyStorageScope = {
  userId: string;
  clientId: string;
};

/** Sentinel when no workspace client is selected (single-user / landing flows). */
export const BENTLEY_SCOPE_DEFAULT_CLIENT = "_";

let currentScope: BentleyStorageScope | null = null;

function normalizeScope(next: BentleyStorageScope): BentleyStorageScope {
  const userId = String(next.userId || "demo-user").trim() || "demo-user";
  const clientId = String(next.clientId ?? BENTLEY_SCOPE_DEFAULT_CLIENT).trim() || BENTLEY_SCOPE_DEFAULT_CLIENT;
  return { userId, clientId };
}

function scopesEqual(a: BentleyStorageScope | null, b: BentleyStorageScope | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.userId === b.userId && a.clientId === b.clientId;
}

export function setBentleyStorageScope(next: BentleyStorageScope | null): void {
  const normalized = next ? normalizeScope(next) : null;
  if (scopesEqual(currentScope, normalized)) return;
  currentScope = normalized;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BENTLEY_STORAGE_SCOPE_CHANGED_EVENT));
  }
}

export function getBentleyStorageScope(): BentleyStorageScope | null {
  return currentScope;
}

/**
 * Stable sessionStorage key for the current scope.
 * Without scope (e.g. SSR), returns the legacy base key unchanged.
 */
export function bentleyScopedSessionKey(baseKey: string): string {
  if (!currentScope) return baseKey;
  const u = encodeURIComponent(currentScope.userId);
  const c = encodeURIComponent(currentScope.clientId);
  return `${baseKey}::u:${u}::c:${c}`;
}

/** Read scoped value, or migrate legacy unscoped `baseKey` into scoped storage. */
export function readBentleySessionWithLegacyFallback(baseKey: string): string | null {
  if (typeof window === "undefined") return null;
  const scoped = bentleyScopedSessionKey(baseKey);
  let v = sessionStorage.getItem(scoped);
  if (v) return v;
  v = sessionStorage.getItem(baseKey);
  if (v) {
    try {
      sessionStorage.setItem(scoped, v);
      sessionStorage.removeItem(baseKey);
    } catch {
      // quota
    }
  }
  return v;
}

export function writeBentleySession(baseKey: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(bentleyScopedSessionKey(baseKey), value);
  } catch {
    // quota
  }
}

export function removeBentleySessionScopedAndLegacy(baseKey: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(bentleyScopedSessionKey(baseKey));
    sessionStorage.removeItem(baseKey);
  } catch {
    // ignore
  }
}

/**
 * When user id / client scope differs between chat and dashboard (e.g. localStorage resolved after
 * handoff write), the scoped key may not match — scan for any session row for this logical key.
 */
export function findSessionValueByKeyPrefix(baseKey: string): { key: string; value: string } | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key === baseKey || key.startsWith(`${baseKey}::`)) {
        const value = sessionStorage.getItem(key);
        if (value) return { key, value };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Remove every sessionStorage row whose key matches this logical Bentley key (all scopes). */
export function removeAllSessionKeysForLogicalBase(baseKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key === baseKey || key.startsWith(`${baseKey}::`)) toRemove.push(key);
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}
