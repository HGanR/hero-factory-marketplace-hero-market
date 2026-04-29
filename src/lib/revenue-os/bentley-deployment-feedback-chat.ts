/**
 * Bentley chat: deployment feedback / “how is my campaign doing” intents.
 */

import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import type { DeploymentFeedbackRollup } from "@/lib/revenue-os/deployment-feedback-summary";
import type { SocialPlatform } from "@/lib/social/config";

export function isDeploymentFeedbackIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\b(random|ignore)\b/.test(t) && t.length < 40) return false;
  if (/\bwhat is working\b/.test(t)) return true;
  if (/\bhow did my campaign\b/.test(t)) return true;
  if (/\bcampaign do\b/.test(t) || /\bmy campaign\b/.test(t)) return true;
  if (/\bwhat platform is performing best\b/.test(t)) return true;
  if (/\b(performance|deployment feedback|channel metrics|results)\b/.test(t) && /\b(what|how|which|show)\b/.test(t)) {
    return true;
  }
  return false;
}

function platformLabel(p: string): string {
  const x = p.trim().toLowerCase();
  if (x === "linkedin") return "LinkedIn";
  if (x === "instagram") return "Instagram";
  if (x === "facebook") return "Facebook";
  if (x === "tiktok") return "TikTok";
  if (x === "x" || x === "twitter") return "X";
  return p.trim() || "—";
}

export function formatBentleyDeploymentFeedbackReply(args: {
  rollup: DeploymentFeedbackRollup;
  latest: NormalizedDeploymentFeedback | null;
  rowCount: number;
  systemSignalsEnriched?: boolean;
  debug?: boolean;
  metricSyncContext?: {
    liveMetricPlatforms: SocialPlatform[];
    stubPublishPlatforms: SocialPlatform[];
  };
}): string {
  const { rollup, latest, rowCount, metricSyncContext } = args;
  const lines: string[] = [];

  lines.push(
    "**Deployment feedback** — from stored publish outcomes and (when synced) platform metrics. I’m **not** inventing impressions; anything not in the database is labeled honestly."
  );

  const pub = latest?.publishStatus === "published";
  const failed = latest?.publishStatus === "failed";
  if (latest) {
    const st = latest.publishStatus;
    const plat = platformLabel(latest.platform);
    if (pub) {
      lines.push(
        `Latest row: **${plat}** — **Published (recorded)**${latest.publishedAt ? ` at ${latest.publishedAt.slice(0, 19)}Z` : ""}.`
      );
    } else if (failed) {
      lines.push(`Latest row: **${plat}** — publish **failed** (see Launch Campaigns for detail).`);
    } else {
      lines.push(`Latest row: **${plat}** — status **${st}** (lifecycle / worker state).`);
    }
  } else {
    lines.push("No recent publish-outcome rows in scope — run content or connect accounts, then check again.");
  }

  lines.push(
    `**Rollup (window):** ${rollup.publishedCount} published · ${rollup.failedCount} failed · ${rollup.retryCount} retry · **${rowCount}** row(s) loaded.`
  );

  const live = metricSyncContext?.liveMetricPlatforms?.length
    ? metricSyncContext.liveMetricPlatforms.map(platformLabel).join(", ")
    : null;
  const stubs = metricSyncContext?.stubPublishPlatforms?.length
    ? metricSyncContext.stubPublishPlatforms.map(platformLabel).join(", ")
    : null;

  if (rollup.hasPerformanceMetrics) {
    lines.push(
      "**Channel metrics:** some posts have measured impressions / engagement in the database — use the dashboard charts for exact numbers."
    );
  } else {
    lines.push(
      "**Channel metrics:** performance numbers are **not in the database** for this snapshot (sync may be pending or stubbed for some surfaces)."
    );
  }

  if (live) {
    lines.push(
      `**Platform performance sync:** live metric adapters for **${live}** — compare likes/comments and impressions only within the same channel family.`
    );
  } else {
    lines.push(
      "**Platform performance sync:** no live metric platforms in context — treat cross-channel comparisons as directional until adapters show **live**."
    );
  }
  if (stubs) {
    lines.push(`Stub / limited surfaces in this build: **${stubs}**.`);
  }

  if (args.debug) {
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          bestMeasuredPlatform: rollup.bestMeasuredPlatform,
          bestPublishedPlatform: rollup.bestPublishedPlatform,
          hasPerformanceMetrics: rollup.hasPerformanceMetrics,
          systemSignalsEnriched: Boolean(args.systemSignalsEnriched),
        },
        null,
        2
      )
    );
    lines.push("```");
  }

  lines.push("Open **Launch Campaigns** and the Revenue OS deployment panels for drill-down — nothing was changed from chat.");

  return lines.join("\n\n");
}
