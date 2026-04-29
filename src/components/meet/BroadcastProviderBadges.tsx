"use client";

import React from "react";
import { getProviderCapabilities } from "@/lib/streaming/provider-capabilities";

export function BroadcastProviderBadges({
  platform,
  compact = false,
}: {
  platform: string;
  /** Smaller text for dense lists. */
  compact?: boolean;
}) {
  const c = getProviderCapabilities(platform);
  const base =
    "inline-flex items-center rounded px-1.5 py-0.5 border text-[9px] font-medium uppercase tracking-wide";

  return (
    <div
      className={`flex flex-wrap gap-1 ${compact ? "mt-0.5" : "mt-1"}`}
      data-testid={`broadcast-provider-badges-${c.platform}`}
    >
      <span
        className={
          c.isStableIngest
            ? `${base} bg-emerald-950/50 text-emerald-200 border-emerald-700/50`
            : `${base} bg-amber-950/50 text-amber-200 border-amber-700/50`
        }
        data-testid="badge-ingest-stability"
      >
        {c.isStableIngest ? "Stable ingest" : "Best effort"}
      </span>
      {c.requiresManualGoLive ? (
        <span
          className={`${base} bg-violet-950/50 text-violet-200 border-violet-700/50`}
          data-testid="badge-manual-go-live"
        >
          Manual go live
        </span>
      ) : null}
      {c.supportsPortrait ? (
        <span
          className={`${base} bg-sky-950/50 text-sky-200 border-sky-700/50`}
          data-testid="badge-portrait"
        >
          Portrait recommended
        </span>
      ) : null}
    </div>
  );
}
