/**
 * Approval-gated launch transition — executive desk must not bypass governance.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { executiveBentleyIntakeComplete } from "@/lib/revenue-os/executive-bentley-intake";

export type ExecutiveBentleyLaunchGovernance = {
  canProposeLaunch: boolean;
  canAutoPublish: false;
  canBypassApproval: false;
  canBypassContent360: false;
  blockers: string[];
  nextGovernedAction: string;
};

/** Deterministic launch posture for executive HUD (no autonomous execution). */
export function assessExecutiveBentleyLaunchGovernance(
  snap: BentleySnapshot,
  opts?: {
    pendingApprovals?: number | null;
    content360Configured?: boolean;
    oauthConnected?: boolean;
  },
): ExecutiveBentleyLaunchGovernance {
  const blockers: string[] = [];
  const wf = loadWorkflowState();

  if (!executiveBentleyIntakeComplete(snap)) {
    blockers.push("Complete guided intake before launch preparation.");
  }
  if (!wf.artifacts?.campaign) {
    blockers.push("Run campaign generation — no campaign artifacts in workflow yet.");
  }
  if (!wf.artifacts?.bentleyDbCampaignId && !snap.pipeline?.campaignGenerated) {
    blockers.push("Persist campaign to database (pipeline sync-launch step).");
  }
  if ((opts?.pendingApprovals ?? 0) > 0) {
    blockers.push(`${opts!.pendingApprovals} executive approval(s) pending.`);
  }
  if (snap.postingPlatforms?.length && !opts?.oauthConnected) {
    blockers.push("Connect OAuth for selected posting platforms.");
  }

  const canProposeLaunch = blockers.length === 0;

  return {
    canProposeLaunch,
    canAutoPublish: false,
    canBypassApproval: false,
    canBypassContent360: false,
    blockers,
    nextGovernedAction: canProposeLaunch
      ? opts?.content360Configured
        ? "Propose launch readiness review — Content360 scheduling remains approval-gated."
        : "Propose launch readiness review — publish stays owner-approved."
      : blockers[0] ?? "Complete pipeline stages in the HUD timeline.",
  };
}

export function executiveBentleyLaunchGovernanceVoiceLine(g: ExecutiveBentleyLaunchGovernance): string {
  if (g.canProposeLaunch) {
    return `Launch is **approval-gated**, Boss. ${g.nextGovernedAction} I will not auto-publish or bypass Content360.`;
  }
  return `Launch is blocked: ${g.blockers.slice(0, 3).join(" ")}`;
}
