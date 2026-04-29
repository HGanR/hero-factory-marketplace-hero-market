/**
 * CRM channel/direction constants for app-layer normalization.
 * DB uses VARCHAR; this prevents "Inbound" vs "inbound" vs "inbound " drift.
 */

export const CHANNELS = ["sms", "email", "call", "voice", "note"] as const;
export const DIRECTIONS = ["inbound", "outbound", "system"] as const;

export type Channel = (typeof CHANNELS)[number];
export type Direction = (typeof DIRECTIONS)[number];

/** Normalize channel; "voice" maps to "call" for DB compatibility. */
export function normalizeChannel(v: string): string {
  const x = v.toLowerCase().trim();
  if (x === "voice") return "call";
  if (CHANNELS.includes(x as Channel)) return x;
  return "sms";
}

/** Normalize direction. */
export function normalizeDirection(v: string): string {
  const x = v.toLowerCase().trim();
  if (DIRECTIONS.includes(x as Direction)) return x;
  return "inbound";
}
