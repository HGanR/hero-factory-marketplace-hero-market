/**
 * Campaign memory continuity — canonical snapshot + workflow + executive session.
 */

import { readCanonicalBentleySnapshot, writeCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import {
  readExecutiveBentleySession,
  type ExecutiveBentleySession,
} from "@/lib/revenue-os/executive-bentley-session";
import { executiveBentleyIntakeComplete } from "@/lib/revenue-os/executive-bentley-intake";

export type ExecutiveBentleyCampaignMemory = {
  session: ExecutiveBentleySession | null;
  snapshot: BentleySnapshot | null;
  workflowPhaseCount: number;
  intakeComplete: boolean;
  hasCampaignArtifacts: boolean;
  continuityLine: string;
};

export function readExecutiveBentleyCampaignMemory(): ExecutiveBentleyCampaignMemory {
  const session = readExecutiveBentleySession();
  const snapshot = readCanonicalBentleySnapshot();
  const wf = loadWorkflowState();
  const completedPhases = Object.keys(wf.completed ?? {}).filter((k) => wf.completed?.[k as keyof typeof wf.completed]);
  const intakeComplete = snapshot ? executiveBentleyIntakeComplete(snapshot) : false;
  const hasCampaignArtifacts = Boolean(wf.artifacts?.campaign);

  let continuityLine = "No active Bentley campaign session.";
  if (session && snapshot) {
    const name = snapshot.businessName?.trim() || "campaign";
    continuityLine = intakeComplete
      ? hasCampaignArtifacts
        ? `Resuming **${name}** — ${completedPhases.length} pipeline phase(s) saved in session.`
        : `**${name}** intake saved — pipeline can run from executive desk or AI Revenue OS.`
      : `**${name}** intake in progress — answers sync to the real Bentley pipeline.`;
  } else if (snapshot) {
    continuityLine = "Canonical Bentley snapshot restored from session storage.";
  }

  return {
    session,
    snapshot,
    workflowPhaseCount: completedPhases.length,
    intakeComplete,
    hasCampaignArtifacts,
    continuityLine,
  };
}

export function persistExecutiveBentleySnapshot(snapshot: BentleySnapshot): void {
  writeCanonicalBentleySnapshot(snapshot);
}
