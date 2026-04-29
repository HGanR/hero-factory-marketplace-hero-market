"use client";

const GOLD = "#D4AF37";

type Snapshot = {
  month: string;
  revenue: number;
};

/**
 * Shows when last 2+ snapshots indicate stalled growth (flat or declining revenue).
 */
export function OfferReconstructionTrigger({
  snapshots,
}: {
  snapshots: Snapshot[];
}) {
  if (snapshots.length < 2) return null;

  const sorted = [...snapshots].sort(
    (a, b) => (a.month > b.month ? 1 : -1)
  );
  const last2 = sorted.slice(-2);
  const rev0 = last2[0]?.revenue ?? 0;
  const rev1 = last2[1]?.revenue ?? 0;
  const change = rev0 > 0 ? (rev1 - rev0) / rev0 : 0;

  if (change >= 0.02) return null;

  const stalled = change <= 0;

  return (
    <div
      className="rounded-2xl border-2 p-6"
      style={{
        borderColor: stalled ? "#ef4444" : "#eab308",
        backgroundColor: stalled ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.08)",
      }}
    >
      <div className="text-sm font-semibold" style={{ color: stalled ? "#ef4444" : "#eab308" }}>
        Offer Reconstruction Trigger
      </div>
      <p className="text-gray-300 text-sm mt-2">
        {stalled
          ? "Revenue is flat or declining over the last 2 months. Consider offer reconstruction: review pricing, upsells, or positioning."
          : "Revenue growth is slowing. Monitor and consider small offer or funnel adjustments."}
      </p>
      <div className="mt-2 text-xs text-gray-500">
        Last 2 months: {last2[0]?.month} → {last2[1]?.month} ({change >= 0 ? "+" : ""}
        {(change * 100).toFixed(1)}%)
      </div>
    </div>
  );
}
