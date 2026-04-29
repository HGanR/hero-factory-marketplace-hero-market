"use client";

import { useCallback, useEffect, useState } from "react";
import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";
import { BentleyCommandCenterShell } from "@/components/revenue-os/bentley-command-center/BentleyCommandCenterShell";

export function BentleySocialCommandCenterClient() {
  const [clientId, setClientId] = useState("");
  const [trustId, setTrustId] = useState("");
  const [payload, setPayload] = useState<BentleySocialCommandCenterPayload | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (clientId.trim()) sp.set("clientId", clientId.trim());
      if (trustId.trim()) sp.set("trustId", trustId.trim());
      sp.set("includeHeavyReports", "true");
      const res = await fetch(`/api/revenue-os/social-command-center?${sp.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as {
        signedOut?: boolean;
        commandCenter?: BentleySocialCommandCenterPayload;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSignedOut(Boolean(data.signedOut));
      if (data.commandCenter) setPayload(data.commandCenter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [clientId, trustId]);

  useEffect(() => {
    void load();
    // Initial load only — use "Apply workspace scope" to refetch with new client/trust.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading command center…
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-rose-300">
        {error}
      </div>
    );
  }

  if (!payload) return null;

  return (
    <>
      {loading ? (
        <div className="fixed right-4 top-4 z-50 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-zinc-400">
          Refreshing…
        </div>
      ) : null}
      {error ? <div className="fixed left-4 top-4 z-50 text-xs text-rose-300">{error}</div> : null}
      <BentleyCommandCenterShell
        payload={payload}
        signedOut={signedOut}
        clientId={clientId}
        trustId={trustId}
        onClientIdChange={setClientId}
        onTrustIdChange={setTrustId}
        onRefresh={load}
      />
    </>
  );
}
