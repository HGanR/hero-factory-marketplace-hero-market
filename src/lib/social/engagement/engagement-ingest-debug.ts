type IngestDebugKind = "duplicate_message" | "invalid_timestamp" | "normalize" | "upsert";

/**
 * Best-effort debug (development or explicit `REVENUE_OS_INBOX_DEBUG=1`); not an audit log.
 */
export function logEngagementIngestDebug(kind: IngestDebugKind, detail: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development" || process.env.REVENUE_OS_INBOX_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.info(`[revenue-os engagement-ingest] ${kind}`, detail);
  }
}
