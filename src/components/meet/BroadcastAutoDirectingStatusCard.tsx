"use client";

import React from "react";
import type { BroadcastAutoDirectingSummary } from "@/hooks/useMeetBroadcast";

export function BroadcastAutoDirectingStatusCard({ summary }: { summary: BroadcastAutoDirectingSummary | null | undefined }) {
  if (!summary) {
    return (
      <p className="text-[10px] text-slate-500" data-testid="broadcast-auto-directing-status-empty">
        Auto-directing summary loads with status poll (V2 only).
      </p>
    );
  }
  return (
    <div className="text-[10px] text-slate-300 space-y-1" data-testid="broadcast-auto-directing-status-card">
      <div>
        Mode: <code className="text-sky-200">{summary.mode}</code>
      </div>
      <div>
        Recommendation:{" "}
        <code className="text-slate-200">{summary.latestRecommendedLayout ?? "—"}</code>
        {summary.latestConfidence ? (
          <span className="text-slate-500"> · {summary.latestConfidence}</span>
        ) : null}
      </div>
      {summary.latestReason ? (
        <div className="text-slate-500 leading-snug" title={summary.latestReason}>
          {summary.latestReason.slice(0, 120)}
          {summary.latestReason.length > 120 ? "…" : ""}
        </div>
      ) : null}
      <div data-testid="broadcast-auto-directing-override-active">
        Manual override: {summary.manualOverrideActive ? "active (auto-apply paused)" : "inactive"}
      </div>
      {summary.lastAppliedAt ? (
        <div className="text-slate-500">Last auto-apply: {new Date(summary.lastAppliedAt).toLocaleString()}</div>
      ) : null}
    </div>
  );
}
