function redactDeep(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") {
    if (/sk-[a-z0-9]{10,}/i.test(v)) return v.replace(/sk-[a-z0-9]+/gi, "[REDACTED]");
    if (/Bearer\s+\S+/i.test(v)) return v.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
    return v.length > 4000 ? `${v.slice(0, 4000)}…` : v;
  }
  if (Array.isArray(v)) return v.map(redactDeep);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(o)) {
      const key = k.toLowerCase();
      if (
        key.includes("token") ||
        key.includes("secret") ||
        key.includes("password") ||
        key.includes("authorization") ||
        key.includes("apikey")
      ) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactDeep(val);
      }
    }
    return out;
  }
  return v;
}

/** JSON-shaped summary for audit rows — never store raw OAuth secrets. */
export function redactToolInputForAudit(_actionKey: string, input: unknown): string {
  try {
    const safe = redactDeep(input);
    return JSON.stringify(safe).slice(0, 8000);
  } catch {
    return "";
  }
}
