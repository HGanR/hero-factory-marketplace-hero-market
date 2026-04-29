import {
  FOUNDATION_STEPS,
  OPTIMIZATION_STEPS,
  RESOLUTION_STEPS,
  type FinancialReadinessState,
} from "./state";
import { addDaysIso } from "./followUpHelpers";

function countDone<T extends string>(keys: T[], done: Partial<Record<T, boolean>>): number {
  return keys.filter((k) => done[k]).length;
}

export function moduleProgressPct(state: FinancialReadinessState): {
  foundation: number;
  optimization: number;
  resolution: number;
} {
  const fIds = FOUNDATION_STEPS.map((s) => s.id);
  const oIds = OPTIMIZATION_STEPS.map((s) => s.id);
  const rIds = RESOLUTION_STEPS.map((s) => s.id);
  return {
    foundation: Math.round((countDone(fIds, state.foundation.stepCompletion) / fIds.length) * 100),
    optimization: Math.round((countDone(oIds, state.optimization.stepCompletion) / oIds.length) * 100),
    resolution: Math.round((countDone(rIds, state.resolution.stepCompletion) / rIds.length) * 100),
  };
}

export function activeCaseCount(state: FinancialReadinessState): number {
  return state.cases.filter((c) => c.status !== "completed" && c.status !== "escalated").length;
}

export type DueItem = {
  id: string;
  kind: "document" | "matter";
  label: string;
  due: string;
  href: string;
};

export function upcomingDueItems(state: FinancialReadinessState, limit = 5): DueItem[] {
  const items: DueItem[] = [];

  for (const d of state.documents) {
    if (!d.followUpDueAt) continue;
    if (d.status === "completed" || d.status === "escalated") continue;
    items.push({
      id: d.id,
      kind: "document",
      label: `${d.primaryParty} — ${d.type.replace(/_/g, " ")}`,
      due: d.followUpDueAt,
      href: `/financial-readiness/documents/${encodeURIComponent(d.id)}`,
    });
  }
  for (const c of state.cases) {
    if (!c.followUpDueAt) continue;
    if (c.status === "completed" || c.status === "escalated") continue;
    items.push({
      id: c.id,
      kind: "matter",
      label: c.label,
      due: c.followUpDueAt,
      href: `/financial-readiness/cases/${encodeURIComponent(c.id)}`,
    });
  }

  items.sort((a, b) => a.due.localeCompare(b.due));
  return items.slice(0, limit);
}

export type UrgencyStripCounts = {
  overdueMatters: number;
  dueThisWeekMatters: number;
  escalatedMatters: number;
  awaitingResponseMatters: number;
};

/** Matter-level counts for the hub urgency strip (today = YYYY-MM-DD). */
export function urgencyStripCounts(state: FinancialReadinessState, today: string): UrgencyStripCounts {
  const weekEnd = addDaysIso(today, 7);
  let overdueMatters = 0;
  let dueThisWeekMatters = 0;
  let escalatedMatters = 0;
  let awaitingResponseMatters = 0;

  for (const c of state.cases) {
    if (c.status === "escalated") escalatedMatters++;
    if (c.status === "awaiting_response") awaitingResponseMatters++;
    if (c.status === "completed") continue;
    if (c.followUpDueAt) {
      if (c.followUpDueAt < today) overdueMatters++;
      else if (c.followUpDueAt <= weekEnd) dueThisWeekMatters++;
    }
  }

  return {
    overdueMatters,
    dueThisWeekMatters,
    escalatedMatters,
    awaitingResponseMatters,
  };
}

/** Monday 00:00 local week start as YYYY-MM-DD (for “this week” analytics). */
export function isoWeekStartMonday(todayIso: string): string {
  const d = new Date(todayIso + "T12:00:00");
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export type HubAnalyticsSnapshot = {
  mattersCreatedThisWeek: number;
  lettersGeneratedThisWeek: number;
  overdueMatters: number;
  resolvedMattersThisWeek: number;
  escalatedMattersTotal: number;
};

export function hubAnalyticsSnapshot(state: FinancialReadinessState, today: string): HubAnalyticsSnapshot {
  const ws = isoWeekStartMonday(today);
  let mattersCreatedThisWeek = 0;
  for (const c of state.cases) {
    if (c.createdAt.slice(0, 10) >= ws) mattersCreatedThisWeek++;
  }
  let lettersGeneratedThisWeek = 0;
  for (const d of state.documents) {
    if (d.createdAt.slice(0, 10) >= ws) lettersGeneratedThisWeek++;
  }
  let resolvedMattersThisWeek = 0;
  for (const c of state.cases) {
    if (c.status === "completed" && c.updatedAt.slice(0, 10) >= ws) resolvedMattersThisWeek++;
  }
  let escalatedMattersTotal = 0;
  for (const c of state.cases) {
    if (c.status === "escalated") escalatedMattersTotal++;
  }
  const u = urgencyStripCounts(state, today);
  return {
    mattersCreatedThisWeek,
    lettersGeneratedThisWeek,
    overdueMatters: u.overdueMatters,
    resolvedMattersThisWeek,
    escalatedMattersTotal,
  };
}

export function overdueCount(state: FinancialReadinessState): number {
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const d of state.documents) {
    if (!d.followUpDueAt) continue;
    if (d.status === "completed" || d.status === "escalated") continue;
    if (d.followUpDueAt < today) n++;
  }
  for (const c of state.cases) {
    if (!c.followUpDueAt) continue;
    if (c.status === "completed" || c.status === "escalated") continue;
    if (c.followUpDueAt < today) n++;
  }
  return n;
}

export function recommendedNextAction(state: FinancialReadinessState): string {
  if (!state.hub.intakeCompleted) return "Complete the short intake to pick your starting system.";
  if (state.hub.primaryGoal === "foundation" && !state.foundation.moduleCompleted) {
    return "Continue Credit Foundation — finish utilization and checklist steps.";
  }
  if (state.hub.primaryGoal === "optimization" && !state.optimization.moduleCompleted) {
    return "Continue Optimization — generate letters and set your dispute timeline anchor.";
  }
  if (state.hub.primaryGoal === "resolution" && !state.resolution.moduleCompleted) {
    return "Continue Resolution — log contacts and send validation / cease drafts when ready.";
  }
  if (!state.foundation.moduleCompleted) return "Strengthen your foundation before heavy disputes.";
  if (
    !state.optimization.moduleCompleted &&
    state.documents.filter((d) => d.type === "bureau_dispute").length === 0
  ) {
    return "Draft a bureau dispute from Optimization when you’re ready to challenge tradelines.";
  }
  if (state.resolution.caseStatus !== "resolved" && state.resolution.interactions.length === 0) {
    return "Log collector contacts in Resolution to build a defensible timeline.";
  }
  const overdue = overdueCount(state);
  if (overdue > 0) return `You have ${overdue} overdue follow-up(s) — open matters or documents to update status.`;
  return "Review vault documents and matter due dates; update statuses when mail arrives.";
}
