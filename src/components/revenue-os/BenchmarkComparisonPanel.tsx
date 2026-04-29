"use client";

import { useEffect, useState } from "react";

const ACCENT = "#00D1FF";

type Bench = {
  metric: string;
  value: number;
  unit: string;
  sourceName: string;
  citationUrl: string;
  year: number;
  confidence?: "HIGH" | "MEDIUM" | "VARIABLE";
  capturedAt?: string; // year or ISO date
};

export function BenchmarkComparisonPanel({
  industry,
  yourConversionPct,
  yourCac,
}: {
  industry: string;
  yourConversionPct: number;
  yourCac: number;
}) {
  const [benchmarks, setBenchmarks] = useState<Bench[]>([]);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/revenue-os/benchmarks?industry=${encodeURIComponent(industry)}`
        );
        const j = await r.json();
        if (ignore) return;
        setBenchmarks(j.benchmarks ?? []);
        setSource(j.source ?? "");
      } catch {
        if (!ignore) setBenchmarks([]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [industry]);

  const conv = benchmarks.find((b) => b.metric === "conversion_rate_pct" || b.metric === "conversion_rate");
  const cac = benchmarks.find((b) => b.metric === "cac_usd" || b.metric === "avg_cac");

  return (
    <div className="rounded-2xl border border-cyan-500/60 bg-slate-800/50 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-gray-400">Benchmark Comparison</div>
          <div className="text-xl font-semibold" style={{ color: ACCENT }}>
            {industry}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Source: {source || "db"} • Benchmarks display only when citations are available.
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <BenchmarkRow
          label="Conversion Rate"
          yourValue={`${yourConversionPct.toFixed(2)}%`}
          benchValue={conv ? `${Number(conv.value).toFixed(2)}%` : "—"}
          cite={conv ? `${conv.sourceName} (${conv.year})` : undefined}
          url={conv?.citationUrl}
          confidence={conv?.confidence}
          capturedAt={conv?.capturedAt}
        />

        <BenchmarkRow
          label="CAC"
          yourValue={`$${yourCac.toFixed(0)}`}
          benchValue={cac ? `$${Number(cac.value).toFixed(0)}` : "—"}
          cite={cac ? `${cac.sourceName} (${cac.year})` : undefined}
          url={cac?.citationUrl}
          confidence={cac?.confidence}
          capturedAt={cac?.capturedAt}
        />
      </div>
    </div>
  );
}

function BenchmarkRow({
  label,
  yourValue,
  benchValue,
  cite,
  url,
  confidence,
  capturedAt,
}: {
  label: string;
  yourValue: string;
  benchValue: string;
  cite?: string;
  url?: string;
  confidence?: "HIGH" | "MEDIUM" | "VARIABLE";
  capturedAt?: string;
}) {
  const yearLabel = capturedAt
    ? capturedAt.length === 4
      ? capturedAt
      : capturedAt.slice(0, 4)
    : undefined;

  return (
    <div className="rounded-xl border border-cyan-500/40 bg-slate-800/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm text-gray-300 font-semibold">{label}</div>
        {confidence && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor:
                confidence === "HIGH"
                  ? "rgba(34,197,94,0.2)"
                  : confidence === "MEDIUM"
                    ? "rgba(234,179,8,0.2)"
                    : "rgba(156,163,175,0.2)",
              color:
                confidence === "HIGH"
                  ? "#22c55e"
                  : confidence === "MEDIUM"
                    ? "#eab308"
                    : "#9ca3af",
            }}
          >
            Confidence: {confidence.charAt(0) + confidence.slice(1).toLowerCase()}
          </span>
        )}
        {yearLabel && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full text-gray-400"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            Updated: {yearLabel}
          </span>
        )}
      </div>
      <div className="mt-3 text-gray-300">
        <div>
          <span className="text-gray-500">Your:</span>{" "}
          <span className="font-semibold">{yourValue}</span>
        </div>
        <div className="mt-1">
          <span className="text-gray-500">Industry median:</span>{" "}
          <span className="font-semibold" style={{ color: ACCENT }}>
            {benchValue}
          </span>
        </div>
      </div>

      {cite && url && (
        <a
          className="block mt-3 text-xs text-[#D4AF37] hover:underline"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Citation: {cite} →
        </a>
      )}
    </div>
  );
}
