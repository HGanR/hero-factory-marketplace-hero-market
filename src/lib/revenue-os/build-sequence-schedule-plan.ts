/**
 * Deterministic sequence → suggested schedule (no I/O, no LLM).
 */

import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type {
  RevenueOsSuggestedSchedulePlan,
  RevenueOsSuggestedSchedulePlanDiagnostics,
  RevenueOsSuggestedScheduleSlot,
  RevenueOsSuggestedScheduleTimezoneStrategy,
} from "@/lib/revenue-os/content-sequence-schedule-types";

export type PostingWindow = { startHour: number; endHour: number };

export type BuildSequenceSchedulePlanArgs = {
  batchCalendarSequence: RevenueOsBatchCalendarSequence;
  launchPlan?: RevenueOsLaunchModePlan | null;
  now?: Date;
  /** Lowercased platform key → posting windows (local hours, 0–23). */
  preferredPostingWindowsPerPlatform?: Record<string, PostingWindow[]>;
  /** IANA timezone, e.g. America/New_York */
  userTimezoneHint?: string | null;
  workspaceDefaultTimezone?: string | null;
};

function isValidIanaTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function zonedPartsAtUtc(utcMs: number, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(new Date(utcMs));
  const m: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  return {
    y: Number(m.year),
    mo: Number(m.month),
    d: Number(m.day),
    h: Number(m.hour),
    mi: Number(m.minute),
  };
}

/** Find UTC instant where wall clock in `timeZone` equals y-mo-d h:mi. */
export function utcMillisForZonedWallClock(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string
): number | null {
  const center = Date.UTC(y, mo - 1, d, 12, 0, 0);
  const start = center - 14 * 3600000;
  const end = center + 14 * 3600000;
  for (let t = start; t <= end; t += 60000) {
    const p = zonedPartsAtUtc(t, timeZone);
    if (p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi) return t;
  }
  return null;
}

function addCalendarDaysUtc(y: number, mo: number, d: number, delta: number): { y: number; mo: number; d: number } {
  const u = Date.UTC(y, mo - 1, d + delta, 12, 0, 0);
  const dt = new Date(u);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function addCalendarDaysInZone(
  y: number,
  mo: number,
  d: number,
  delta: number,
  timeZone: string
): { y: number; mo: number; d: number } {
  const anchor = utcMillisForZonedWallClock(y, mo, d, 12, 0, timeZone) ?? Date.UTC(y, mo - 1, d, 12, 0, 0);
  const t1 = anchor + delta * 24 * 3600000;
  return zonedPartsAtUtc(t1, timeZone);
}

function startAnchorTomorrowUtc(now: Date): { y: number; mo: number; d: number } {
  return addCalendarDaysUtc(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), 1);
}

function startAnchorTomorrowInZone(now: Date, timeZone: string): { y: number; mo: number; d: number } {
  const today = zonedPartsAtUtc(now.getTime(), timeZone);
  return addCalendarDaysInZone(today.y, today.mo, today.d, 1, timeZone);
}

function pickHour(
  slotIndex: number,
  preferredPlatforms: string[],
  windows: Record<string, PostingWindow[]> | undefined
): number {
  const keys = preferredPlatforms.map((p) => p.trim().toLowerCase()).filter(Boolean);
  for (const k of keys) {
    const w = windows?.[k]?.[0];
    if (w && w.endHour > w.startHour) {
      const span = w.endHour - w.startHour;
      return Math.min(w.endHour - 1, w.startHour + ((slotIndex * 2) % span));
    }
  }
  const defaults = [10, 14, 18];
  return defaults[slotIndex % defaults.length] ?? 10;
}

function pickMinute(slotIndex: number, sameDayBump: number): number {
  return ((slotIndex * 17 + sameDayBump * 31) % 55) + 2;
}

/**
 * Build ordered suggested schedule slots from a batch calendar sequence.
 */
export function buildSequenceSchedulePlan(args: BuildSequenceSchedulePlanArgs): RevenueOsSuggestedSchedulePlan {
  const now = args.now ?? new Date();
  const seq = args.batchCalendarSequence;
  const slotsIn = seq.slots ?? [];
  if (!slotsIn.length) {
    const diagnostics: RevenueOsSuggestedSchedulePlanDiagnostics = {
      slotCount: 0,
      usedExactIsoTimestamps: false,
      timestampInterpretation: "day_order_only",
    };
    return {
      slots: [],
      timezoneStrategy: "none",
      summary: "No sequence slots yet — generate routed content before scheduling.",
      diagnostics,
    };
  }

  let tz: string | null = null;
  let timezoneStrategy: RevenueOsSuggestedScheduleTimezoneStrategy = "none";
  const user = args.userTimezoneHint?.trim();
  const ws = args.workspaceDefaultTimezone?.trim();
  if (user && isValidIanaTimeZone(user)) {
    tz = user;
    timezoneStrategy = "user_local";
  } else if (ws && isValidIanaTimeZone(ws)) {
    tz = ws;
    timezoneStrategy = "workspace_default";
  }

  const windows = args.preferredPostingWindowsPerPlatform;

  let nextDayOffset = 0;
  let lastYmd: string | null = null;
  let sameDayBump = 0;

  const slots: RevenueOsSuggestedScheduleSlot[] = [];

  for (let i = 0; i < slotsIn.length; i++) {
    const s = slotsIn[i]!;
    const dayOffset = Math.max(nextDayOffset, Math.max(0, s.dayIndex - 1));
    nextDayOffset = dayOffset + 1;

    const hour = pickHour(i, s.preferredPlatforms, windows);
    let minute = pickMinute(i, 0);
    let y: number;
    let mo: number;
    let d: number;
    let iso: string | undefined;

    if (tz) {
      const start = startAnchorTomorrowInZone(now, tz);
      const ymd = addCalendarDaysInZone(start.y, start.mo, start.d, dayOffset, tz);
      y = ymd.y;
      mo = ymd.mo;
      d = ymd.d;
      const ymdKey = `${y}-${mo}-${d}`;
      if (ymdKey === lastYmd) {
        sameDayBump += 1;
        minute = pickMinute(i, sameDayBump);
      } else {
        sameDayBump = 0;
        lastYmd = ymdKey;
      }
      const utcMs = utcMillisForZonedWallClock(y, mo, d, hour, minute, tz);
      if (utcMs != null) {
        iso = new Date(utcMs).toISOString();
      } else {
        const u = Date.UTC(y, mo - 1, d, 12, minute, 0, 0);
        iso = new Date(u).toISOString();
      }
    } else {
      const start = startAnchorTomorrowUtc(now);
      const ymd = addCalendarDaysUtc(start.y, start.mo, start.d, dayOffset);
      y = ymd.y;
      mo = ymd.mo;
      d = ymd.d;
      const ymdKey = `${y}-${mo}-${d}`;
      if (ymdKey === lastYmd) {
        sameDayBump += 1;
        minute = pickMinute(i, sameDayBump);
      } else {
        sameDayBump = 0;
        lastYmd = ymdKey;
      }
      const u = Date.UTC(y, mo - 1, d, 12, minute, 0, 0);
      iso = new Date(u).toISOString();
    }

    const timeNote =
      tz == null
        ? "Times use **neutral UTC midday** (directional only) — set your timezone in the schedule panel when available."
        : "Wall-clock times use your selected timezone; treat as **directional**, not fully optimized.";

    slots.push({
      dayIndex: s.dayIndex,
      role: s.role,
      suggestedScheduledAt: iso,
      preferredPlatforms: s.preferredPlatforms,
      confidence: s.confidence,
      reason: `${s.reason} ${timeNote}`.trim(),
    });
  }

  const usedExactIsoTimestamps = slots.every((x) => Boolean(x.suggestedScheduledAt));
  const diagnostics: RevenueOsSuggestedSchedulePlanDiagnostics = {
    slotCount: slots.length,
    usedExactIsoTimestamps,
    timestampInterpretation: tz ? "zoned_wall_clock" : "utc_midday_neutral",
  };

  const launchNote = args.launchPlan?.days?.length
    ? ` Your **${args.launchPlan.days.length}-day** launch plan informs slot day indices (directional).`
    : "";

  const summary = `**${slots.length}-step** suggested cadence — one beat per day where possible, aligned loosely to sequence day indices. ${
    tz == null
      ? "Timezone not set: ISO times are **UTC-neutral** guidance."
      : `Timezone: **${tz}** — verify against your real calendar.`
  }${launchNote}`;

  return { slots, timezoneStrategy, summary, diagnostics };
}
