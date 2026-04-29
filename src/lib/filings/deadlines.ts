export type FilingTrack = "FOREIGN_OWNED_SMLLC_5472" | "PARTNERSHIP_1065";

function toUTCDate(y: number, m: number, d: number) {
  // m: 1-12
  return new Date(Date.UTC(y, m - 1, d, 17, 0, 0)); // 5pm UTC "safe" time
}

function nextBusinessDay(date: Date) {
  const day = date.getUTCDay(); // 0 Sun, 6 Sat
  const d = new Date(date);
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  return d;
}

export function filingDueDate(track: FilingTrack, taxYear: number) {
  // Assumes calendar year taxYear ends Dec 31 (taxYear)
  // Partnership 1065: 15th day of 3rd month after year end => March 15 (taxYear+1), adjusted
  // 5472 w/ pro forma 1120: commonly April 15 (taxYear+1) for calendar-year
  if (track === "PARTNERSHIP_1065") {
    return nextBusinessDay(toUTCDate(taxYear + 1, 3, 15));
  }
  return nextBusinessDay(toUTCDate(taxYear + 1, 4, 15));
}

export function filingExtensionDate(track: FilingTrack, taxYear: number) {
  // Typical automatic extensions:
  // - 1065: 6 months => Sep 15 (adjust)
  // - 1120/5472: 6 months => Oct 15 (adjust)
  if (track === "PARTNERSHIP_1065") {
    return nextBusinessDay(toUTCDate(taxYear + 1, 9, 15));
  }
  return nextBusinessDay(toUTCDate(taxYear + 1, 10, 15));
}


