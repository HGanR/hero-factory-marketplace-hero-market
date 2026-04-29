const LOG_PREFIX = "[Meet avatar]";

/** Dev-only diagnostics (skipped in production and under Jest). */
export function meetAvatarLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return;
  console.info(LOG_PREFIX, ...args);
}
