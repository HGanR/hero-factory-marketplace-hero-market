/**
 * Post-pipeline lifecycle stages — persisted on `BentleyWorkflowState.lifecycle`.
 * Honest statuses: do not mark `ok` without evidence; use `waiting` / `unknown` / `blocked`.
 */

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export type BentleyLifecycleStageId =
  | "pipeline_complete"
  | "campaign_persisted"
  | "launch_synced"
  | "launch_finalized"
  | "analytics_ready"
  | "optimization_ready"
  | "optimization_executed";

export type BentleyLifecycleStageStatus = "pending" | "ok" | "blocked" | "waiting" | "unknown";

export type BentleyLifecycleStageRecord = {
  status: BentleyLifecycleStageStatus;
  /** ISO time when this record was last written */
  at?: string;
  /** Operator-facing reason (block, wait, or unknown) */
  detail?: string;
};

export type BentleyLifecycleProgress = Partial<Record<BentleyLifecycleStageId, BentleyLifecycleStageRecord>>;

export const BENTLEY_LIFECYCLE_STAGE_ORDER: BentleyLifecycleStageId[] = [
  "pipeline_complete",
  "campaign_persisted",
  "launch_synced",
  "launch_finalized",
  "analytics_ready",
  "optimization_ready",
  "optimization_executed",
];

export function upsertLifecycleStage<S extends { lifecycle?: BentleyLifecycleProgress; updatedAt: number }>(
  state: S,
  stage: BentleyLifecycleStageId,
  record: BentleyLifecycleStageRecord
): S {
  const at = record.at ?? new Date().toISOString();
  return {
    ...state,
    lifecycle: { ...(state.lifecycle ?? {}), [stage]: { ...record, at } },
    updatedAt: Date.now(),
  };
}

export function lifecycleBlockingDetail(state: { lifecycle?: BentleyLifecycleProgress }): string | null {
  const lc = state.lifecycle ?? {};
  for (const id of BENTLEY_LIFECYCLE_STAGE_ORDER) {
    const r = lc[id];
    if (r?.status === "blocked" && coerceTrimmedString(r.detail)) {
      return `${id}: ${coerceTrimmedString(r.detail)}`;
    }
  }
  return null;
}

const MAX_LIFECYCLE_DETAIL = 400;

/** Bound lifecycle strings before sessionStorage persist. */
export function slimLifecycleProgress(lc: BentleyLifecycleProgress | undefined): BentleyLifecycleProgress | undefined {
  if (!lc || typeof lc !== "object") return undefined;
  const out: BentleyLifecycleProgress = {};
  for (const [k, v] of Object.entries(lc)) {
    if (!v || typeof v !== "object") continue;
    const d = coerceTrimmedString(v.detail) || undefined;
    out[k as BentleyLifecycleStageId] = {
      ...v,
      detail: d && d.length > MAX_LIFECYCLE_DETAIL ? `${d.slice(0, MAX_LIFECYCLE_DETAIL)}…` : d,
    };
  }
  return out;
}
