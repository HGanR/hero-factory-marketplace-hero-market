/**
 * Broadcast launch reminders — computed on read in this phase (no DB persistence, no background worker).
 * Clients may track dismissed ids in localStorage if desired.
 */

export type BroadcastReminderType =
  | "event_starting_60m"
  | "event_starting_30m"
  | "event_starting_10m"
  | "readiness_attention"
  | "readiness_blocked";

export type BroadcastReminderItemStatus = "pending" | "shown" | "dismissed";

export type BroadcastReminderItem = {
  /** Stable synthetic id for computed reminders (e.g. `cmp:42:event_starting_30m`). */
  id: string;
  userId: number;
  broadcastEventId: number;
  reminderType: BroadcastReminderType;
  /** When this reminder becomes relevant (UTC). */
  scheduledForIso: string;
  status: BroadcastReminderItemStatus;
  summary: string;
  detail?: string;
  createdAt: string;
  updatedAt: string;
};

/** Documented: reminders are derived at request time; `status` is always `pending` from the API. */
export const BROADCAST_REMINDERS_COMPUTED_ONLY = true as const;

export function buildComputedReminderId(broadcastEventId: number, reminderType: BroadcastReminderType): string {
  return `cmp:${broadcastEventId}:${reminderType}`;
}
