/**
 * Bentley: sequence → suggested posting schedule (chat surface).
 */

import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import type { RevenueOsSuggestedSchedulePlan } from "@/lib/revenue-os/content-sequence-schedule-types";

export function isSequenceScheduleIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\bapply the schedule\b/.test(t)) return true;
  if (/\bwhen should these posts go out\b/.test(t)) return true;
  if (/\bbuild my posting schedule\b/.test(t)) return true;
  if (/\bwhat days should i post\b/.test(t)) return true;
  if (/\bwhat should be scheduled first\b/.test(t)) return true;
  if (/\bposting schedule\b/.test(t) && /\b(build|make|create|my)\b/.test(t)) return true;
  if (/\bwhen should i post\b/.test(t) && /\b(time|schedule|go out)\b/.test(t)) return true;
  return false;
}

export function formatBentleySequenceScheduleReply(args: {
  sequence: RevenueOsBatchCalendarSequence;
  schedulePlan: RevenueOsSuggestedSchedulePlan;
  debug?: boolean;
}): string {
  const { sequence, schedulePlan, debug } = args;
  const lines: string[] = [];
  lines.push(
    "**Posting schedule** — directional times from your **batch calendar sequence**. This is guidance; I’m **not** changing `scheduledAt` from chat — use **Step 4 → Sequence schedule** to apply safely."
  );

  if (!sequence.slots.length) {
    lines.push(schedulePlan.summary);
    lines.push("**Next:** generate routed content, then open the schedule panel.");
    return lines.join("\n\n");
  }

  if (!schedulePlan.slots.length) {
    lines.push(schedulePlan.summary);
    return lines.join("\n\n");
  }

  lines.push("**Suggested order:**");
  for (let i = 0; i < schedulePlan.slots.length; i++) {
    const s = schedulePlan.slots[i]!;
    const when = s.suggestedScheduledAt
      ? `**${s.suggestedScheduledAt}** (ISO — directional)`
      : "*(day order only)*";
    const plats = s.preferredPlatforms.length ? s.preferredPlatforms.join(", ") : "—";
    lines.push(
      `${i + 1}. **Day ${s.dayIndex}** · **${s.role.replace(/_/g, " ")}** · ${when} · ${plats} · *${s.confidence}*\n   _${s.reason.slice(0, 220)}${s.reason.length > 220 ? "…" : ""}_`
    );
  }

  lines.push(`**Summary:** ${schedulePlan.summary}`);

  if (schedulePlan.timezoneStrategy === "none") {
    lines.push(
      "**Timezone:** not set — times are **UTC-neutral midday-style** ISO stamps. Add your timezone in the schedule panel for closer wall-clock guidance."
    );
  }

  lines.push("Open **Step 4 → Sequence → schedule** (`#bentley-sequence-schedule`) to **apply** suggestions to drafts (with overwrite protection).");

  if (debug && schedulePlan.diagnostics) {
    lines.push("```json");
    lines.push(JSON.stringify(schedulePlan.diagnostics, null, 2));
    lines.push("```");
  }

  return lines.join("\n\n");
}

export function buildSequenceSchedulePlanForChat(args: {
  batchCalendarSequence: RevenueOsBatchCalendarSequence;
  launchPlan?: import("@/lib/revenue-os/launch-mode-types").RevenueOsLaunchModePlan | null;
  now?: Date;
  userTimezoneHint?: string | null;
}): RevenueOsSuggestedSchedulePlan {
  return buildSequenceSchedulePlan({
    batchCalendarSequence: args.batchCalendarSequence,
    launchPlan: args.launchPlan ?? null,
    now: args.now,
    userTimezoneHint: args.userTimezoneHint ?? null,
  });
}
