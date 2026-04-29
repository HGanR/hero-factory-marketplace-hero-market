"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SMART_TRUST_PLATFORM_BINDING_KEY,
  SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT,
  loadSmartTrustPlatformBinding,
  saveSmartTrustPlatformBinding,
  type SmartTrustPlatformBinding,
} from "@/lib/smart-trust-platform-binding";
import {
  computeTrustBindingMismatch,
  fetchTrustRecordsMeActive,
  invalidateTrustRecordsMeActiveCache,
  subscribeTrustRecordsServerActiveUpdated,
  type TrustRecordsMeActive,
} from "@/lib/trust-records-me-client";
import { useTrustActiveServerOptional } from "@/context/TrustActiveServerContext";

export type { TrustRecordsMeActive } from "@/lib/trust-records-me-client";
export { computeTrustBindingMismatch } from "@/lib/trust-records-me-client";

export type CoherenceWorkspace = { id: string; name?: string | null; clientId?: string | null };

export function useTrustBindingCoherence(options?: {
  /** Skip binding listeners and server refresh (e.g. SSR or gated parent) */
  enabled?: boolean;
  workspaces?: CoherenceWorkspace[];
  /** POST /api/trust-records/active body.source */
  activePostSource?: string;
}) {
  const enabled = options?.enabled !== false;
  const workspaces = options?.workspaces ?? [];
  const activePostSource = options?.activePostSource ?? "dashboard";
  const sharedServer = useTrustActiveServerOptional();

  const [binding, setBinding] = useState<SmartTrustPlatformBinding>(() => loadSmartTrustPlatformBinding());
  const [internalSnapshot, setInternalSnapshot] = useState<TrustRecordsMeActive | null>(null);
  const [internalLoaded, setInternalLoaded] = useState(false);
  const [internalLoading, setInternalLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBinding = useCallback(() => {
    setBinding(loadSmartTrustPlatformBinding());
  }, []);

  const internalRefetch = useCallback(
    async (opts?: { force?: boolean }): Promise<TrustRecordsMeActive | null> => {
      if (!enabled) {
        setInternalLoading(false);
        return null;
      }
      setInternalLoading(true);
      try {
        const snap = await fetchTrustRecordsMeActive(opts?.force ? { force: true } : undefined);
        setInternalSnapshot(snap);
        setInternalLoaded(true);
        return snap;
      } catch {
        setInternalSnapshot(null);
        setInternalLoaded(true);
        return null;
      } finally {
        setInternalLoading(false);
      }
    },
    [enabled]
  );

  const refetch = useCallback(
    async (opts?: { force?: boolean }): Promise<TrustRecordsMeActive | null> => {
      if (!enabled) {
        if (!sharedServer) setInternalLoading(false);
        return null;
      }
      if (sharedServer) return sharedServer.refreshTrustRecordsMe();
      return internalRefetch(opts);
    },
    [enabled, sharedServer, internalRefetch]
  );

  useEffect(() => {
    if (!enabled || sharedServer) return;
    void internalRefetch();
  }, [enabled, sharedServer, internalRefetch]);

  useEffect(() => {
    if (!enabled || sharedServer || typeof window === "undefined") return;
    return subscribeTrustRecordsServerActiveUpdated(() => {
      void internalRefetch({ force: true });
    });
  }, [enabled, sharedServer, internalRefetch]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_PLATFORM_BINDING_KEY || e.key === null) refreshBinding();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, refreshBinding);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SMART_TRUST_PLATFORM_BINDING_UPDATED_EVENT, refreshBinding);
    };
  }, [enabled, refreshBinding]);

  const serverSnapshot = sharedServer ? sharedServer.serverSnapshot : internalSnapshot;
  const serverMeLoaded = sharedServer ? sharedServer.serverMeLoaded : internalLoaded;
  const loading = sharedServer ? sharedServer.serverMeLoading : internalLoading;

  const mismatch = useMemo(
    () => computeTrustBindingMismatch(binding, serverSnapshot, serverMeLoaded),
    [binding, serverSnapshot, serverMeLoaded]
  );

  const adoptServerActive = useCallback(async () => {
    if (!serverSnapshot?.trustId) return;
    setBusy(true);
    setError(null);
    try {
      saveSmartTrustPlatformBinding({
        trustId: serverSnapshot.trustId,
        clientId: serverSnapshot.clientId,
      });
      refreshBinding();
      await refetch({ force: true });
    } finally {
      setBusy(false);
    }
  }, [serverSnapshot, refetch, refreshBinding]);

  const pushLocalToServer = useCallback(async () => {
    const tid = binding.trustId;
    if (!tid) return;
    const workspace = workspaces.find((w) => w.id === tid);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trust-records/active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustId: tid,
          ...(workspace?.clientId ? { clientId: workspace.clientId } : {}),
          source: activePostSource,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
      if (!res.ok || data.ok !== true) {
        setError(data?.error?.message ?? "Could not update server active trust.");
        return;
      }
      invalidateTrustRecordsMeActiveCache();
      await refetch({ force: true });
    } catch {
      setError("Network error while updating server.");
    } finally {
      setBusy(false);
    }
  }, [binding.trustId, workspaces, refetch, activePostSource]);

  return {
    binding,
    serverSnapshot,
    serverMeLoaded,
    loading,
    mismatch,
    busy,
    error,
    refetch,
    adoptServerActive,
    pushLocalToServer,
    refreshBinding,
    clearError: () => setError(null),
  };
}
