"use client";

import { useEffect, useState } from "react";
import { SnapshotHistory, type Snapshot } from "./SnapshotHistory";
import { CacTrendChart } from "./CacTrendChart";
import { GrowthTrajectoryChart } from "./GrowthTrajectoryChart";
import { OfferReconstructionTrigger } from "./OfferReconstructionTrigger";
import { ActiveExperiments } from "./ActiveExperiments";

export function PerformanceMemorySection({
  userId,
  clientId = "",
  trustId = "",
  industry,
  createWithMetrics,
  refreshKey = 0,
}: {
  userId: string;
  clientId?: string;
  trustId?: string;
  industry: string;
  createWithMetrics?: {
    traffic: number;
    conversionRatePct: number;
    avgOrderValue: number;
    cac: number;
    revenue: number;
  };
  refreshKey?: number;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ userId, limit: "12" });
        if (clientId) params.set("clientId", clientId);
        if (trustId) params.set("trustId", trustId);
        const r = await fetch(`/api/revenue-os/snapshots?${params.toString()}`);
        const j = await r.json();
        if (!ignore && r.ok) setSnapshots(j.snapshots ?? []);
      } catch {
        if (!ignore) setSnapshots([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [userId, clientId, trustId, refreshKey]);

  return (
    <div className="space-y-6">
      <SnapshotHistory
        userId={userId}
        clientId={clientId}
        trustId={trustId}
        refreshKey={refreshKey}
        snapshots={snapshots}
      />

      {!loading && snapshots.length >= 2 && (
        <div className="grid md:grid-cols-2 gap-6">
          <CacTrendChart snapshots={snapshots} />
          <GrowthTrajectoryChart snapshots={snapshots} industry={industry} />
        </div>
      )}

      {!loading && snapshots.length >= 2 && (
        <OfferReconstructionTrigger snapshots={snapshots} />
      )}

      <ActiveExperiments
        userId={userId}
        clientId={clientId}
        trustId={trustId}
        createWithMetrics={createWithMetrics}
      />
    </div>
  );
}
