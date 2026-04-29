import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsLaunchSharedProfile } from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";
import type { LaunchCycleEventRecord } from "@/lib/revenue-os/launch-progress-db";
import { mapLaunchDayToActions } from "@/lib/revenue-os/map-launch-day-to-actions";
import { allLaunchDaysCompleted } from "@/lib/revenue-os/launch-progress-actions";
import { summarizeLaunchCycleAnalytics, summarizeLaunchHistoryAnalytics } from "@/lib/revenue-os/launch-analytics-summary";
import { diffLaunchProgressAgainstCurrent } from "@/lib/revenue-os/launch-progress-diff";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

export function parseLaunchProgressContinuityIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  const phrases = [
    "resume launch",
    "continue launch mode",
    "what day am i on",
    "where was i",
    "what did i finish",
  ];
  if (phrases.includes(t)) return true;
  return /\b(where was i|what did i finish|resume launch|continue launch mode|what day am i on)\b/i.test(message.trim());
}

export function formatBentleyLaunchProgressReply(params: {
  progress: RevenueOsLaunchCycleProgress | null;
  plan: RevenueOsLaunchModePlan;
  sharedProfile: RevenueOsLaunchSharedProfile;
  debug?: boolean;
}): string {
  const { progress, plan, sharedProfile, debug } = params;
  if (!progress) {
    return [
      "**Launch Mode — no saved cycle**",
      "",
      "There isn’t an active 7-day launch cycle in this browser session yet. Open **7-Day Launch Mode** (below System diagnostics), tap **Generate Launch Plan**, or say **generate launch plan** to start.",
    ].join("\n");
  }

  const dayRow = progress.days.find((d) => d.day === progress.currentDay);
  const completedCount = progress.days.filter((d) => d.status === "completed").length;
  const cycleShort = progress.cycleId.length > 14 ? `${progress.cycleId.slice(0, 14)}…` : progress.cycleId;

  const lines: string[] = [
    "**Launch Mode progress**",
    "",
    `Cycle **${cycleShort}** · **Day ${progress.currentDay}** is your current focus.`,
  ];

  if (dayRow) {
    const statusLabel = dayRow.status.replace(/_/g, " ");
    lines.push(`**This day’s status:** ${statusLabel}.`);
    if (dayRow.completedActions.length) {
      lines.push("", "**Logged actions (current day):**");
      dayRow.completedActions.slice(-8).forEach((a) => lines.push(`• ${a}`));
    }
    if (dayRow.notes?.trim()) {
      const nt = dayRow.notes.trim();
      lines.push("", `**Your note:** ${nt.slice(0, 200)}${nt.length > 200 ? "…" : ""}`);
    }
  }

  lines.push("", `**Completed days:** ${completedCount} / 7.`);

  if (allLaunchDaysCompleted(progress)) {
    lines.push("", "All seven days are marked **complete** — refresh the plan or start a **new cycle** when you’re ready for the next wave.");
  }

  if (!plan.readiness.isReady && plan.readiness.blockers.length) {
    lines.push("", "**Readiness:** a few blockers still show in the latest plan — close them before you scale spend.");
    plan.readiness.blockers.slice(0, 3).forEach((b) => lines.push(`• ${b}`));
  }

  const dayPlan = plan.days.find((d) => d.day === progress.currentDay);
  if (dayPlan) {
    lines.push("", `**Objective:** ${dayPlan.objective}`);
    const actions = mapLaunchDayToActions({ dayPlan, launchPlan: plan, sharedProfile });
    const scroll = actions.find((a) => a.kind === "scroll_to");
    const suggest = actions.find(
      (a) =>
        a.kind === "suggest_generate_content" ||
        a.kind === "suggest_generate_campaign" ||
        a.kind === "suggest_compile_media_brief"
    );
    if (scroll) {
      lines.push(
        "",
        `**Next move:** in the panel, expand **Day ${progress.currentDay}** → **Recommended actions**, or jump to **${scroll.label}** (anchor \`#${scroll.targetId}\`).`
      );
    }
    if (suggest) {
      lines.push(`**Then:** ${suggest.label}`);
    }
  }

  lines.push("", "Scroll to **7-Day Launch Mode** if the panel isn’t on screen.");

  if (debug) {
    lines.push("", "_Debug — cycle json (truncated)_", "```", JSON.stringify(progress).slice(0, 2500), "```");
  }

  return lines.join("\n");
}

export function parseLaunchAnalyticsIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  const phrases = [
    "how is my launch going",
    "what did i complete",
    "what's left",
    "whats left",
    "am i improving",
    "what happened in my last launch",
  ];
  if (phrases.includes(t)) return true;
  return /\b(how is my launch going|what did i complete|what'?s left|am i improving|what happened in my last launch)\b/i.test(
    message.trim()
  );
}

export function formatBentleyLaunchAnalyticsReply(params: {
  progress: RevenueOsLaunchCycleProgress | null;
  plan: RevenueOsLaunchModePlan;
  sharedProfile: RevenueOsLaunchSharedProfile;
  systemSignals: RevenueOsSystemSignals;
  historyCycles: RevenueOsLaunchCycleProgress[];
  events: LaunchCycleEventRecord[];
  debug?: boolean;
}): string {
  const { progress, plan, sharedProfile, systemSignals, historyCycles, events, debug } = params;
  if (!progress) {
    return [
      "**Launch analytics**",
      "",
      "No active launch cycle found locally or on the server for this workspace. Generate a plan in **7-Day Launch Mode** to start tracking execution.",
    ].join("\n");
  }

  const cur = summarizeLaunchCycleAnalytics(progress, { livePlanSummary: plan.summary });
  const hist = summarizeLaunchHistoryAnalytics(historyCycles.length ? historyCycles : [progress]);
  const stale = diffLaunchProgressAgainstCurrent({
    cycle: progress,
    currentPlanSummary: plan.summary,
    currentReadiness: { isReady: plan.readiness.isReady, blockerCount: plan.readiness.blockers.length },
    systemSignals,
    sharedProfile,
  });

  const remaining = progress.days.filter((d) => d.status !== "completed").length;
  const blockedDays = progress.days.filter((d) => d.status === "blocked").map((d) => d.day);

  const lines: string[] = [
    "**Launch execution snapshot**",
    "",
    `**Progress:** ${cur.completedDayCount} / 7 days complete · **${remaining}** still open.`,
    `**Momentum:** ${cur.currentMomentum} · completion rate on this cycle: **${Math.round(cur.completionRate * 100)}%**.`,
  ];

  if (blockedDays.length) {
    lines.push("", `**Blocked days:** ${blockedDays.join(", ")} — clear blockers before stacking new work.`);
  }

  if (cur.stalePlan || stale.hasMeaningfulChange) {
    lines.push("", "**Plan freshness:** inputs or summary drifted — refresh the 7-day plan when you can so actions stay aligned.");
    if (stale.reasons.length) {
      stale.reasons.slice(0, 3).forEach((r) => lines.push(`• ${r}`));
    }
  }

  if (historyCycles.length >= 2) {
    lines.push(
      "",
      `**Across recent cycles:** ${hist.trendHint === "improving" ? "trend looks up vs prior cycle." : hist.trendHint === "flat" ? "pace is similar to your last cycle." : "not enough history for a strong trend yet."}`,
      hist.note
    );
  }

  if (events.length) {
    const types = new Map<string, number>();
    for (const e of events) {
      types.set(e.eventType, (types.get(e.eventType) ?? 0) + 1);
    }
    const top = [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    lines.push("", "**Recent logged events (server):**");
    top.forEach(([k, n]) => lines.push(`• ${k}: ${n}`));
  }

  lines.push("", "Open **7-Day Launch Mode** for day-by-day actions and logging.");

  if (debug) {
    lines.push(
      "",
      "_Debug — analytics + events (compact)_",
      "```",
      JSON.stringify({ cur, hist, events: events.slice(0, 8) }).slice(0, 2800),
      "```"
    );
  }

  return lines.join("\n");
}
