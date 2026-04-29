import type { PtJobRow } from "./schema";

export type PtJobStatus = PtJobRow["status"];

/** Transitions the public client may request (submit / cancel). */
const PUBLIC_NEXT: Record<PtJobStatus, PtJobStatus[]> = {
  draft: ["queued", "cancelled"],
  queued: ["cancelled"],
  running: [],
  succeeded: [],
  failed: [],
  cancelled: [],
};

/** Transitions the reconstruction worker (internal) may apply. */
const INTERNAL_NEXT: Record<PtJobStatus, PtJobStatus[]> = {
  draft: ["queued", "cancelled"],
  queued: ["running", "cancelled", "failed"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: ["queued"],
  cancelled: [],
};

export function isPublicTransition(from: PtJobStatus, to: PtJobStatus): boolean {
  return PUBLIC_NEXT[from]?.includes(to) ?? false;
}

export function isInternalTransition(from: PtJobStatus, to: PtJobStatus): boolean {
  return INTERNAL_NEXT[from]?.includes(to) ?? false;
}

export function isAllowedTransition(
  from: PtJobStatus,
  to: PtJobStatus,
  internal: boolean
): boolean {
  if (from === to) return true;
  return internal ? isInternalTransition(from, to) : isPublicTransition(from, to);
}
