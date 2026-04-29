/**
 * Flexible date parsing for appointment scheduling.
 * Handles many common variations visitors might type:
 * - March 16, 2026 | March 16th 2026 | March 16 2026
 * - 03/16/2026 | 3/16/2026 | 03/16/26 | 3/16/26
 * - 3-16-2026 | 03-16-2026 | 3-16-26 | 03-16-26
 * - 03 16 2026 | 3 16 2026 | 03 16 26
 * - tomorrow | next Tuesday | Monday
 */

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

export interface ParsedDateResult {
  date: Date;
  /** Human-readable formatted date for confirmation */
  formatted: string;
}

/**
 * Parse a date string with flexible format support.
 * Returns null if the date cannot be parsed or is invalid.
 */
export function parseAppointmentDate(
  input: string,
  referenceDate: Date = new Date()
): ParsedDateResult | null {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  // Normalize: strip ordinal suffixes (1st, 2nd, 3rd, 4th), trim, collapse spaces
  let cleaned = input
    .trim()
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\s*,\s*/g, " ") // "March 16, 2026" -> "March 16 2026"
    .replace(/\s+/g, " ")
    .trim();

  let parsed: Date | null = null;

  // --- Relative dates ---
  if (/^tomorrow$/i.test(cleaned)) {
    parsed = new Date(today);
    parsed.setDate(parsed.getDate() + 1);
  } else if (/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(cleaned)) {
    const m = cleaned.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (m) {
      const targetDay = DAY_NAMES.indexOf(m[1].toLowerCase());
      parsed = new Date(today);
      const currentDay = parsed.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      parsed.setDate(parsed.getDate() + daysUntil);
    }
  } else if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(cleaned)) {
    const targetDay = DAY_NAMES.indexOf(cleaned.toLowerCase());
    parsed = new Date(today);
    const currentDay = parsed.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    parsed.setDate(parsed.getDate() + daysUntil);
  }

  // --- Month name formats ---
  if (!parsed) {
    // "March 16" | "March 16 2026" | "March 16, 2026" (comma already normalized)
    const monthDay = cleaned.match(
      /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/i
    );
    if (monthDay) {
      const month = MONTH_NAMES.indexOf(monthDay[1].toLowerCase());
      const day = parseInt(monthDay[2], 10);
      let year = monthDay[3] ? parseInt(monthDay[3], 10) : today.getFullYear();
      if (year >= 0 && year < 100) year += 2000;
      parsed = new Date(year, month, day);
      if (parsed < today && !monthDay[3]) {
        parsed = new Date(year + 1, month, day);
      }
    }
  }

  // --- Slash format: 3/16/2026, 03/16/26, 3/16 ---
  if (!parsed) {
    const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slash) {
      const month = parseInt(slash[1], 10) - 1;
      const day = parseInt(slash[2], 10);
      let year = slash[3] ? parseInt(slash[3], 10) : today.getFullYear();
      if (year >= 0 && year < 100) year += 2000;
      parsed = new Date(year, month, day);
      if (parsed < today && !slash[3]) {
        parsed = new Date(year + 1, month, day);
      }
    }
  }

  // --- Dash format: 3-16-2026, 03-16-26, 3-16 ---
  if (!parsed) {
    const dash = cleaned.match(/^(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?$/);
    if (dash) {
      const month = parseInt(dash[1], 10) - 1;
      const day = parseInt(dash[2], 10);
      let year = dash[3] ? parseInt(dash[3], 10) : today.getFullYear();
      if (year >= 0 && year < 100) year += 2000;
      parsed = new Date(year, month, day);
      if (parsed < today && !dash[3]) {
        parsed = new Date(year + 1, month, day);
      }
    }
  }

  // --- Space-separated numeric: 03 16 2026, 3 16 26, 03 16 ---
  if (!parsed) {
    const space = cleaned.match(/^(\d{1,2})\s+(\d{1,2})(?:\s+(\d{2,4}))?$/);
    if (space) {
      const month = parseInt(space[1], 10) - 1;
      const day = parseInt(space[2], 10);
      let year = space[3] ? parseInt(space[3], 10) : today.getFullYear();
      if (year >= 0 && year < 100) year += 2000;
      parsed = new Date(year, month, day);
      if (parsed < today && !space[3]) {
        parsed = new Date(year + 1, month, day);
      }
    }
  }

  // --- Fallback: native Date parsing ---
  if (!parsed) {
    parsed = new Date(cleaned);
    if (isNaN(parsed.getTime())) {
      parsed = new Date(`${cleaned} ${today.getFullYear()}`);
    }
  }

  if (!parsed || isNaN(parsed.getTime())) return null;
  if (parsed < today) return null;

  const formatted = parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return { date: parsed, formatted };
}
