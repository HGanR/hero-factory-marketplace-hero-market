/**
 * Scheduling + scope helpers for Bentley automation policies.
 */

export type AutomationPolicyType =
  | "daily_operator_summary"
  | "daily_cadence_run"
  | "retry_failed_publish"
  | "stale_backlog_cleanup"
  | "lead_handoff_watch"
  | "unsynced_post_watch"
  | "connector_gap_watch"
  | "weekly_executive_report";

export type AutomationScheduleJson = {
  /** Hours between runs (default 24 for daily policies). */
  intervalHours?: number;
  /** Run at this hour UTC once per day (0–23). */
  dailyHourUTC?: number;
};

export type AutomationScope = {
  userId: string;
  clientId: string;
  trustId: string;
};

const DEFAULT_INTERVAL_HOURS: Record<AutomationPolicyType, number> = {
  daily_operator_summary: 24,
  daily_cadence_run: 24,
  retry_failed_publish: 6,
  stale_backlog_cleanup: 24,
  lead_handoff_watch: 12,
  unsynced_post_watch: 8,
  connector_gap_watch: 12,
  weekly_executive_report: 24 * 7,
};

export function normalizeAutomationScope(input: {
  clientId?: string | null;
  trustId?: string | null;
}): { clientId: string; trustId: string } {
  return {
    clientId: (input.clientId ?? "").trim(),
    trustId: (input.trustId ?? "").trim(),
  };
}

function intervalMsFromSchedule(
  policyType: AutomationPolicyType,
  scheduleJson: Record<string, unknown> | null | undefined
): number {
  const s = scheduleJson as AutomationScheduleJson | undefined;
  const hours = s?.intervalHours ?? DEFAULT_INTERVAL_HOURS[policyType] ?? 24;
  return Math.max(1, hours) * 60 * 60 * 1000;
}

/**
 * Next run time after `lastRunAt` (or from now if no last run).
 */
export function computeNextAutomationRunAt(input: {
  policyType: AutomationPolicyType;
  lastRunAt: Date | null;
  scheduleJson: Record<string, unknown> | null | undefined;
  nowMs: number;
}): Date {
  const { policyType, lastRunAt, scheduleJson, nowMs } = input;
  const s = scheduleJson as AutomationScheduleJson | undefined;
  const base = lastRunAt?.getTime() ?? nowMs;

  if (s?.dailyHourUTC != null && s.dailyHourUTC >= 0 && s.dailyHourUTC <= 23) {
    const d = new Date(base);
    d.setUTCHours(s.dailyHourUTC, 0, 0, 0);
    if (d.getTime() <= base) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return d;
  }

  const interval = intervalMsFromSchedule(policyType, scheduleJson);
  return new Date(base + interval);
}

/**
 * Whether a policy should run now (due window).
 */
export function shouldRunAutomationPolicy(input: {
  isEnabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  nowMs: number;
  /** When true, always eligible if enabled (manual trigger). */
  force?: boolean;
}): boolean {
  if (!input.isEnabled && !input.force) return false;
  if (input.force) return true;
  if (input.nextRunAt == null) return true;
  return input.nextRunAt.getTime() <= input.nowMs;
}

export function summarizeAutomationRunResult(input: {
  policyType: AutomationPolicyType;
  ok: boolean;
  dryRun: boolean;
  detail?: Record<string, unknown>;
  error?: string;
}): string {
  const parts = [
    input.policyType,
    input.ok ? "ok" : "failed",
    input.dryRun ? "dryRun" : "live",
  ];
  if (input.error) parts.push(input.error);
  return parts.join(" · ");
}
