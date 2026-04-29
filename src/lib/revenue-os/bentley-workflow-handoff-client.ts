/**
 * Client-only helpers: read/clear Bentley SLI handoff attached to the Revenue OS workflow artifact.
 */

import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import { loadWorkflowState, saveWorkflowState } from "@/lib/revenue-os/bentley-workflow";

/** Payload fields to merge into generation POST bodies (optional; backward-compatible). */
export function getWorkflowBentleyHandoffForGeneration(): {
  bentleySliContentHandoff?: BentleyContentBundleHandoff;
  bentleyHandoffId?: string;
} {
  const h = loadWorkflowState().artifacts.bentleySliContentHandoff;
  if (!h) return {};
  return {
    bentleySliContentHandoff: h,
    ...(h.handoffId ? { bentleyHandoffId: h.handoffId } : {}),
  };
}

export function clearWorkflowBentleyHandoff(): void {
  const ws = loadWorkflowState();
  saveWorkflowState({
    ...ws,
    artifacts: { ...ws.artifacts, bentleySliContentHandoff: null },
  });
}
