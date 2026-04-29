/**
 * Bentley intents: recommend platforms by business role (not a single generic “best”).
 */

import type { DeploymentFeedbackRollup } from "@/lib/revenue-os/deployment-feedback-summary";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { RevenueOsOptimizationMemorySummary } from "@/lib/revenue-os/post-optimization-memory-types";
import type { MetricSyncContextLike } from "@/lib/revenue-os/platform-evidence-weighting";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import {
  derivePlatformRoleRouting,
  inferPlatformRoleFocusFromMessage,
  type RevenueOsPlatformRole,
  type RevenueOsPlatformRoleRoutingSummary,
} from "@/lib/revenue-os/platform-role-routing";

export function isPlatformRoleRoutingIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (
    /\b(how did|campaign performance|deployment feedback|publish outcomes?|what failed|what happened after launch)\b/.test(t)
  ) {
    return false;
  }
  if (
    /\bwhat platform should i focus\b/.test(t) ||
    /\bwhich platform should i use for (awareness|engagement|authority)\b/.test(t) ||
    /\bwhich platform is best for engagement\b/.test(t) ||
    /\bwhere should i post for authority\b/.test(t) ||
    /\bwhich channel should get the next batch\b/.test(t) ||
    /\bwhere should i post for (awareness|engagement)\b/.test(t) ||
    /\bwhich platform.*\b(awareness|engagement|authority|lead|conversion|capture)\b/.test(t) ||
    /\bwhere should i post for lead\b/.test(t)
  ) {
    return true;
  }
  return false;
}

function badge(conf: string): string {
  return `*(confidence: **${conf}**)*`;
}

function formatRoleLine(
  r: RevenueOsPlatformRoleRoutingSummary["recommendations"][0],
  focus: ReturnType<typeof inferPlatformRoleFocusFromMessage>
): string | null {
  if (focus !== "all" && r.role !== focus) return null;
  const plat = r.preferredPlatform
    ? `**${r.preferredPlatform.charAt(0).toUpperCase() + r.preferredPlatform.slice(1).toLowerCase()}**`
    : "—";
  const roleLabel = r.role.replace(/_/g, " ");
  return `• **${roleLabel}** → ${plat} ${badge(r.confidence)}\n  ${r.reason}`;
}

export function formatBentleyPlatformRoleRoutingReply(args: {
  message: string;
  routing: RevenueOsPlatformRoleRoutingSummary;
  metricSyncContext?: MetricSyncContextLike | null;
  debug?: boolean;
  /** Inputs echoed in debug only */
  debugInputs?: {
    hadDeploymentRollup: boolean;
    hadMemorySummary: boolean;
    hadSignalsInput: boolean;
  };
}): string {
  const { message, routing, metricSyncContext, debug, debugInputs } = args;
  const focus = inferPlatformRoleFocusFromMessage(message);
  const lines: string[] = [];

  lines.push(
    "**Platform roles** — recommendations by **job-to-be-done** (attention, engagement, authority, lead capture, distribution). Not a single generic “best platform” unless the data supports one role only."
  );

  if (metricSyncContext?.liveMetricPlatforms?.length) {
    const live = metricSyncContext.liveMetricPlatforms.map(
      (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    );
    lines.push(`**Live metric sync:** ${live.join(", ")} — other channels may be publish-only until adapters exist.`);
  }

  const shown = routing.recommendations
    .map((r) => formatRoleLine(r, focus))
    .filter((x): x is string => Boolean(x));
  lines.push(shown.join("\n\n"));

  lines.push(routing.operationalRecommendation);
  lines.push(
    "**Next action:** align one experiment per role you care about (e.g. hook test for attention, reply prompt for engagement) and re-run metric sync before locking channel strategy."
  );

  if (debug && debugInputs) {
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          focus,
          hadDeploymentRollup: debugInputs.hadDeploymentRollup,
          hadMemorySummary: debugInputs.hadMemorySummary,
          hadSignalsInput: debugInputs.hadSignalsInput,
          confidenceNotes: routing.confidenceNotes,
          recommendations: routing.recommendations.map((r) => ({
            role: r.role,
            preferredPlatform: r.preferredPlatform,
            confidence: r.confidence,
            evidenceBasis: r.evidenceBasis,
          })),
        },
        null,
        2
      )
    );
    lines.push("```");
  }

  lines.push("Open **Step 4 → Platform role routing** for the compact panel.");

  return lines.join("\n\n");
}

export function pickRoleRecommendation(
  routing: RevenueOsPlatformRoleRoutingSummary,
  role: RevenueOsPlatformRole
): RevenueOsPlatformRoleRoutingSummary["recommendations"][0] | undefined {
  return routing.recommendations.find((x) => x.role === role);
}
