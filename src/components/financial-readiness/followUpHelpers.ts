/** Date helpers for follow-up snooze / due windows — no dependencies. */

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Snooze from the later of current due or today, then add days. */
export function snoozeFromDueOrToday(due: string | null, snoozeDays: number, today: string): string {
  const base = due && due >= today ? due : today;
  return addDaysIso(base, snoozeDays);
}

export function uniqTag(tags: string[], add: string): string[] {
  return [...new Set([...tags, add])];
}
