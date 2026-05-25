/**
 * One-shot repair for corrupt Bentley session JSON (numbers stored where strings are expected).
 * Re-reads through sanitizers and writes canonical + workflow blobs back to session/localStorage.
 */

import { readCanonicalBentleySnapshot, writeCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import { loadWorkflowState, saveWorkflowState } from "@/lib/revenue-os/bentley-workflow";

export function repairCorruptBentleyPersistedSession(): void {
  if (typeof window === "undefined") return;
  try {
    saveWorkflowState(loadWorkflowState());
  } catch {
    /* ignore quota / parse */
  }
  try {
    const snap = readCanonicalBentleySnapshot();
    if (snap) writeCanonicalBentleySnapshot(snap);
  } catch {
    /* ignore */
  }
}
