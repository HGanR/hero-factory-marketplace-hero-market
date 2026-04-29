"use client";

/** CAC as % of AOV: ≤33 Safe, 33–50 Caution, >50 Risk */
function getRiskBand(cac: number, aov: number): "safe" | "caution" | "risk" {
  if (aov <= 0) return "safe";
  const pct = (cac / aov) * 100;
  if (pct <= 33) return "safe";
  if (pct <= 50) return "caution";
  return "risk";
}

export function CacRiskBand({ cac, aov }: { cac: number; aov: number }) {
  const band = getRiskBand(cac, aov);
  const pct = aov > 0 ? ((cac / aov) * 100).toFixed(1) : "0";

  const styles: Record<string, { bg: string; border: string; label: string }> = {
    safe: {
      bg: "rgba(34,197,94,0.15)",
      border: "#22c55e",
      label: "Safe",
    },
    caution: {
      bg: "rgba(234,179,8,0.15)",
      border: "#eab308",
      label: "Caution",
    },
    risk: {
      bg: "rgba(239,68,68,0.15)",
      border: "#ef4444",
      label: "Risk",
    },
  };

  const s = styles[band];

  return (
    <div className="mt-4">
      <div
        className="rounded-xl border-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: s.bg, borderColor: s.border }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: s.border }}>
            Risk Band: {s.label}
          </span>
          <span className="text-xs text-gray-400">
            CAC is {pct}% of AOV
          </span>
        </div>
        {band === "risk" && (
          <p className="text-xs text-gray-300 max-w-md">
            Do not scale spend until CAC drops below 50% of AOV or AOV increases.
          </p>
        )}
      </div>
    </div>
  );
}
