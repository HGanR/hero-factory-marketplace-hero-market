import { buildRetMaaniaSnapshot } from "@/lib/maania/build-maania-snapshot";
import type { RetAgentDraft } from "@/lib/ret/types";

/** Build agent snapshot from stored JSON; returns null if shape is invalid. */
export function retSnapshotFromDraftJson(draftJson: string): Record<string, unknown> | null {
  try {
    const d = JSON.parse(draftJson) as RetAgentDraft;
    if (!d?.intake || !d.flags || !d.risk) return null;
    return buildRetMaaniaSnapshot(d, {});
  } catch {
    return null;
  }
}
