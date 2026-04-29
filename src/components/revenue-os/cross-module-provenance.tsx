"use client";

/**
 * Compact provenance UI for Revenue OS cross-module links (hints vs committed vs skipped).
 */

export type AuditLike = {
  sourceModule?: string;
  action?: string;
  at?: string;
  ids?: Record<string, string | undefined>;
  note?: string;
};

function labelForAudit(a: AuditLike): { text: string; kind: "hint" | "committed" | "skipped" } {
  const action = a.action ?? "";
  if (action === "experiment_winner_to_offer_version") {
    return { text: "Applied from experiment winner", kind: "committed" };
  }
  if (action === "market_scan_merged_into_offer_generation") {
    return { text: "Informed by market scan", kind: "hint" };
  }
  if (action === "deployment_channel_hints") {
    return { text: "Hints derived from capital plan", kind: "hint" };
  }
  return { text: action || a.sourceModule || "Cross-module link", kind: "hint" };
}

export function summarizeAuditEntries(
  raw: unknown,
  maxItems = 2
): {
  items: Array<{ line: string; kind: "hint" | "committed" | "skipped" }>;
  overflow: number;
} {
  if (!Array.isArray(raw)) return { items: [], overflow: 0 };
  const entries = raw.filter((x) => x && typeof x === "object") as AuditLike[];
  const items = entries.slice(0, maxItems).map((a) => {
    const { text, kind } = labelForAudit(a);
    const idBits: string[] = [];
    if (a.ids?.experimentId) idBits.push(`exp ${a.ids.experimentId.slice(0, 8)}…`);
    if (a.ids?.marketScanId) idBits.push(`scan ${a.ids.marketScanId.slice(0, 8)}…`);
    if (a.ids?.capitalPlanId) idBits.push(`plan ${a.ids.capitalPlanId.slice(0, 8)}…`);
    const suffix = idBits.length > 0 ? ` (${idBits.join(", ")})` : "";
    return { line: `${text}${suffix}`, kind };
  });
  return { items, overflow: Math.max(0, entries.length - maxItems) };
}

const badge =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function CrossModuleProvenanceStrip({
  title = "Cross-module influence",
  crossModuleAudit,
  marketScanMergeSkipped,
  className = "",
}: {
  title?: string;
  crossModuleAudit?: unknown;
  marketScanMergeSkipped?: string | null;
  className?: string;
}) {
  const { items, overflow } = summarizeAuditEntries(crossModuleAudit, 2);
  const hasSkipped = Boolean(marketScanMergeSkipped);
  const hasAudit = Array.isArray(crossModuleAudit) && crossModuleAudit.length > 0;

  if (items.length === 0 && !hasSkipped && !hasAudit) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-cyan-500/25 bg-slate-900/50 px-3 py-2 text-xs ${className}`}
      role="region"
      aria-label={title}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        {title}
      </div>
      {hasSkipped && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`${badge} bg-slate-600/50 text-gray-300`}>Skipped merge</span>
          <span className="text-gray-400">
            Market scan merge skipped ({marketScanMergeSkipped}). Use a v2 normalized scan to merge
            copy.
          </span>
        </div>
      )}
      {items.map(({ line, kind }, i) => (
        <div key={i} className="flex flex-wrap items-start gap-2 mb-1 last:mb-0">
          <span
            className={`${badge} shrink-0 ${
              kind === "committed"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/25"
            }`}
          >
            {kind === "committed" ? "Committed change" : "Guidance"}
          </span>
          <span className="text-gray-300 leading-snug">{line}</span>
        </div>
      ))}
      {overflow > 0 && (
        <div className="text-[10px] text-gray-500 mt-1">+{overflow} more audit entries in data</div>
      )}
    </div>
  );
}

/** Deployment artifact (sequence/funnel row) — capital hints only. */
export function CapitalPlanHintsBadge({
  crossModuleContext,
}: {
  crossModuleContext: unknown;
}) {
  if (!crossModuleContext || typeof crossModuleContext !== "object") return null;
  const c = crossModuleContext as Record<string, unknown>;
  const planId = typeof c.capitalPlanId === "string" ? c.capitalPlanId : null;
  const priority = Array.isArray(c.channelPriority) ? c.channelPriority : null;
  if (!planId && !priority) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
      <span className="rounded bg-amber-500/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-200 border border-amber-500/30">
        Hints from capital plan
      </span>
      {priority && (
        <span className="text-gray-400">
          Channel priority: {(priority as string[]).join(" → ")}
        </span>
      )}
      {planId && (
        <span className="text-gray-500 font-mono">plan {planId.slice(0, 8)}…</span>
      )}
    </div>
  );
}

export function FunnelRunCapitalHints({
  resultSummary,
}: {
  resultSummary: unknown;
}) {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const r = resultSummary as Record<string, unknown>;
  const hints = r.capitalPlanHints;
  if (!hints || typeof hints !== "object") return null;
  const h = hints as Record<string, unknown>;
  const cp = Array.isArray(h.channelPriority) ? (h.channelPriority as string[]) : null;
  if (!cp?.length) return null;

  return (
    <div className="mt-1.5 text-[10px] text-amber-200/90 flex flex-wrap items-center gap-2">
      <span className="font-semibold uppercase tracking-wide">Capital hints (run)</span>
      <span className="text-gray-400">{cp.join(" → ")}</span>
    </div>
  );
}
