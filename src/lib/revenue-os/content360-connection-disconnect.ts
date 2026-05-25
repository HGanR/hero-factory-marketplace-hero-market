import { and, count, eq, inArray } from "drizzle-orm";

import { providerPublishJobs } from "@/lib/db/schema";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

/** Jobs that should block disconnect unless `force` is used. */
const BLOCKING_JOB_STATUSES = ["scheduled", "queued"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countActiveContent360JobsForConnection(db: any, input: { clientId: string; connectionId: string }): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(providerPublishJobs)
    .where(
      and(
        eq(providerPublishJobs.clientId, input.clientId),
        eq(providerPublishJobs.connectionId, input.connectionId),
        eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
        inArray(providerPublishJobs.status, [...BLOCKING_JOB_STATUSES]),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Marks in-flight Content360 jobs as disconnected so workers do not orphan unknown state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markContent360JobsDisconnectedForConnection(
  db: any,
  input: { clientId: string; connectionId: string },
): Promise<number> {
  const res = await db
    .update(providerPublishJobs)
    .set({
      status: "disconnected_provider",
      errorMessage: "Content360 connection was force-disconnected.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(providerPublishJobs.clientId, input.clientId),
        eq(providerPublishJobs.connectionId, input.connectionId),
        eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
        inArray(providerPublishJobs.status, [...BLOCKING_JOB_STATUSES]),
      ),
    );
  const affected =
    res && typeof res === "object" && "affectedRows" in res && typeof (res as { affectedRows?: number }).affectedRows === "number"
      ? (res as { affectedRows: number }).affectedRows
      : 0;
  return affected;
}
