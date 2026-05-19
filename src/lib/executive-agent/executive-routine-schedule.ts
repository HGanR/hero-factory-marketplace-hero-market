/**
 * Pure cadence helpers for executive routines (safe in Node tests; no server-only).
 */

export type ExecutiveRoutineCadence = "daily" | "hourly" | "weekly";

export function computeNextExecutiveRoutineRunAt(cadence: ExecutiveRoutineCadence, from: Date): Date {
  const d = new Date(from.getTime());
  if (cadence === "hourly") {
    d.setTime(d.getTime() + 60 * 60 * 1000);
  } else if (cadence === "weekly") {
    d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return d;
}
