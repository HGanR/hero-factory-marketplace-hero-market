/**
 * Bentley chat copy for deployment readiness — read-only guidance (no publish).
 */

import type { AdvanceBentleyPipelineStageResult } from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";

export function isDeploymentReadinessIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (
    /\bcan we deploy\b/.test(t) ||
    /\bready to post\b/.test(t) ||
    /\b(is this|are we) ready\b.*\bpost/.test(t) ||
    /\blaunch this\b/.test(t) ||
    /\bdeploy(ment)?\b.*\bready\b/.test(t)
  ) {
    return true;
  }
  if (/\bwhat do i need before posting\b/.test(t)) return true;
  if (/\bpost(ing)?\b.*\b(readiness|ready|block)\b/.test(t)) return true;
  return false;
}

export function formatBentleyDeploymentReadinessReply(args: {
  readiness: { isReady: boolean; blockers: string[]; strengths: string[] };
  handoff: AdvanceBentleyPipelineStageResult;
  draftCount: number;
}): string {
  const { readiness, handoff, draftCount } = args;
  const lines: string[] = [];

  lines.push("**Deployment readiness** (nothing auto-posts from chat).");

  if (readiness.isReady) {
    lines.push(
      "You’re in good shape to **review the draft queue** and publish manually when assets are attached."
    );
  } else if (readiness.blockers.length) {
    lines.push("**Blockers:**");
    lines.push(...readiness.blockers.map((b) => `• ${b}`));
  }

  if (readiness.strengths.length) {
    lines.push("**Strengths:**");
    lines.push(...readiness.strengths.slice(0, 6).map((s) => `• ${s}`));
  }

  lines.push(`**Draft posts prepared (copy):** ${draftCount}`);

  lines.push(`**Recommended focus:** ${handoff.headline}`);
  if (handoff.nextActions[0]) {
    lines.push(`**Next action:** ${handoff.nextActions[0]}`);
  }

  lines.push(
    "Open **Step 4 → Deployment readiness** on AI Revenue OS, or **Launch Campaigns** on the dashboard to connect accounts and review rows."
  );

  return lines.join("\n\n");
}
