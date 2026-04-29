"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrustBindingCoherence, type CoherenceWorkspace } from "@/hooks/useTrustBindingCoherence";
import { workspaceLabelFromList } from "@/lib/smart-trust-platform-binding";

export type TrustBindingCoherenceNoticeProps = {
  className?: string;
  enabled?: boolean;
  workspaces?: CoherenceWorkspace[];
  activePostSource?: string;
  dashboardHref?: string;
};

/**
 * Compact browser-local vs server active trust notice for non-dashboard shells.
 */
export function TrustBindingCoherenceNotice({
  className,
  enabled = true,
  workspaces = [],
  activePostSource,
  dashboardHref = "/dashboard",
}: TrustBindingCoherenceNoticeProps) {
  const {
    mismatch,
    serverMeLoaded,
    binding,
    serverSnapshot,
    busy,
    error,
    adoptServerActive,
    pushLocalToServer,
  } = useTrustBindingCoherence({ enabled, workspaces, activePostSource });

  if (!serverMeLoaded || !mismatch) return null;

  const localLabel = workspaceLabelFromList(workspaces, binding.trustId) ?? "(none)";
  const serverLabel = workspaceLabelFromList(workspaces, serverSnapshot?.trustId ?? null) ?? "(none)";

  return (
    <div
      className={cn(
        "rounded-md border border-sky-500/20 bg-sky-950/20 px-3 py-2 text-[11px] leading-snug text-sky-100/90",
        className
      )}
      role="status"
    >
      <p className="font-medium text-sky-200/95">Browser workspace ≠ server active trust</p>
      <p className="mt-0.5 text-sky-200/75">
        This device: <span className="text-sky-50/95">{localLabel}</span>
        {binding.trustId ? (
          <span className="ml-1 font-mono text-[10px] text-slate-400">({binding.trustId.slice(0, 8)}…)</span>
        ) : null}
        · Server: <span className="text-sky-50/95">{serverLabel}</span>
        {serverSnapshot?.trustId ? (
          <span className="ml-1 font-mono text-[10px] text-slate-400">
            ({serverSnapshot.trustId.slice(0, 8)}…)
          </span>
        ) : null}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !serverSnapshot?.trustId}
          className="h-7 text-[11px]"
          onClick={() => void adoptServerActive()}
        >
          Use server
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !binding.trustId}
          className="h-7 border-sky-500/30 bg-transparent text-[11px] text-sky-100"
          onClick={() => void pushLocalToServer()}
        >
          Make server match device
        </Button>
        <Link
          href={dashboardHref}
          className="text-[11px] font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
        >
          Dashboard selector
        </Link>
      </div>
      {error ? <p className="mt-1.5 text-[10px] text-amber-400">{error}</p> : null}
    </div>
  );
}
