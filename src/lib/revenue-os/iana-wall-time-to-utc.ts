/**
 * Converts a civil date + clock time interpreted in `timeZone` (IANA) to a UTC ISO-8601 string.
 * Uses a binary search over UTC milliseconds because ECMAScript Date has no native zoned wall-clock constructor.
 */
export function ianaWallTimeToUtcIso(dateYmd: string, hm: string, timeZone: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!dm || !tm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (![y, mo, d, h, mi].every((n) => Number.isFinite(n))) return null;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const read = (utcMs: number) => {
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      y: Number(get("year")),
      mo: Number(get("month")),
      d: Number(get("day")),
      h: Number(get("hour")),
      mi: Number(get("minute")),
    };
  };

  const wantKey = y * 1e9 + mo * 1e7 + d * 1e5 + h * 1e3 + mi;
  let lo = Date.UTC(y, mo - 1, d - 1, 0, 0, 0);
  let hi = Date.UTC(y, mo - 1, d + 2, 0, 0, 0);
  let best: number | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const p = read(mid);
    const key = p.y * 1e9 + p.mo * 1e7 + p.d * 1e5 + p.h * 1e3 + p.mi;
    if (key === wantKey) {
      best = mid;
      break;
    }
    if (key < wantKey) lo = mid + 1;
    else hi = mid - 1;
  }

  if (best == null) return null;
  return new Date(best).toISOString();
}
