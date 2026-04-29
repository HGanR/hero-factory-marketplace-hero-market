import type { RevenueOsLaunchModePlan, RevenueOsLaunchSharedProfile } from "@/lib/revenue-os/launch-mode-types";
import { getLaunchDayScrollTargetForBentley, mapLaunchDayToActions } from "@/lib/revenue-os/map-launch-day-to-actions";

export type LaunchExecutionIntent =
  | { type: "day"; day: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
  | { type: "general_execute" }
  | { type: "none" };

export function parseLaunchExecutionIntent(message: string): LaunchExecutionIntent {
  const t = message.trim().toLowerCase();
  if (/\bhelp me execute launch mode\b/.test(t)) return { type: "general_execute" };
  if (/\btake me to content day\b/.test(t) || /\bcontent launch day\b/.test(t)) return { type: "day", day: 3 };

  const m1 = t.match(/\b(?:do|start|run)\s+day\s*([1-7])\b/);
  if (m1) return { type: "day", day: Number(m1[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 };

  const m2 = t.match(/\bwhat\s+should\s+i\s+do\s+(?:for\s+)?day\s*([1-7])\b/);
  if (m2) return { type: "day", day: Number(m2[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 };

  const m3 = t.match(/\bday\s*([1-7])\b.*\b(focus|execute|tasks?|plan)\b/);
  if (m3) return { type: "day", day: Number(m3[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 };

  return { type: "none" };
}

export function formatBentleyLaunchDayExecutionReply(params: {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  launchPlan: RevenueOsLaunchModePlan;
  sharedProfile: RevenueOsLaunchSharedProfile;
}): { reply: string; scrollTargetId: string } {
  const { day, launchPlan, sharedProfile } = params;
  const dayPlan = launchPlan.days.find((d) => d.day === day);
  if (!dayPlan) {
    return {
      reply:
        `I don’t have **Day ${day}** in the current launch plan — open **7-Day Launch Mode** and tap **Generate Launch Plan** first.`,
      scrollTargetId: "seven-day-launch-mode",
    };
  }

  const actions = mapLaunchDayToActions({ dayPlan, launchPlan, sharedProfile });
  const labels = actions
    .filter((a) => a.kind !== "scroll_to")
    .slice(0, 4)
    .map((a) => a.label);

  const scrollTargetId = getLaunchDayScrollTargetForBentley({ day, dayPlan, launchPlan, sharedProfile });

  const lines = [
    `**Launch Mode · Day ${day}** — ${dayPlan.title}`,
    "",
    dayPlan.objective,
    "",
    "**Use the panel:** In **7-Day Launch Mode**, expand **Recommended actions** for this day — buttons run safe scrolls and prefills (nothing auto-generates).",
  ];

  if (labels.length) {
    lines.push("", "**Suggested actions:**");
    labels.forEach((x) => lines.push(`• ${x}`));
  }

  lines.push("", `I’ll scroll you toward **#${scrollTargetId}** — expand Step 4 if it’s still collapsed.`);

  return { reply: lines.join("\n"), scrollTargetId };
}

export function formatBentleyLaunchGeneralExecuteReply(): string {
  return [
    "**Launch Mode execution**",
    "",
    "Work one day at a time in **7-Day Launch Mode** (below System diagnostics). Generate the plan, then use **Recommended actions** on each day card — they jump to Research, Trends, Content Engine, Campaign, and Distribution without calling APIs for you.",
    "",
    "Say **do day 1** … **do day 7**, or **take me to content day** for Day 3.",
  ].join("\n");
}
