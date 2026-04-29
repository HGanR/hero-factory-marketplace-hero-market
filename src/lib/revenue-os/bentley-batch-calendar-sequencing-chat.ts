/**
 * Bentley: posting order / calendar sequencing from routed batches.
 */

import { buildContentBatchCalendarSequence } from "@/lib/revenue-os/build-content-batch-calendar-sequence";
import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import { buildContentBatchRoutingForWorkflow } from "@/lib/revenue-os/bentley-content-batch-routing-chat";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";

export function isBatchCalendarSequencingIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\bwhen should these posts go out\b/.test(t)) return false;
  if (/\bbuild my posting schedule\b/.test(t)) return false;
  if (/\bwhat days should i post\b/.test(t)) return false;
  if (/\bapply the schedule\b/.test(t)) return false;
  if (/\bwhat should be scheduled first\b/.test(t)) return false;
  if (/\bposting schedule\b/.test(t) && /\b(build|make|create|my)\b/.test(t)) return false;
  if (/\bwhen should i post\b/.test(t) && /\b(time|schedule|go out)\b/.test(t)) return false;
  if (/\b(platform role|which platform should i use for)\b/.test(t) && !/\b(first|order|sequence)\b/.test(t)) {
    return false;
  }
  if (
    /\bwhat should i post first\b/.test(t) ||
    /\bwhat is the right posting order\b/.test(t) ||
    /\bhow should i sequence (this )?content\b/.test(t) ||
    /\bwhat batch comes next\b/.test(t) ||
    /\bwhat should go on \w+ first\b/.test(t) ||
    /\bposting sequence\b/.test(t) ||
    /\bcalendar sequence\b/.test(t) ||
    /\bwhen should i post each\b/.test(t)
  ) {
    return true;
  }
  return false;
}

export function formatBentleyBatchCalendarSequencingReply(args: {
  sequence: RevenueOsBatchCalendarSequence;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null;
  debug?: boolean;
}): string {
  const { sequence, platformRoleRouting, debug } = args;
  const lines: string[] = [];
  lines.push(
    "**Posting sequence** — deterministic order from your **routed batches** + **platform-role routing**. This is guidance for scheduling, not auto-publishing."
  );

  if (!sequence.slots.length) {
    lines.push(sequence.summary);
    lines.push("**Next:** generate campaign / content / launch copy, then ask again.");
    return lines.join("\n\n");
  }

  lines.push("**Recommended order:**");
  for (let i = 0; i < sequence.slots.length; i++) {
    const s = sequence.slots[i]!;
    const plats = s.preferredPlatforms.length ? s.preferredPlatforms.join(", ") : "— (pick from your connected platforms)";
    const n = s.itemIds?.length ?? 0;
    const itemNote = n ? ` · ${n} mapped item id(s)` : "";
    lines.push(
      `${i + 1}. **Day ${s.dayIndex}** · **${s.role.replace(/_/g, " ")}** · ${plats} · *(${s.confidence} confidence)*${itemNote}\n   _${s.reason}_`
    );
  }

  lines.push(`**Summary:** ${sequence.summary}`);

  const lc = platformRoleRouting?.recommendations?.find((r) => r.role === "lead_capture");
  if (sequence.diagnostics?.leadCaptureSuppressed && lc?.evidenceBasis === "insufficient_data") {
    lines.push(
      "**Lead timing:** we are **not** pushing lead-capture early — deployment data does not show solid conversion/lead evidence yet."
    );
  }

  lines.push("Open **Step 4 → Batch calendar sequencing** for the panel.");

  if (debug && sequence.diagnostics) {
    lines.push("```json");
    lines.push(JSON.stringify({ ...sequence.diagnostics, strategy: sequence.sequencingStrategy }, null, 2));
    lines.push("```");
  }

  return lines.join("\n\n");
}

export function buildBatchCalendarSequencingForWorkflow(args: {
  contentEngineResult?: import("@/lib/revenue-os/content-engine-types").ContentEngineOutput | null;
  campaignResult?: import("@/lib/revenue-os/campaign-schema").CampaignResponse | null;
  launchPlan?: import("@/lib/revenue-os/launch-mode-types").RevenueOsLaunchModePlan | null;
  mediaBrief?: string | null;
  platformRoleRouting: RevenueOsPlatformRoleRoutingSummary | null;
  optimizationMemoryGeneration?: import("@/lib/revenue-os/post-optimization-memory-types").OptimizationMemoryGenerationSlice | null;
  systemSignals?: import("@/lib/revenue-os/revenue-os-system-signals-types").RevenueOsSystemSignals | null;
}): RevenueOsBatchCalendarSequence {
  const batchRouting = buildContentBatchRoutingForWorkflow({
    contentEngineResult: args.contentEngineResult,
    campaignResult: args.campaignResult,
    launchPlan: args.launchPlan,
    mediaBrief: args.mediaBrief,
    platformRoleRouting: args.platformRoleRouting,
    optimizationMemoryGeneration: args.optimizationMemoryGeneration ?? null,
  });
  return buildContentBatchCalendarSequence({
    batchRouting,
    platformRoleRouting: args.platformRoleRouting,
    launchPlan: args.launchPlan ?? null,
    systemSignals: args.systemSignals ?? null,
  });
}
